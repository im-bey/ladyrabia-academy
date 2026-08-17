// Creates a Stripe Checkout Session for a membership plan and returns the
// redirect URL. Called by the client (signup / dashboard "upgrade") with a
// Supabase auth JWT — verify_jwt is enabled on this function, so Supabase
// has already authenticated the caller before this code runs.
//
// Only a fixed, server-known set of price IDs can be purchased (PLAN_PRICES
// below) — the client sends a plan slug, never a raw Stripe price ID, so a
// tampered request can't be used to buy an arbitrary/attacker-chosen price.

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const PLAN_PRICES: Record<string, string> = {
  founding: "price_1U5WeUCfVpWkvr0YXSgI4x8c", // £17/month
  standard: "price_1U5WebCfVpWkvr0YgxCGRIoi", // £25/month
};

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

    // Client scoped to the caller's own JWT — used only to identify who's calling.
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

    const body = await req.json().catch(() => ({}));
    const plan = body.plan;
    const priceId = PLAN_PRICES[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Unknown plan. Expected 'founding' or 'standard'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client — needed to read/write the profile row's
    // stripe_customer_id, which regular users can't write to directly.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("auth_id", user.id)
      .single();
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { supabase_user_id: profile.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", profile.id);
    }

    const origin = req.headers.get("origin") || body.origin || "https://ladyrabia.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/3-membership-v2-dashboard.html?checkout=success`,
      cancel_url: `${origin}/signup.html?checkout=cancelled`,
      metadata: { supabase_user_id: profile.id },
      subscription_data: { metadata: { supabase_user_id: profile.id } },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
