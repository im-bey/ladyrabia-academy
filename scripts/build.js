/* ═══════════════════════════════════════════════
   BUILD SCRIPT — Injects environment variables into config.js
   Run via: node scripts/build.js
   Vercel runs this automatically (see vercel.json buildCommand).
   ═══════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const configTemplatePath = path.join(projectRoot, 'config.js.template');
const configOutputPath = path.join(projectRoot, 'config.js');

// Determine if we are in a Vercel build or local build
const env = process.env;

const replacements = {
  '__SUPABASE_URL__': env.SUPABASE_URL || 'https://swapiobhcpgufihykoqx.supabase.co',
  // The anon/publishable key is safe to expose client-side (protected by
  // RLS) and is already public in supabase-client.js's own fallback, so
  // defaulting it here means config.js works even if the Vercel project
  // has no SUPABASE_ANON_KEY env var configured.
  '__SUPABASE_ANON_KEY__': env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXBpb2JoY3BndWZpaHlrb3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Njc3NTQsImV4cCI6MjA5OTQ0Mzc1NH0.axQuZbOJKLkcL8uC3BTq-GAnX44OylX-fQBXzBA1kp8',
  '__SUPABASE_PUBLISHABLE_KEY__': env.SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXBpb2JoY3BndWZpaHlrb3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Njc3NTQsImV4cCI6MjA5OTQ0Mzc1NH0.axQuZbOJKLkcL8uC3BTq-GAnX44OylX-fQBXzBA1kp8',
  '__SUPABASE_FUNCTIONS_URL__': env.SUPABASE_FUNCTIONS_URL || 'https://swapiobhcpgufihykoqx.supabase.co/functions/v1',
  '__ZULIP_CHAT_FUNCTION_NAME__': env.ZULIP_CHAT_FUNCTION_NAME || 'zulip-chat-v2',
  '__OUTSETA_DOMAIN__': env.OUTSETA_DOMAIN || '',
  '__FROM_EMAIL__': env.FROM_EMAIL || 'hello@ladyrabiaacademy.com',
  // TODO: switch this default to the custom domain once it's actually
  // live; ladyrabiaacademy.com isn't serving the site yet, and defaulting
  // to it here would silently break Google OAuth redirects and password
  // reset links (this value overrides supabase-client.js's own correct
  // ladyrabia.vercel.app fallback).
  '__PUBLIC_SITE_URL__': env.PUBLIC_SITE_URL || 'https://ladyrabia.vercel.app',
  '__BREVO_API_KEY__': env.BREVO_API_KEY || '',
  '__BREVO_SENDER_EMAIL__': env.BREVO_SENDER_EMAIL || 'hello@ladyrabiaacademy.com',
  '__BREVO_SENDER_NAME__': env.BREVO_SENDER_NAME || "Lady Rabi'a Academy"
};

let configContent;

if (fs.existsSync(configTemplatePath)) {
  configContent = fs.readFileSync(configTemplatePath, 'utf8');
} else {
  // Fallback to reading existing config.js as template
  configContent = fs.readFileSync(configOutputPath, 'utf8');
}

function escapeForSingleQuotedJs(value) {
  // Values (e.g. "Lady Rabi'a Academy") can contain single quotes, which
  // would otherwise close the template's '...' string literal early and
  // produce a JS syntax error that breaks the entire site.
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

Object.keys(replacements).forEach((key) => {
  var safeValue = escapeForSingleQuotedJs(replacements[key]);
  configContent = configContent.replace(new RegExp(key.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'g'), safeValue);
});

fs.writeFileSync(configOutputPath, configContent, 'utf8');

console.log('✅ config.js generated with environment variables');
