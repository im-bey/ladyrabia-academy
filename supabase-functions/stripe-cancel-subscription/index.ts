// Cancels (or resumes) the caller's active Stripe subscription — at period
// end, per the site's chosen policy (member keeps access through what
// they already paid for). This function only calls Stripe; it does NOT
// write the change into Supabase directly. Stripe fires a
// customer.subscription.updated event the moment cancel_at_period_end
// flips, which stripe-webhook picks up and syncs — that's what keeps
// "unsubscribing" a genuinely automated, webhook-driven flow instead of
// two separate systems that can drift out of sync.
//
// POST body: {} to cancel at period end, or { "resume": true } to undo a
// scheduled cancellation (available any time before the period actually ends).

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const resume = body?.resume === true;

    const { data: subRow, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, status, cancel_at_period_end")
      .eq("user_id", profile.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !subRow) {
      return new Response(JSON.stringify({ error: "No active subscription found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resume) {
      if (!subRow.cancel_at_period_end) {
        return new Response(JSON.stringify({ message: "Subscription is not scheduled to cancel" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await stripe.subscriptions.update(subRow.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      return new Response(JSON.stringify({ message: "Subscription resumed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (subRow.cancel_at_period_end) {
      return new Response(JSON.stringify({ message: "Already scheduled to cancel at period end" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updated = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    return new Response(
      JSON.stringify({
        message: "Subscription will cancel at the end of the current billing period",
        current_period_end: updated.items.data[0]?.current_period_end
          ? new Date(updated.items.data[0].current_period_end * 1000).toISOString()
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("stripe-cancel-subscription error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
