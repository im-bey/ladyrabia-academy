// Replaces the old client-side createSignedUrl() calls, which relied on
// RLS + a Supabase Auth session for the storage buckets. Verifies the
// caller's Outseta token, checks membership + that the specific module is
// actually unlocked for them (not just "any paying member can fetch any
// asset URL" — re-derives the drip state server-side rather than trusting
// the client's claim that a module is unlocked), then mints signed URLs
// via the service role.

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

// Re-derive whether this specific module is unlocked for this user, the
// same way get-available-content does, so this function can't be used to
// fetch assets for a module that's still locked just because the caller
// is a paying member in general.
async function isModuleUnlockedForUser(userId: string, moduleId: string): Promise<boolean> {
  const { data: modules } = await supabaseAdmin
    .from("content_modules")
    .select("*")
    .eq("is_disabled", false);
  if (!modules) return false;

  const target = modules.find((m: any) => m.id === moduleId);
  if (!target || !target.is_published) return false;
  if (target.release_date && new Date() < new Date(target.release_date)) return false;

  const sequence = modules.slice().sort((a: any, b: any) => {
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    return a.week - b.week;
  });
  const index = sequence.findIndex((m: any) => m.id === moduleId);
  if (index === 0) return true;

  const prevModule = sequence[index - 1];
  const { data: prevProgress } = await supabaseAdmin
    .from("user_progress")
    .select("status")
    .eq("user_id", userId)
    .eq("module_id", prevModule.id)
    .maybeSingle();
  return isFullyComplete(prevProgress);
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

    if (!userRow || !ACCESS_STATUSES.has(userRow.subscription_status)) {
      return new Response(JSON.stringify({ error: "No active membership" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const moduleId = body.moduleId;
    if (!moduleId) {
      return new Response(JSON.stringify({ error: "moduleId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unlocked = await isModuleUnlockedForUser(userRow.id, moduleId);
    if (!unlocked) {
      return new Response(JSON.stringify({ error: "Module is locked for this member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: module, error: moduleErr } = await supabaseAdmin
      .from("content_modules")
      .select("audio_path, pdf_path, image_path")
      .eq("id", moduleId)
      .single();
    if (moduleErr || !module) {
      return new Response(JSON.stringify({ error: "Module not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assets: Record<string, unknown> = {};
    const jobs: Promise<void>[] = [];
    if (module.audio_path) {
      jobs.push(
        supabaseAdmin.storage.from(module.audio_path.split("/")[0]).createSignedUrl(module.audio_path, 600)
          .then((res) => { if (!res.error && res.data) assets.audioUrl = res.data; })
      );
    }
    if (module.pdf_path) {
      jobs.push(
        supabaseAdmin.storage.from(module.pdf_path.split("/")[0]).createSignedUrl(module.pdf_path, 600)
          .then((res) => { if (!res.error && res.data) assets.pdfUrl = res.data; })
      );
    }
    if (module.image_path) {
      jobs.push(
        supabaseAdmin.storage.from(module.image_path.split("/")[0]).createSignedUrl(module.image_path, 600)
          .then((res) => { if (!res.error && res.data) assets.imageUrl = res.data; })
      );
    }
    await Promise.all(jobs);

    return new Response(JSON.stringify({ data: assets }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-signed-assets error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
