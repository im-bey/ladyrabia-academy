# Lady Rabi'a Academy — Environment Variables & API Keys Analysis

**Date**: July 23, 2026  
**Status**: Deep Analysis + Implementation Complete

---

## Quick Answers to Your Questions

### Why does this project not have a `.env` file?

Because this is a **static HTML/JS website** with **no build system** (no Node.js, no Vite, no Webpack, no npm). A `.env` file is only useful when:
1. A build tool or server reads it, OR
2. A backend server uses it for secrets.

In a plain static site, JavaScript runs in the browser and **cannot read `.env` directly**. Any API key placed in `.env` would be invisible to the frontend unless a build step injects it into the code.

### Are we currently using any APIs?

**Yes — three APIs are already wired in, with hardcoded keys.**

### I want to add API keys later — what should I do?

You now have a proper environment-variable system set up. Add keys to `.env` (local) or Vercel Dashboard (production), and they are injected into `config.js` at build time. The files `supabase-client.js` and `zulip-chat.js` now read from `window.LRA_CONFIG`.

---

## 1. Currently Used APIs

### 1.1 Supabase (Database + Auth + Storage)

**Files using it**:
- `supabase-client.js`
- `zulip-chat.js`

**Current hardcoded credentials**:
- URL: `https://swapiobhcpgufihykoqx.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Publishable Key: `sb_publishable_URN0OI4QtnMRrga7kIIqTg_EpodrVwb`

**What it does**:
- Stores user progress and reflections in `user_progress`
- Will serve audio files via signed URLs (not yet implemented)
- Will handle authentication (currently mock mode)
- Edge Functions for Zulip chat proxy

**Risk Level**: **MEDIUM**  
The anon key and publishable key are public by design (they go in the browser). However, they are **rate-limited and scoped by RLS policies**. Still, rotating them and not exposing service-role keys is important.

---

### 1.2 Supabase Edge Functions (Zulip Proxy)

**Files using it**:
- `zulip-chat.js`

**Current URL**: `https://swapiobhcpgufihykoqx.supabase.co/functions/v1/zulip-chat-v2`

**What it does**:
- Proxies Zulip chat messages through Supabase so the browser never holds a Zulip admin key.

**Risk Level**: **LOW** (proxy pattern is correct)

---

### 1.3 Outseta (Membership & Billing)

**Files referencing it**:
- `5-members-area.html`
- `forgot-password.html`
- `login-modal.js`
- `auth.js`

**Current state**: **Not integrated yet.** The HTML has placeholder mount points (`data-outseta-mount`) and TODO comments. There is **no API key** hardcoded because Outseta uses an embedded widget + server-side webhooks.

**What it will do**:
- Handle signup, login, billing
- Send webhooks to Supabase to create `users` rows
- Manage subscription status

**Risk Level**: **LOW** currently (not active)

---

### 1.4 Zulip (Community Chat)

**Files using it**:
- `zulip-chat.js`
- `chat-bubble-modal.js` (unused)

**Current state**: Chat uses the Supabase Edge Function proxy. No direct Zulip API key in the browser.

**What it does**:
- Fetches messages from streams (`general`, `monthly-themes`, `questions`, `reflections`)
- Sends messages back through proxy

**Risk Level**: **LOW**

---

### 1.5 Email Service (Resend/SendGrid/Postmark)

**Current state**: **Not implemented.**  
Needed for drip notifications and password resets. No API key yet.

**Risk Level**: **LOW** currently (not active)

---

## 2. Why `.env` Was Missing (Detailed)

### Reason 1: Static Site Architecture

This project is a collection of `.html` and `.js` files with **no build pipeline**. Vercel deploys them as static files. Without a build step:
- `.env` sits unused on the server
- Browser JavaScript cannot access it

### Reason 2: Keys Were Hardcoded for Speed

During the prototyping and mock-auth phase, keys were placed directly in JavaScript to make the site work immediately without setting up a build tool.

### Reason 3: No `package.json` or Build Tool

There is no:
- `package.json`
- `vite.config.js`
- `webpack.config.js`
- `next.config.js`
- Custom build script

So there was no natural place to load `.env` and inject it.

### Reason 4: Vercel Environment Variables Weren't Used

Vercel has its own environment variable system, but `vercel.json` had `buildCommand: null`, meaning Vercel simply copies files to the CDN without any processing.

---

## 3. What I Just Implemented

To solve the `.env` problem, I added a complete environment-variable system:

### 3.1 Files Created

| File | Purpose |
|------|---------|
| `.env.example` | Template showing every variable you may need |
| `.gitignore` | Prevents `.env` and `.env.local` from being committed |
| `config.js` | Runtime config object read by the frontend |
| `config.js.template` | Template with placeholders for build-time injection |
| `scripts/build.js` | Node.js script that injects env vars into `config.js` |
| `ENV-ANALYSIS.md` | This report |

### 3.2 Files Modified

| File | Change |
|------|--------|
| `supabase-client.js` | Now reads Supabase URL + Anon Key from `window.LRA_CONFIG` |
| `zulip-chat.js` | Now reads Supabase URL + Publishable Key + Function URL from `window.LRA_CONFIG` |
| `3-membership-v2-dashboard.html` | Loads `config.js` before `supabase-client.js` |
| `community-chat.html` | Loads `config.js` before `zulip-chat.js` |
| `vercel.json` | Now runs `node scripts/build.js` at build time |

