/**
 * Brevo Email Service for Lady Rabi'a Academy
 * 
 * Handles email sending via Brevo API for:
 * - New content release notifications
 * - Newsletter campaigns
 * - Promotional emails
 * - User onboarding sequences
 * 
 * Integrates with Supabase for user data and content tracking
 */

(function() {
  'use strict';

  // Brevo API Configuration (read from runtime config)
  const cfg = (window.LRA_CONFIG && window.LRA_CONFIG.email && window.LRA_CONFIG.email.brevo) || {};
  const BREVO_API_KEY = cfg.apiKey || '';
  const BREVO_API_URL = 'https://api.brevo.com/v3';
  const SENDER_EMAIL = cfg.senderEmail || 'hello@ladyrabiaacademy.com';
  const SENDER_NAME = cfg.senderName || "Lady Rabi'a Academy";

  function isKeyConfigured(key) {
    if (!key) return false;
    // If build-time placeholder leaked through, don't treat as configured
    if (typeof key === 'string' && key.startsWith('__') && key.endsWith('__')) return false;
    // Very basic heuristic: Brevo keys start with 'xkeysib-'
    if (typeof key === 'string' && !key.startsWith('xkeysib-')) return false;
    return true;
  }

  /**
   * Send a transactional email via Brevo
   * @param {Object} params - Email parameters
   * @param {string} params.to - Recipient email
   * @param {string} params.toName - Recipient name
   * @param {string} params.subject - Email subject
   * @param {string} params.htmlContent - HTML email body
   * @param {string} params.textContent - Plain text email body (optional)
   * @param {number} params.templateId - Brevo template ID (optional)
   * @param {Object} params.params - Template parameters (optional)
   * @returns {Promise<Object>} Response from Brevo API
   */
  async function sendEmail({ to, toName, subject, htmlContent, textContent, templateId, params }) {
    if (!isKeyConfigured(BREVO_API_KEY)) {
      console.error('[Brevo] API key not configured');
      return { error: 'Brevo API key not configured' };
    }

    try {
      const payload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        to: [{
          email: to,
          name: toName || to
        }]
      };

      // Use template if provided, otherwise use content
      if (templateId) {
        payload.templateId = templateId;
        payload.params = params || {};
      } else {
        payload.subject = subject;
        payload.htmlContent = htmlContent;
        if (textContent) {
          payload.textContent = textContent;
        }
      }

      const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Brevo] Send failed:', errorData);
        return { error: errorData.message || 'Failed to send email' };
      }

      const data = await response.json();
      console.log('[Brevo] Email sent successfully:', data.messageId);
      return { data, error: null };

    } catch (error) {
      console.error('[Brevo] Send error:', error);
      return { error: error.message };
    }
  }

  /**
   * Send new content release notification to a user
   * @param {Object} user - User object from Supabase
   * @param {Object} content - Content module object
   */
  async function sendNewContentNotification(user, content) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Georgia, serif; color: #1c1a14; background: #f9f5ed; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .logo { font-family: 'Playfair Display', serif; font-style: italic; font-size: 24px; color: #1B3C28; }
          .content { background: white; padding: 40px; border: 1px solid rgba(201,168,76,.3); }
          h1 { font-family: 'Playfair Display', serif; font-style: italic; color: #1B3C28; font-size: 28px; margin-bottom: 20px; }
          p { line-height: 1.8; color: #5a5240; margin-bottom: 20px; }
          .cta { display: inline-block; padding: 14px 32px; background: #1B3C28; color: white; text-decoration: none; border-radius: 2px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 40px; font-size: 13px; color: #5a5240; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Lady Rabi'a Academy</div>
          </div>
          <div class="content">
            <h1>New Content Available: ${content.title}</h1>
            <p>Assalamu alaikum ${user.name || 'dear member'},</p>
            <p>A new ${content.type.toLowerCase()} has been released for Week ${content.week}.</p>
            <p><strong>${content.title}</strong></p>
            ${content.note ? `<p>${content.note}</p>` : ''}
            <p>This content is now available in your members area. Take your time with it, and remember: this is suhbah, not a race.</p>
            <a href="https://ladyrabiaacademy.com/3-membership-v2-dashboard.html" class="cta">View in Members Area</a>
          </div>
          <div class="footer">
            <p>You're receiving this because you're a member of Lady Rabi'a Academy.</p>
            <p>© ${new Date().getFullYear()} Lady Rabi'a Academy</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      New Content Available: ${content.title}
      
      Assalamu alaikum ${user.name || 'dear member'},
      
      A new ${content.type.toLowerCase()} has been released for Week ${content.week}.
      
      ${content.title}
      ${content.note || ''}
      
      This content is now available in your members area. Take your time with it, and remember: this is suhbah, not a race.
      
      View in Members Area: https://ladyrabiaacademy.com/3-membership-v2-dashboard.html
      
      You're receiving this because you're a member of Lady Rabi'a Academy.
      © ${new Date().getFullYear()} Lady Rabi'a Academy
    `;

    return await sendEmail({
      to: user.email,
      toName: user.name,
      subject: `New Content: ${content.title}`,
      htmlContent,
      textContent
    });
  }

  /**
   * Send welcome email to new member
   * @param {Object} user - User object from Supabase
   */
  async function sendWelcomeEmail(user) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Georgia, serif; color: #1c1a14; background: #f9f5ed; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .logo { font-family: 'Playfair Display', serif; font-style: italic; font-size: 24px; color: #1B3C28; }
          .content { background: white; padding: 40px; border: 1px solid rgba(201,168,76,.3); }
          h1 { font-family: 'Playfair Display', serif; font-style: italic; color: #1B3C28; font-size: 28px; margin-bottom: 20px; }
          p { line-height: 1.8; color: #5a5240; margin-bottom: 20px; }
          .cta { display: inline-block; padding: 14px 32px; background: #1B3C28; color: white; text-decoration: none; border-radius: 2px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 40px; font-size: 13px; color: #5a5240; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Lady Rabi'a Academy</div>
          </div>
          <div class="content">
            <h1>Welcome to the Work</h1>
            <p>Assalamu alaikum ${user.name || 'dear member'},</p>
            <p>Welcome to Lady Rabi'a Academy. You've taken the first step in a journey that matters more than any method or strategy: the work of becoming the person your children are growing up alongside.</p>
            <p>Your first content is now available in your members area. Take your time. This is suhbah, not a race.</p>
            <a href="https://ladyrabiaacademy.com/3-membership-v2-dashboard.html" class="cta">Enter Members Area</a>
          </div>
          <div class="footer">
            <p>May this work be a source of light for you and your family.</p>
            <p>© ${new Date().getFullYear()} Lady Rabi'a Academy</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await sendEmail({
      to: user.email,
      toName: user.name,
      subject: 'Welcome to Lady Rabi\'a Academy',
      htmlContent
    });
  }

  /**
   * Add or update contact in Brevo
   * Syncs user data from Supabase to Brevo contacts
   * @param {Object} user - User object from Supabase
   */
  async function syncContactToBrevo(user) {
    if (!BREVO_API_KEY) {
      console.error('[Brevo] API key not configured');
      return { error: 'Brevo API key not configured' };
    }

    try {
      const contactData = {
        email: user.email,
        attributes: {
          FIRSTNAME: user.name || '',
          LASTNAME: user.surname || '',
          SMS: user.contact_number || '',
          MEMBER_SINCE: user.created_at || new Date().toISOString(),
          ROLE: user.role || 'member',
          IS_ACTIVE: user.is_active !== false
        },
        listIds: [2], // Main members list - update this ID based on your Brevo setup
        updateEnabled: true
      };

      const response = await fetch(`${BREVO_API_URL}/contacts`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify(contactData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Contact already exists is not an error
        if (errorData.code === 'duplicate_parameter') {
          console.log('[Brevo] Contact already exists, updating...');
          return await updateContactInBrevo(user);
        }
        console.error('[Brevo] Sync failed:', errorData);
        return { error: errorData.message || 'Failed to sync contact' };
      }

      const data = await response.json();
      console.log('[Brevo] Contact synced successfully:', user.email);
      return { data, error: null };

    } catch (error) {
      console.error('[Brevo] Sync error:', error);
      return { error: error.message };
    }
  }

  /**
   * Update existing contact in Brevo
   * @param {Object} user - User object from Supabase
   */
  async function updateContactInBrevo(user) {
    try {
      const contactData = {
        attributes: {
          FIRSTNAME: user.name || '',
          LASTNAME: user.surname || '',
          SMS: user.contact_number || '',
          ROLE: user.role || 'member',
          IS_ACTIVE: user.is_active !== false
        }
      };

      const response = await fetch(`${BREVO_API_URL}/contacts/${encodeURIComponent(user.email)}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify(contactData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Brevo] Update failed:', errorData);
        return { error: errorData.message || 'Failed to update contact' };
      }

      console.log('[Brevo] Contact updated successfully:', user.email);
      return { data: { updated: true }, error: null };

    } catch (error) {
      console.error('[Brevo] Update error:', error);
      return { error: error.message };
    }
  }

  /**
   * Notify all active members about new content release
   * @param {Object} content - Content module object
   */
  async function notifyMembersOfNewContent(content) {
    if (!window.SupabaseClient) {
      console.error('[Brevo] Supabase client not available');
      return { error: 'Supabase client not available' };
    }

    try {
      // Get all active members
      const { data: users, error } = await window.SupabaseClient.getAllUsers();
      
      if (error) {
        console.error('[Brevo] Failed to fetch users:', error);
        return { error: 'Failed to fetch users' };
      }

      const results = [];
      for (const user of users) {
        if (user.email && user.is_active !== false) {
          const result = await sendNewContentNotification(user, content);
          results.push({ email: user.email, ...result });
          
          // Rate limiting - wait 100ms between emails
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('[Brevo] Sent', results.length, 'notifications');
      return { data: results, error: null };

    } catch (error) {
      console.error('[Brevo] Notification error:', error);
      return { error: error.message };
    }
  }

  // Export API
  window.BrevoEmailService = {
    sendEmail,
    sendNewContentNotification,
    sendWelcomeEmail,
    syncContactToBrevo,
    updateContactInBrevo,
    notifyMembersOfNewContent
  };

})();
