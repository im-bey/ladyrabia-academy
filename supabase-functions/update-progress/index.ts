// Replaces the old client-side updateCompletionStatus/addReflection/
// updateListenProgress/markAudioListenedFully calls, which wrote directly
// to user_progress under RLS. Verifies the caller's Outseta token, then
// performs the write via the service role. The sequential-completion and
// reflection/listen requirements enforced by the DB trigger from the
// Stripe-era build (enforce_sequential_completion) still apply unchanged —
// this function doesn't bypass it, it just authenticates differently.
//
// POST body: { action, moduleId, ...action-specific fields }
// actions: "get" | "complete" | "addReflection" | "updateReflection" |
//          "deleteReflection" | "getReflections" | "listenProgress" |
//          "markListenedFully"

import { createClient } from "npm:@supabase/supabase-js@2";
import { jwtVerify, createRemoteJWKSet } from "npm:jose@5";

const OUTSETA_DOMAIN = Deno.env.get("OUTSETA_DOMAIN")!;
const OUTSETA_API_KEY = Deno.env.get("OUTSETA_API_KEY")!;
const OUTSETA_API_SECRET = Deno.env.get("OUTSETA_API_SECRET")!;
const JWKS = createRemoteJWKSet(new URL(`https://${OUTSETA_DOMAIN}/.well-known/jwks`));

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getOrCreateProgress(userId: string, moduleUuid: string) {
  const { data } = await supabaseAdmin
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("module_id", moduleUuid)
    .maybeSingle();
  return data || { user_id: userId, module_id: moduleUuid, status: "in_progress", notes: { reflections: [] } };
}

// Posts a custom activity to the member's Outseta activity feed. An Outseta
// drip campaign (configured in the dashboard, not here) is triggered by the
// "ModuleUnlocked" title and stopped by "ReflectionSubmitted" — this is what
// drives the day-3/day-10/etc. reminder nudges. Fire-and-forget: a failure
// here must never block the underlying progress write.
async function postOutsetaActivity(personUid: string, title: string) {
  try {
    const res = await fetch(`https://${OUTSETA_DOMAIN}/api/v1/activities/customactivity`, {
      method: "POST",
      headers: {
        Authorization: `Outseta ${OUTSETA_API_KEY}:${OUTSETA_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Title: title, EntityType: 2, EntityUid: personUid, ActivityType: 10 }),
    });
    if (!res.ok) {
      console.error("postOutsetaActivity failed", title, res.status, await res.text());
    }
  } catch (e) {
    console.error("postOutsetaActivity error", title, e);
  }
}

// Finds the module immediately after `moduleUuid` in the global (month,
// week) sequence, and — if that user has no progress row for it yet —
// creates one with started_at=now. That timestamp is the per-user anchor
// get-available-content later reads for time-relative auto-release modules
// (e.g. "The Portrait" releasing N days after Week 4 became available).
async function provisionNextModule(userId: string, completedModuleUuid: string): Promise<boolean> {
  const { data: modules } = await supabaseAdmin
    .from("content_modules")
    .select("id, month, week")
    .eq("is_disabled", false)
    .order("month", { ascending: true })
    .order("week", { ascending: true });
  if (!modules) return false;

  const idx = modules.findIndex((m: any) => m.id === completedModuleUuid);
  const nextModule = idx >= 0 ? modules[idx + 1] : undefined;
  if (!nextModule) return false;

  const { data: existing } = await supabaseAdmin
    .from("user_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("module_id", nextModule.id)
    .maybeSingle();
  if (existing) return false;

  const now = new Date().toISOString();
  await supabaseAdmin.from("user_progress").insert({
    user_id: userId,
    module_id: nextModule.id,
    status: "available",
    started_at: now,
    notes: { reflections: [] },
  });
  return true;
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
    } catch {
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
    if (!userRow) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action, moduleId } = body;
    if (!action || !moduleId) {
      return new Response(JSON.stringify({ error: "action and moduleId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: moduleRow } = await supabaseAdmin
      .from("content_modules")
      .select("id")
      .eq("id", moduleId)
      .maybeSingle();
    // moduleId may already be the UUID (as sent by the dashboard) — fall
    // back to treating it as such if the slug lookup finds nothing.
    const moduleUuid = moduleRow?.id || moduleId;

    const progress = await getOrCreateProgress(userRow.id, moduleUuid);
    const now = new Date().toISOString();

    // Read-only actions return early.
    if (action === "get") {
      return new Response(JSON.stringify({ data: progress }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "getReflections") {
      return new Response(JSON.stringify({ data: progress.notes?.reflections || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let update: Record<string, unknown> = { user_id: userRow.id, module_id: moduleUuid, updated_at: now };

    if (action === "complete") {
      update.status = "completed";
      update.completed_at = now;
      update.has_reflection = progress.has_reflection === true;
      update.has_listened_fully = progress.has_listened_fully === true;
      update.notes = progress.notes || { reflections: [] };
    } else if (action === "addReflection") {
      const reflections = (progress.notes?.reflections || []).slice();
      reflections.push({ id: crypto.randomUUID(), content: String(body.content || "").trim(), timestamp: now });
      update.notes = { ...progress.notes, reflections };
      update.has_reflection = reflections.length > 0;
      update.status = progress.status || "in_progress";
    } else if (action === "updateReflection") {
      const reflections = (progress.notes?.reflections || []).slice();
      const idx = reflections.findIndex((r: any) => r.id === body.reflectionId);
      if (idx === -1) {
        return new Response(JSON.stringify({ error: "Reflection not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      reflections[idx] = { ...reflections[idx], content: String(body.content || "").trim(), edited: true, editedAt: now };
      update.notes = { ...progress.notes, reflections };
      update.has_reflection = progress.has_reflection === true;
      update.status = progress.status || "in_progress";
    } else if (action === "deleteReflection") {
      const reflections = (progress.notes?.reflections || []).filter((r: any) => r.id !== body.reflectionId);
      update.notes = { ...progress.notes, reflections };
      update.has_reflection = reflections.length > 0;
      update.status = progress.status || "in_progress";
    } else if (action === "listenProgress") {
      update.listen_progress_seconds = Math.floor(Number(body.seconds) || 0);
      update.has_reflection = progress.has_reflection === true;
      update.has_listened_fully = progress.has_listened_fully === true;
      update.notes = progress.notes || { reflections: [] };
      update.status = progress.status || "in_progress";
    } else if (action === "markListenedFully") {
      update.has_listened_fully = true;
      update.has_reflection = progress.has_reflection === true;
      update.notes = progress.notes || { reflections: [] };
      update.status = progress.status || "in_progress";
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("user_progress")
      .upsert(update, { onConflict: "user_id,module_id" });

    if (upsertErr) {
      // The sequential-completion trigger rejects out-of-order/incomplete
      // completions with a real Postgres error — surface it as-is so the
      // client can show why the action was refused.
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete") {
      const unlockedNext = await provisionNextModule(userRow.id, moduleUuid);
      if (unlockedNext) await postOutsetaActivity(personUid, "ModuleUnlocked");
    } else if (action === "addReflection") {
      await postOutsetaActivity(personUid, "ReflectionSubmitted");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("update-progress error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
