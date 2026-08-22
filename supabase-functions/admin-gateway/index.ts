// Admin-only gateway for content_modules/storage/users management from
// admin-dashboard.html. Since admin login moved to Outseta (no Supabase
// Auth session for Outseta-authenticated admins), the existing RLS
// policies on content_modules/users — all keyed off auth.uid() — can't
// authorize these writes anymore. This function verifies the caller's
// Outseta JWT directly and performs the write via the service role,
// mirroring get-available-content/update-progress. Only accounts with
// role='admin' in public.users may use it.
//
// verify_jwt is OFF — no Supabase JWT exists for Outseta-authenticated
// callers; this function does its own authentication against Outseta.
//
// Two request shapes:
// - multipart/form-data: { action: "uploadAsset", file, bucket, path }
// - application/json: { action, ...action-specific fields }

import { createClient } from "npm:@supabase/supabase-js@2";
import { jwtVerify, createRemoteJWKSet } from "npm:jose@5";

const OUTSETA_DOMAIN = Deno.env.get("OUTSETA_DOMAIN")!;
const JWKS = createRemoteJWKSet(new URL(`https://${OUTSETA_DOMAIN}/.well-known/jwks`));

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: json({ error: "Missing bearer token" }, 401) };
  }
  const token = authHeader.slice("Bearer ".length);

  let personUid: string;
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://${OUTSETA_DOMAIN}` });
    personUid = payload.sub as string;
  } catch {
    return { error: json({ error: "Invalid token" }, 401) };
  }

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("outseta_person_uid", personUid)
    .maybeSingle();

  if (!userRow || userRow.role !== "admin") {
    return { error: json({ error: "Admin privileges required" }, 403) };
  }
  return { userId: userRow.id };
}

function slugFor(month: string, week: number, type: string) {
  return `${month.replace("-", "")}-w${week}-${type.toLowerCase()}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = String(form.get("action") || "");
      if (action === "uploadAsset") {
        const file = form.get("file");
        const bucket = String(form.get("bucket") || "");
        const path = String(form.get("path") || "");
        if (!(file instanceof File) || !bucket || !path) {
          return json({ error: "file, bucket, and path required" }, 400);
        }
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .upload(path, file, { cacheControl: "3600", upsert: true });
        if (error) return json({ error: error.message }, 422);
        return json({ data: { path: data.path } });
      }
      return json({ error: "Unknown multipart action" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "getModulesAdmin") {
      let query = supabaseAdmin.from("content_modules").select("*").order("month", { ascending: true }).order("week", { ascending: true });
      if (body.month) query = query.eq("month", body.month);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 422);
      return json({ data });
    }

    if (action === "createContentModule") {
      const m = body.moduleData || {};
      const slug = slugFor(m.month, m.week, m.type);
      const { data, error } = await supabaseAdmin
        .from("content_modules")
        .insert({
          slug,
          month: m.month,
          week: m.week,
          type: m.type,
          title: m.title || "",
          description: m.description || "",
          reflection_prompt: m.reflectionPrompt || null,
          auto_release_after_days: m.autoReleaseAfterDays || null,
          release_date: m.releaseDate || new Date().toISOString(),
          order_index: m.week || 1,
          is_published: false,
          is_disabled: false,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 422);
      return json({ data });
    }

    if (action === "updateContentModule") {
      const { data, error } = await supabaseAdmin
        .from("content_modules")
        .update({ ...body.fields, updated_at: new Date().toISOString() })
        .eq("slug", body.slug)
        .select()
        .single();
      if (error) return json({ error: error.message }, 422);
      return json({ data });
    }

    if (action === "deleteContentModule") {
      const { error } = await supabaseAdmin.from("content_modules").delete().eq("slug", body.slug);
      if (error) return json({ error: error.message }, 422);
      return json({ success: true });
    }

    if (action === "getSignedAssetsForModule") {
      const m = body.moduleData || {};
      const assets: Record<string, unknown> = {};
      const jobs: Promise<void>[] = [];
      const sign = async (key: string, path: string) => {
        const bucket = path.split("/")[0];
        const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 600);
        if (!error && data) assets[key] = data;
      };
      if (m.audio_path) jobs.push(sign("audioUrl", m.audio_path));
      if (m.pdf_path) jobs.push(sign("pdfUrl", m.pdf_path));
      if (m.image_path) jobs.push(sign("imageUrl", m.image_path));
      await Promise.all(jobs);
      return json({ data: assets });
    }

    if (action === "deleteAsset") {
      const { error } = await supabaseAdmin.storage.from(body.bucket).remove([body.path]);
      if (error) return json({ error: error.message }, 422);
      return json({ success: true });
    }

    if (action === "getAllUsers") {
      const { data, error } = await supabaseAdmin.from("users").select("*").order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 422);
      return json({ data: data || [] });
    }

    if (action === "updateUserRole") {
      const { data, error } = await supabaseAdmin
        .from("users")
        .update({ role: body.newRole, updated_at: new Date().toISOString() })
        .eq("id", body.userId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 422);
      return json({ data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("admin-gateway error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
