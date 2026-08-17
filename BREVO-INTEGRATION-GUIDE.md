# Brevo Email Integration Guide

**Status**: Configured and Ready  
**Date**: August 10, 2026

---

## Overview

Brevo (formerly Sendinblue) is integrated into Lady Rabi'a Academy for automated email communications including:
- New content release notifications
- Welcome emails for new members
- Newsletter campaigns
- Promotional emails
- User onboarding sequences

---

## Configuration

### Environment Variables

The following variables are configured in `.env.example`:

```env
BREVO_API_KEY=your-brevo-api-key-here
BREVO_MCP_API_KEY=your-brevo-mcp-api-key-here
BREVO_SENDER_EMAIL=hello@ladyrabiaacademy.com
BREVO_SENDER_NAME=Lady Rabi'a Academy
```

**Important**: These keys are production keys. Keep them secure and never commit to version control.

---

## Files Created

### 1. `brevo-email-service.js`

Main email service module providing:

**Core Functions:**
- `sendEmail()` - Send transactional emails
- `sendNewContentNotification()` - Notify users of new content
- `sendWelcomeEmail()` - Welcome new members
- `syncContactToBrevo()` - Sync user data to Brevo contacts
- `updateContactInBrevo()` - Update existing contact
- `notifyMembersOfNewContent()` - Batch notify all members

**Usage Example:**
```javascript
// Send new content notification
await window.BrevoEmailService.sendNewContentNotification(user, content);

// Sync user to Brevo contacts
await window.BrevoEmailService.syncContactToBrevo(user);

// Notify all members of new content
await window.BrevoEmailService.notifyMembersOfNewContent(content);
```

---

## Integration Points

### 1. Supabase Integration

The Brevo service integrates with Supabase for:
- Fetching user data for email campaigns
- Syncing user profiles to Brevo contacts
- Tracking email delivery status

**Modified Functions:**
- `getAllUsers()` in `supabase-client.js` - Returns `{data, error}` format for consistency

### 2. Admin Dashboard Integration

Admins can trigger email notifications when:
- Publishing new content modules
- Creating new weeks
- Manually sending campaigns

**To Add Email Trigger to Admin Dashboard:**

Add this button to the content upload section in `admin-dashboard.html`:

```html
<button class="btn" id="notifyMembersBtn" style="background: #b5860d; color: white;">
  📧 Notify Members
</button>
```

Add this JavaScript:

```javascript
document.getElementById('notifyMembersBtn').addEventListener('click', async function() {
  const selectedSlug = document.getElementById('selectedSlug').value;
  if (!selectedSlug) {
    alert('Please select a module first');
    return;
  }
  
  const module = allModules.find(m => m.slug === selectedSlug);
  if (!module) return;
  
  if (!confirm(`Send email notification to all members about "${module.title}"?`)) {
    return;
  }
  
  const btn = this;
  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  const result = await window.BrevoEmailService.notifyMembersOfNewContent(module);
  
  if (result.error) {
    alert('Failed to send notifications: ' + result.error);
  } else {
    alert(`Sent ${result.data.length} email notifications`);
  }
  
  btn.disabled = false;
  btn.textContent = '📧 Notify Members';
});
```

### 3. User Registration Integration

**To sync new users to Brevo automatically:**

Add to user registration flow in `auth.js` or signup handlers:

```javascript
// After successful user creation in Supabase
const userData = await window.SupabaseClient.getCurrentUser();
if (userData && userData.profile) {
  // Sync to Brevo
  await window.BrevoEmailService.syncContactToBrevo(userData.profile);
  
  // Send welcome email
  await window.BrevoEmailService.sendWelcomeEmail(userData.profile);
}
```

---

## Brevo Dashboard Setup

### Contact Lists

Create these lists in your Brevo dashboard:

1. **All Members** (ID: 2) - Main list for all active members
2. **New Members** - For onboarding sequences
3. **Founding Members** - For special communications
4. **Newsletter Subscribers** - For general updates

### Email Templates

Create these templates in Brevo:

1. **Welcome Email** - Sent when user joins
2. **New Content Alert** - Sent when content is released
3. **Weekly Newsletter** - Weekly updates
4. **Promotional Campaign** - Special offers

### Automation Workflows (To Be Created)

Recommended workflows to set up in Brevo:

1. **New Member Onboarding**
   - Day 0: Welcome email
   - Day 3: Getting started guide
   - Day 7: First check-in

2. **Content Drip Sequence**
   - Triggered when new content is published
   - Sends to all active members

