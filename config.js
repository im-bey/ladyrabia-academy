/* ═══════════════════════════════════════════════
   LADY RABI'A ACADEMY — RUNTIME CONFIGURATION
   This template is processed by scripts/build.js at build time.
   The generated config.js is what the browser loads.
   Do NOT edit the generated config.js directly; edit this file
   or the environment variables instead.
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  window.LRA_CONFIG = {
    supabase: {
      url: 'https://swapiobhcpgufihykoqx.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXBpb2JoY3BndWZpaHlrb3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Njc3NTQsImV4cCI6MjA5OTQ0Mzc1NH0.axQuZbOJKLkcL8uC3BTq-GAnX44OylX-fQBXzBA1kp8',
      publishableKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXBpb2JoY3BndWZpaHlrb3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Njc3NTQsImV4cCI6MjA5OTQ0Mzc1NH0.axQuZbOJKLkcL8uC3BTq-GAnX44OylX-fQBXzBA1kp8',
      functionsUrl: 'https://swapiobhcpgufihykoqx.supabase.co/functions/v1'
    },
    zulip: {
      functionName: 'zulip-chat-v2',
      defaultStream: 'Suhbah'
    },
    outseta: {
      domain: ''
    },
    email: {
      from: 'hello@ladyrabiaacademy.com'
    },
    site: {
      // TODO: change to 'https://ladyrabiaacademy.com' (or launch domain) when the custom domain goes live
      publicUrl: 'https://ladyrabia.vercel.app'
    }
  };
})();