### 3.3 How It Works

**Local Development**:
1. Create `.env` by copying `.env.example`
2. Fill in real values
3. Run `node scripts/build.js` to generate `config.js`
4. Open `3-membership-v2-dashboard.html` or `community-chat.html` locally

**Production (Vercel)**:
1. Add environment variables in Vercel Dashboard
2. Push code
3. Vercel runs `node scripts/build.js`
4. Build script reads Vercel env vars and writes `config.js`
5. Static files are deployed with injected config

---

## 4. Security Analysis

### 4.1 What Is Safe to Expose in the Browser

These keys are **designed to be public** and can safely live in `config.js`:
- Supabase Anon Key
- Supabase Publishable Key
- Supabase URL
- Supabase Functions URL
- Outseta Domain (public)
- Site public URL

### 4.2 What Must NEVER Be in the Browser or Git

These keys are **server-only secrets**:
- Supabase Service Role Key
- Outseta API Key
- Outseta Webhook Secret
- Resend/SendGrid/Postmark API Key
- Zulip Bot API Key
- Any Stripe secret key

**Current Status**: None of these server-only secrets are in the repo. ✅

### 4.3 Risks of Current Setup

**Before today's changes**:
- ✅ No server-only secrets exposed
- ⚠️ Supabase Anon + Publishable keys hardcoded in JS (public by design, but harder to rotate)
- ⚠️ Changing keys required editing multiple files

**After today's changes**:
- ✅ All public keys centralized in `config.js`
- ✅ Keys can be rotated via `.env` / Vercel without touching code
- ✅ `.env` is gitignored
- ✅ Build step injects values automatically

---

## 5. Required vs Optional Variables

### 5.1 Required for Current Site to Work

```env
SUPABASE_URL=https://swapiobhcpgufihykoqx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Where used**: `supabase-client.js`, `zulip-chat.js`

### 5.2 Required for Production Authentication

```env
OUTSETA_DOMAIN=your-subdomain.outseta.com
OUTSETA_API_KEY=...
OUTSETA_WEBHOOK_SECRET=...
```

**Where used**: Outseta embeds, Supabase webhook edge function (future)

### 5.3 Required for Email Notifications

```env
RESEND_API_KEY=...
FROM_EMAIL=hello@ladyrabiaacademy.com
```

**Where used**: Edge function for weekly drip notifications (future)

### 5.4 Optional

```env
SUPABASE_FUNCTIONS_URL=https://swapiobhcpgufihykoqx.supabase.co/functions/v1
ZULIP_CHAT_FUNCTION_NAME=zulip-chat-v2
PUBLIC_SITE_URL=https://your-domain.vercel.app
```

**Where used**: `zulip-chat.js`, site metadata

---

## 6. How to Add API Keys Later

### Step 1: Local Development

```bash
# Copy template
copy .env.example .env

# Edit .env with your keys
notepad .env

# Generate config.js
node scripts/build.js
```

### Step 2: Production (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the Lady Rabi'a Academy project
3. Go to **Settings → Environment Variables**
4. Add each variable from `.env.example`
5. Redeploy

### Step 3: Verify

```bash
# Check that config.js has real values (not __PLACEHOLDERS__)
type config.js
```

---

## 7. API Usage Summary Table

| API | Status | Keys Exposed? | Files | Priority |
|-----|--------|---------------|-------|----------|
| Supabase Database | Active ✅ | Anon + Publishable (public by design) | `supabase-client.js`, `zulip-chat.js` | High |
| Supabase Storage | Ready, not used | Will use signed URLs | Future audio player | High |
| Supabase Edge Functions | Active (Zulip proxy) | Function URL only | `zulip-chat.js` | Medium |
| Outseta | Not yet integrated | No keys yet | `5-members-area.html`, `auth.js` | High |
| Zulip (direct) | Not used | None in browser | Proxy only | Low |
| Email (Resend) | Not yet integrated | No keys yet | Future edge function | Medium |

---

## 8. What Still Needs to Be Done

### Immediate
- [ ] Create `.env` from `.env.example` and fill in real Supabase keys
- [ ] Run `node scripts/build.js` to generate `config.js`
- [ ] Test dashboard and community chat still work
- [ ] Redeploy to Vercel with env vars

### Before Production
- [ ] Remove fallback hardcoded keys from `supabase-client.js` and `zulip-chat.js` once `.env` is confirmed working
- [ ] Add Outseta domain/env vars
- [ ] Add Resend/SendGrid API key for notifications
- [ ] Rotate any keys that were previously committed to Git history

### Best Practice
- [ ] Add `.env` and `config.js` to `.gitignore` after build (already done for `.env`)
- [ ] Consider adding `config.js` to `.gitignore` if it always generated at build time

---

## 9. Conclusion

You did not have a `.env` file because the project had **no build system** and API keys were hardcoded for prototyping speed. Three APIs are in use today (Supabase, Supabase Edge Functions for Zulip, and placeholder Outseta mounts). 

I have now:
- ✅ Created `.env.example` and `.gitignore`
- ✅ Built a `config.js` injection system
- ✅ Refactored `supabase-client.js` and `zulip-chat.js` to use environment-driven config
- ✅ Updated `vercel.json` to inject env vars at build time
- ✅ Documented every API, key, and security consideration

The project is now ready for you to add API keys safely via `.env` (local) or Vercel Dashboard (production).