3. **Re-engagement Campaign**
   - Triggered for inactive members (no login in 30 days)

---

## API Endpoints Used

### Brevo API v3

**Base URL**: `https://api.brevo.com/v3`

**Endpoints:**
- `POST /smtp/email` - Send transactional email
- `POST /contacts` - Create contact
- `PUT /contacts/{email}` - Update contact
- `GET /contacts/lists` - Get contact lists

**Authentication**: 
- Header: `api-key: {BREVO_API_KEY}`

---

## Email Templates

### New Content Notification

**Subject**: `New Content: {content.title}`

**Design**: 
- Clean, minimal design matching brand
- Ivory background (#f9f5ed)
- Green CTA button (#1B3C28)
- Serif fonts (Georgia, Playfair Display)

**Content**:
- Greeting with user's name
- Content type and week number
- Content title and description
- CTA to members area
- Footer with unsubscribe

### Welcome Email

**Subject**: `Welcome to Lady Rabi'a Academy`

**Content**:
- Warm welcome message
- Brief introduction to the work
- Link to first content
- CTA to members area

---

## Testing

### Test Email Sending

```javascript
// Test basic email
await window.BrevoEmailService.sendEmail({
  to: 'test@example.com',
  toName: 'Test User',
  subject: 'Test Email',
  htmlContent: '<p>This is a test</p>'
});

// Test new content notification
const testUser = {
  email: 'test@example.com',
  name: 'Test User'
};

const testContent = {
  title: 'Test Content',
  type: 'Teaching',
  week: 1,
  note: 'This is a test'
};

await window.BrevoEmailService.sendNewContentNotification(testUser, testContent);
```

### Test Contact Sync

```javascript
const testUser = {
  email: 'test@example.com',
  name: 'Test',
  surname: 'User',
  contact_number: '+1234567890',
  role: 'member',
  created_at: new Date().toISOString()
};

await window.BrevoEmailService.syncContactToBrevo(testUser);
```

---

## Rate Limiting

Brevo free tier limits:
- **300 emails/day**
- **API calls**: No strict limit but recommended to stay under 1000/day

The service includes automatic rate limiting:
- 100ms delay between batch emails
- Error handling for rate limit responses

---

## Error Handling

All functions return `{data, error}` format:

```javascript
const result = await window.BrevoEmailService.sendEmail({...});

if (result.error) {
  console.error('Email failed:', result.error);
  // Handle error
} else {
  console.log('Email sent:', result.data);
  // Success
}
```

Common errors:
- `Brevo API key not configured` - Check .env file
- `Failed to send email` - Check Brevo dashboard for account status
- `duplicate_parameter` - Contact already exists (handled automatically)

---

## Security Considerations

1. **API Keys**: Never expose in client-side code
2. **Email Validation**: Always validate email addresses before sending
3. **Rate Limiting**: Respect Brevo's rate limits
4. **Unsubscribe**: Include unsubscribe links in all marketing emails
5. **GDPR Compliance**: Ensure user consent for email communications

---

## Next Steps

### Immediate Actions Needed

1. **Include Script in HTML Files**
   Add to `admin-dashboard.html` and other pages that need email functionality:
   ```html
   <script src="brevo-email-service.js"></script>
   ```

2. **Create Brevo Contact Lists**
   - Log in to Brevo dashboard
   - Create "All Members" list
   - Note the list ID and update in `brevo-email-service.js` (line 226)

3. **Set Up Email Templates** (Optional)
   - Create templates in Brevo dashboard
   - Get template IDs
   - Use with `sendEmail({templateId: X, params: {...}})`

4. **Add Email Triggers**
   - Add "Notify Members" button to admin dashboard
   - Add auto-sync on user registration
   - Add welcome email on signup

### Future Enhancements

1. **Email Analytics**
   - Track open rates
   - Track click rates
   - A/B testing

2. **Advanced Segmentation**
   - Send to specific user groups
   - Based on progress/engagement
   - Based on join date

3. **Automated Campaigns**
   - Set up in Brevo dashboard
   - Drip campaigns
   - Re-engagement sequences

---

## Support

**Brevo Documentation**: https://developers.brevo.com/  
**API Reference**: https://developers.brevo.com/reference/  
**Support**: support@brevo.com

---

## Changelog

**2026-08-10**: Initial Brevo integration setup
- Added API keys to .env
- Created brevo-email-service.js
- Updated supabase-client.js getAllUsers()
- Created integration documentation
