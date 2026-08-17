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
  '__SUPABASE_ANON_KEY__': env.SUPABASE_ANON_KEY || '',
  '__SUPABASE_PUBLISHABLE_KEY__': env.SUPABASE_PUBLISHABLE_KEY || '',
  '__SUPABASE_FUNCTIONS_URL__': env.SUPABASE_FUNCTIONS_URL || 'https://swapiobhcpgufihykoqx.supabase.co/functions/v1',
  '__ZULIP_CHAT_FUNCTION_NAME__': env.ZULIP_CHAT_FUNCTION_NAME || 'zulip-chat-v2',
  '__OUTSETA_DOMAIN__': env.OUTSETA_DOMAIN || '',
  '__FROM_EMAIL__': env.FROM_EMAIL || 'hello@ladyrabiaacademy.com',
  '__PUBLIC_SITE_URL__': env.PUBLIC_SITE_URL || 'https://ladyrabiaacademy.com',
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

Object.keys(replacements).forEach((key) => {
  configContent = configContent.replace(new RegExp(key.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'g'), replacements[key]);
});

fs.writeFileSync(configOutputPath, configContent, 'utf8');

console.log('✅ config.js generated with environment variables');
