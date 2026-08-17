// Stripe webhook handler — the single source of truth for subscription
// state in Supabase. Every meaningful Stripe event lands here and updates
// the `subscriptions` table (and users.subscription_status) directly, so
// cancellations, renewals, and payment failures reflect in the app the
// moment Stripe's own state actually changes — not when the client
// optimistically assumes it did.
//
// verify_jwt is OFF for this function: Stripe calls it directly and has no
// Supabase session. Authentication instead comes from verifying the
// Stripe-Signature header against STRIPE_WEBHOOK_SECRET below, which is
// the standard (and required) way to trust a Stripe webhook request.

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function upsertSubscription(sub: Stripe.Subscription, eventCreated: number) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Resolve the Supabase user: prefer the metadata we stamped at checkout
  // time, fall back to looking the customer up by stripe_customer_id.
  let userId = sub.metadata?.supabase_user_id as string | undefined;
  if (!userId) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.id;
  }
  if (!userId) {
    console.error("stripe-webhook: could not resolve user for customer", customerId);
    return;
  }

  const priceId = sub.items.data[0]?.price?.id ?? "";
  const currentPeriodEnd = sub.items.data[0]?.current_period_end
    ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
    : null;
  const eventCreatedAt = new Date(eventCreated * 1000).toISOString();

  const fields = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: currentPeriodEnd,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    last_event_created_at: eventCreatedAt,
  };

  // Stripe does not guarantee webhook delivery order. Only apply this
  // event if it's newer than whatever last updated this subscription row
  // — otherwise a late-arriving but chronologically older event (e.g. a
  // stale "active" retry landing after a newer "canceled" event) would
  // silently revert the row to a wrong state.
  const { data: updatedRows, error: updateErr } = await supabaseAdmin
    .from("subscriptions")
    .update(fields)
    .eq("stripe_subscription_id", sub.id)
    .or(`last_event_created_at.is.null,last_event_created_at.lt.${eventCreatedAt}`)
    .select("id");

  let applied = !updateErr && !!updatedRows && updatedRows.length > 0;

  if (!updateErr && !applied) {
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    if (!existing) {
      const { error: insertErr } = await supabaseAdmin.from("subscriptions").insert(fields);
      applied = !insertErr;
    }
    // else: row exists but this event is older than what's already
    // stored — correctly skipped, no-op.
  }

  if (!applied) return;

  // Mirror a simple status onto the profile row for cheap reads elsewhere
  // in the app (admin member list, etc). users.subscription_status has a
  // CHECK constraint allowing only 'active' | 'inactive' | 'cancelled' —
  // Stripe's own vocabulary (canceled, trialing, past_due, unpaid, ...)
  // does not match those spellings/values, so it must be normalized here
  // rather than passed through raw (a raw pass-through silently failed
  // the constraint and left stale data, since this update's error wasn't
  // being checked).
  let simpleStatus: "active" | "inactive" | "cancelled";
  if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
    simpleStatus = "active";
  } else if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
    simpleStatus = "cancelled";
  } else {
    simpleStatus = "inactive";
  }
  const { error: userUpdateErr } = await supabaseAdmin
    .from("users")
    .update({ subscription_status: simpleStatus })
    .eq("id", userId);
  if (userUpdateErr) {
    console.error("stripe-webhook: failed to mirror subscription_status onto users:", userUpdateErr);
  }
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("stripe-webhook: signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub, event.created);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub, event.created);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subId =
            typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub, event.created);
        }
        break;
      }
      default:
        // Unhandled event types are fine to ignore.
        break;
    }
  } catch (err) {
    console.error("stripe-webhook: handler error for event", event.type, err);
    // Still return 200 below so Stripe doesn't endlessly retry an event we
    // can't process; the error is logged for investigation.
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
