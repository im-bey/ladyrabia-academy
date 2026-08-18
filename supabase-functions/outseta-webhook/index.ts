// Outseta webhook handler — the single source of truth for membership
// state in Supabase, replacing the earlier Stripe webhook. Outseta's
// Activity Notification payload shape isn't fully documented for every
// event type, so this treats the webhook purely as a "something changed"
// signal: it extracts whatever Account Uid it can find in the payload,
// then re-fetches that Account's authoritative current state directly
// from the Outseta API before writing to Supabase. This is more robust
// than trying to parse partial/uncertain webhook fields, and it means a
// missed or malformed field in the payload can't desync local state.
//
// Signature verification: HMAC-SHA256 of the raw request body, hex-encoded,
// prefixed "sha256=", in the `x-hub-signature-256` header — Outseta's
// documented scheme (same convention as GitHub webhooks).
//
// verify_jwt is OFF: Outseta calls this directly with no Supabase session;
// the HMAC signature is the authentication mechanism instead.

import { createClient } from "npm:@supabase/supabase-js@2";

const OUTSETA_DOMAIN = Deno.env.get("OUTSETA_DOMAIN")!; // e.g. lady-rabia-academy.outseta.com
const OUTSETA_API_KEY = Deno.env.get("OUTSETA_API_KEY")!;
const OUTSETA_API_SECRET = Deno.env.get("OUTSETA_API_SECRET")!;
const WEBHOOK_SIGNING_KEY_HEX = Deno.env.get("OUTSETA_WEBHOOK_SIGNING_KEY")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Account stages that should grant access. Matches Outseta's documented
// AccountStage enum: Trialing=2, Subscribing=3, Canceling=4 (still active
// until period end, mirrors the site's "cancel at period end" policy),
// PastDue=7 (payment retry grace period). Expired=5, TrialExpired=6,
// CancellingTrial=8 do not grant access.
const ACCESS_STAGES = new Set([2, 3, 4, 7]);

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(WEBHOOK_SIGNING_KEY_HEX),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" + bytesToHex(mac);
  // Constant-time-ish comparison is nice-to-have here; this endpoint is
  // low-volume and not a high-value timing-attack target, but avoid the
  // obvious short-circuit by comparing full strings via a fixed loop.
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

function extractAccountUid(payload: any): string | null {
  // Try the shapes Outseta's docs and examples show across different
  // notification types (registration callback, activity notification).
  if (payload?.Account?.Uid) return payload.Account.Uid;
  if (payload?.AccountUid) return payload.AccountUid;
  if (payload?._objectType === "Account" && payload?.Uid) return payload.Uid;
  return null;
}

async function fetchAccountState(accountUid: string) {
  const url =
    `https://${OUTSETA_DOMAIN}/api/v1/crm/accounts/${accountUid}` +
    `?fields=Uid,Name,AccountStage,AccountStageLabel,` +
    `PersonAccount.Person.Uid,PersonAccount.Person.Email,PersonAccount.IsPrimary,` +
    `CurrentSubscription.Uid,CurrentSubscription.Plan.Uid,CurrentSubscription.Plan.Name`;
  const res = await fetch(url, {
    headers: { Authorization: `Outseta ${OUTSETA_API_KEY}:${OUTSETA_API_SECRET}` },
  });
  if (!res.ok) {
    console.error("outseta-webhook: failed to fetch account", accountUid, res.status, await res.text());
    return null;
  }
  return await res.json();
}

Deno.serve(async (req: Request) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!(await verifySignature(rawBody, signature))) {
    console.error("outseta-webhook: signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const accountUid = extractAccountUid(payload);
  if (!accountUid) {
    console.warn("outseta-webhook: no Account Uid found in payload, ignoring", JSON.stringify(payload).slice(0, 300));
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const account = await fetchAccountState(accountUid);
  if (!account) {
    return new Response(JSON.stringify({ received: true, error: "account_fetch_failed" }), {
      status: 200, // Don't make Outseta retry forever on a transient fetch failure we've already logged.
      headers: { "Content-Type": "application/json" },
    });
  }

  const primaryPersonAccount = (account.PersonAccount || []).find((pa: any) => pa.IsPrimary) || account.PersonAccount?.[0];
  const personUid = primaryPersonAccount?.Person?.Uid;
  const personEmail = primaryPersonAccount?.Person?.Email;

  if (!personUid) {
    console.error("outseta-webhook: account has no primary person", accountUid);
    return new Response(JSON.stringify({ received: true, error: "no_primary_person" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const hasAccess = ACCESS_STAGES.has(Number(account.AccountStage));
  const simpleStatus = hasAccess ? "active" : "inactive";

  // Upsert the profile row, keyed by outseta_person_uid.
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        outseta_person_uid: personUid,
        outseta_account_uid: accountUid,
        email: personEmail,
        subscription_status: simpleStatus,
      },
      { onConflict: "outseta_person_uid" }
    )
    .select("id")
    .single();

  if (userErr || !userRow) {
    console.error("outseta-webhook: failed to upsert user", userErr);
    return new Response(JSON.stringify({ received: true, error: "user_upsert_failed" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const subscriptionUid = account.CurrentSubscription?.Uid;
  if (subscriptionUid) {
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userRow.id,
        outseta_account_uid: accountUid,
        outseta_subscription_uid: subscriptionUid,
        outseta_plan_uid: account.CurrentSubscription?.Plan?.Uid ?? null,
        status: account.AccountStageLabel ?? String(account.AccountStage),
        cancel_at_period_end: Number(account.AccountStage) === 4, // Canceling
      },
      { onConflict: "outseta_subscription_uid" }
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
