// Replaces the old client-side getAvailableContent() call, which relied on
// RLS + a Supabase Auth session. With Outseta as the identity provider,
// there is no Supabase session, so this Edge Function is the gate instead:
// it verifies the caller's Outseta access token directly against Outseta's
// JWKS, checks their synced subscription status, and only then computes
// and returns the drip-gated content list via the service role.
//
// verify_jwt is OFF at the Supabase level (there is no Supabase JWT to
// check) — this function does its own authentication against Outseta.

import { createClient } from "npm:@supabase/supabase-js@2";
import { jwtVerify, createRemoteJWKSet } from "npm:jose@5";

const OUTSETA_DOMAIN = Deno.env.get("OUTSETA_DOMAIN")!;
const JWKS = createRemoteJWKSet(new URL(`https://${OUTSETA_DOMAIN}/.well-known/jwks`));

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ACCESS_STATUSES = new Set(["active", "trialing", "Trialing", "Subscribing", "Canceling", "PastDue", "past_due"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isFullyComplete(progress: any) {
  return !!(progress && progress.status === "completed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length);

    let personUid: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: `https://${OUTSETA_DOMAIN}` });
      personUid = payload.sub as string;
    } catch (err) {
      console.error("get-available-content: token verification failed", err);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id, subscription_status")
      .eq("outseta_person_uid", personUid)
      .maybeSingle();

    if (!userRow || !ACCESS_STATUSES.has(userRow.subscription_status)) {
      return new Response(JSON.stringify({ error: "No active membership" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: modules, error: modulesErr } = await supabaseAdmin
      .from("content_modules")
      .select("*")
      .order("month", { ascending: true })
      .order("week", { ascending: true });
    if (modulesErr) throw modulesErr;

    const { data: progressRows } = await supabaseAdmin
      .from("user_progress")
      .select("*")
      .eq("user_id", userRow.id);
    const progressByModuleId: Record<string, any> = {};
    (progressRows || []).forEach((r: any) => { progressByModuleId[r.module_id] = r; });

    const now = new Date();
    const activeModules = (modules || []).filter((m: any) => !m.is_disabled);
    const sequence = activeModules.slice().sort((a: any, b: any) => {
      if (a.month !== b.month) return a.month < b.month ? -1 : 1;
      return a.week - b.week;
    });
    const prevModuleById: Record<string, any> = {};
    for (let i = 1; i < sequence.length; i++) {
      prevModuleById[sequence[i].id] = sequence[i - 1];
    }

    const result = activeModules.map((module: any) => {
      const userProgress = progressByModuleId[module.id] || { status: "available" };
      let state = "locked";
      let unlockAfter: string | null = null;

      const isReleased = !module.release_date || now >= new Date(module.release_date);

      if (!module.is_published) {
        state = "locked";
        unlockAfter = "Not yet released";
      } else if (!isReleased) {
        state = "locked";
        unlockAfter = "Releases soon";
      } else if (isFullyComplete(userProgress)) {
        state = "complete";
      } else {
        const prevModule = prevModuleById[module.id];
        if (!prevModule) {
          state = "current";
        } else if (isFullyComplete(progressByModuleId[prevModule.id])) {
          state = "current";
        } else {
          state = "locked";
          unlockAfter = `Complete Week ${prevModule.week} (${prevModule.month}) to unlock`;
        }
      }

      return {
        id: module.id,
        month: module.month,
        week: module.week,
        type: module.type,
        state,
        title: module.title,
        note: module.note,
        unlockAfter,
        status: userProgress.status || "available",
        moduleData: module,
      };
    });

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-available-content error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
