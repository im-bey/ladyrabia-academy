# Lady Rabi'a Academy — Zulip Implementation Guide

**Status**: Ready for implementation  
**Date**: August 10, 2026  
**Based on**: `zulip-suhbah-config.md.txt`

---

## Overview

This guide provides step-by-step instructions for implementing the Zulip (Suhbah) community space for Lady Rabi'a Academy. The configuration follows the decisions outlined in the reference document.

---

## Part 1: Organization Setup (Manual - Zulip Admin Panel)

These settings must be configured through the Zulip web interface by someone with Owner or Administrator privileges.

### Access the Organization Settings
1. Log in to `ladyrabiaacademy.zulipchat.com`
2. Click the gear icon (⚙️) in the top right
3. Select "Organization settings"

### Configure Core Settings

| Setting | Location | Recommended Value |
|---------|----------|-------------------|
| **Organization name** | Organization profile | `Lady Rabi'a Academy` |
| **Organization URL** | Organization profile | `ladyrabiaacademy.zulipchat.com` (already set) |
| **Organization description** | Organization profile | Brief description of the suhbah space |
| **Realm icon** | Organization profile | Upload Lady Rabi'a Academy logo |

### Configure Access & Permissions

Navigate to: **Organization settings → Organization permissions**

| Setting | Recommended Value | Notes |
|---------|-------------------|-------|
| **Who can join** | Invite only | Critical: This is a paid community |
| **Are invitations required** | Yes | Prevents open registration |
| **Allow message editing** | Members, within 10 minutes | Allows quick corrections |
| **Who can create streams** | Administrators only | Razia + brother only |
| **Who can add custom emoji** | Administrators only | Keep branding consistent |
| **Message retention** | Keep indefinitely | No automatic deletion |

### Configure Notification Defaults

Navigate to: **Organization settings → Notification settings**

| Setting | Recommended Value |
|---------|-------------------|
| **Default stream notification** | Normal (not muted) |
| **New user default subscriptions** | Suhbah stream (configure after stream creation) |

---

## Part 2: Create Streams (Can be done via API or manually)

### Stream 1: Suhbah (Main Member Stream)

**Manual Creation:**
1. Click the + icon next to "STREAMS" in left sidebar
2. Configure:
   - **Stream name**: `Suhbah`
   - **Stream description**: `The suhbah space for Lady Rabi'a Academy members. Each unit has its own topic for reflection and discussion.`
   - **Who can access**: Private, shared history
   - **Who can post**: All members
   - **Announce stream**: No
   - **Default stream for new users**: Yes (check this box)

**Permissions to set:**
- ✅ Private stream (invite-only)
- ✅ Shared history (new subscribers can see past messages)
- ✅ All members can post
- ✅ Make this a default stream for new users

### Stream 2: Suhbah — Admin (Optional Private Stream)

**Manual Creation:**
1. Click the + icon next to "STREAMS" in left sidebar
2. Configure:
   - **Stream name**: `Suhbah — Admin`
   - **Stream description**: `Private admin space for testing topics and founder notes. Not visible to members.`
   - **Who can access**: Private, shared history
   - **Who can post**: Administrators only
   - **Announce stream**: No
   - **Default stream for new users**: No

**Subscribe only:**
- Razia (Owner)
- Brother (Administrator)

---

## Part 3: Create Topics in Suhbah Stream

Topics are created by posting the first message to a new topic name. Here are the required topics:

### Evergreen Topics (Create immediately)

#### 1. Start Here — Adab & Guidelines
**First message to post** (by Razia):
```
🌙 Welcome to the Suhbah space for Lady Rabi'a Academy

This is a space for reflection, suhbah, and shared learning as we journey through the teachings together.

**What this space is:**
- A place for thoughtful reflection on the units
- Sharing insights and questions that arise from the teachings
- Supporting one another in our spiritual growth

**What this space is not:**
- Not a therapy or counseling service
- Not a fatwa or religious ruling service
- Not a place to diagnose or advise on other members' personal situations

**Guidelines:**
- Maintain confidentiality — what's shared here stays here
- Practice respectful disagreement and curiosity
- Honor the diversity of our experiences and perspectives
- Remember we are all students on this path

May this space be a source of light and companionship on the journey. 🤲
```

**Action**: Pin this topic
1. Click the three dots (⋯) next to the topic name
2. Select "Pin topic to top of stream"

#### 2. Introduce Yourself
**First message to post**:
```
Assalamu alaikum! 👋

This is a space for new members to introduce themselves to the community. 

Feel free to share:
- Your name (or what you'd like to be called)
- Where you're joining from
- What drew you to Lady Rabi'a Academy
- Any reflections or intentions as you begin this journey

We're glad you're here! 🌟
```

#### 3. Dua Requests
**First message to post**:
```
🤲 This is a standing space for dua requests.

Share what's on your heart, and we'll hold you in our prayers. You can be as specific or as general as feels right.

May our collective duas be a source of strength and blessing for us all.
```

### Unit Topics (Create as units release)

#### Unit 0 — The North Star (Create immediately)
**First message to post**:
```
Welcome to the discussion space for Unit 0 — The North Star.

This is where we reflect on and discuss the teachings from this unit. Share your insights, questions, and reflections as you move through the content.

Remember: this is suhbah, not therapy or advice-giving. We're here to reflect together and support one another's learning.
```

#### Future Unit Topics
Create new topics following this pattern as each unit releases:
- **Topic name**: `Unit [number] — [Title]` (match the website exactly)
- **First message**: Welcome message similar to Unit 0, customized for the unit's theme

**Timing**: Create the topic before the first cohort of members reaches that unit (not when individual members unlock it).

---

## Part 4: Configure Stream Settings

### For Suhbah Stream

1. Click on "Suhbah" in the left sidebar
2. Click the gear icon next to the stream name
3. Configure:

**Stream settings:**
- ✅ Pin stream to top of stream list
- ✅ Subscribers automatically follow topics
- ✅ Enable notifications for new topics

**Topic settings:**
- Pin "Start Here — Adab & Guidelines" to top

---

## Part 5: User Management

### Adding New Members

**Manual Process (for low volume):**
1. Go to Organization settings → Users
2. Click "Invite users"
3. Enter member's email address
4. Select "Suhbah" stream to auto-subscribe
5. Send invitation

**Automated Process (future):**
When volume justifies automation, use Zulip API to:
- Send invitations automatically when Outseta marks user as active
- Auto-subscribe to Suhbah stream
- Send welcome message tagging them into "Introduce Yourself" topic

### Role Assignment

| Person | Role | Access Level |
|--------|------|--------------|
| Razia | Owner | Full control, billing, remove admins |
| Brother | Administrator | Technical setup, stream creation, API access |
| All paying members | Member | Post, reply, read in subscribed streams |

---

## Part 6: Integration with Members Area

### Add Suhbah Link to Website

**Location**: Members area dashboard (`3-membership-v2-dashboard.html` or `5-members-area.html`)

**Implementation**:
Add a prominent button/link that opens Zulip in a new tab:

```html
<a href="https://ladyrabiaacademy.zulipchat.com" 
   target="_blank" 
   rel="noopener noreferrer"
   class="suhbah-link-button">
  💬 Join the Suhbah Space
</a>
```

**Styling recommendation**:
- Make it visually prominent
- Use brand colors
- Include icon (💬 or similar)
- Clear call-to-action text

**User flow**:
1. Member completes payment → marked active in Outseta
2. Member sees link to Suhbah in members area
3. Member clicks link → opens Zulip in new tab
4. Member creates Zulip account (invite-only)
5. Member is auto-subscribed to Suhbah stream

---

## Part 7: Monthly Routine (Once Live)

### On Each Unit Release Day:
1. Create new topic in Suhbah stream: `Unit [X] — [Title]`
2. Post welcome message in the new topic
3. Verify new members have been added to Suhbah stream

### Periodic Checks:
- Monitor total message count (free plan limit: 10,000 searchable messages)
- Check for any moderation needs
- Ensure pinned topics remain at top

---

## Part 8: Verification Checklist

Use this checklist to confirm everything is configured correctly:

### Organization Settings
- [ ] Organization name set to "Lady Rabi'a Academy"
- [ ] Logo uploaded as realm icon
- [ ] Sign-up set to "Invite only"
- [ ] Organization not listed/discoverable publicly
- [ ] Message retention set to "Keep indefinitely"

### Streams Created
- [ ] "Suhbah" stream created (private, invite-only)
- [ ] "Suhbah" set as default stream for new users
- [ ] "Suhbah — Admin" stream created (optional, admin-only)

### Topics Created in Suhbah
- [ ] "Start Here — Adab & Guidelines" (pinned)
- [ ] "Introduce Yourself"
- [ ] "Dua Requests"
- [ ] "Unit 0 — The North Star"

### Permissions Configured
- [ ] Only administrators can create streams
- [ ] All members can post in Suhbah
- [ ] Message editing allowed within time window
- [ ] No automatic message deletion

### User Management
- [ ] Razia set as Owner
- [ ] Brother set as Administrator
- [ ] Process for inviting new members established

### Website Integration
- [ ] Link to Zulip added to members area
- [ ] Link opens in new tab
- [ ] Link is visually prominent

---

## Part 9: API Automation Scripts (Future Enhancement)

When ready to automate, use these Zulip API endpoints:

### Create Stream
```bash
curl -X POST https://ladyrabiaacademy.zulipchat.com/api/v1/users/me/subscriptions \
  -u BOT_EMAIL:API_KEY \
  -d "subscriptions=[{\"name\":\"Suhbah\",\"description\":\"Member suhbah space\"}]" \
  -d "invite_only=true" \
  -d "history_public_to_subscribers=true"
```

### Send Message (Create Topic)
```bash
curl -X POST https://ladyrabiaacademy.zulipchat.com/api/v1/messages \
  -u BOT_EMAIL:API_KEY \
  -d "type=stream" \
  -d "to=Suhbah" \
  -d "topic=Unit 1 — [Title]" \
  -d "content=Welcome message here"
```

### Invite User
```bash
curl -X POST https://ladyrabiaacademy.zulipchat.com/api/v1/invites \
  -u BOT_EMAIL:API_KEY \
  -d "invitee_emails=[\"user@example.com\"]" \
  -d "stream_ids=[SUHBAH_STREAM_ID]"
```

**Note**: API automation should only be implemented once manual process is working smoothly and volume justifies it.

---

## Part 10: Known Constraints & Decisions

### Topics Are Not Gated
- Anyone in Suhbah stream can see all topics (including future units)
- This is by design — seeing topic titles doesn't give access to actual teaching content
- Actual unit content remains gated on the website via Outseta
- No action needed; this is acceptable

### Free Plan Limitations
- 10,000 message search limit (older messages stored but not searchable)
- No custom domain (must use `.zulipchat.com`)
- Limited branding customization
- Monitor message count as membership grows

### Manual vs Automated Topic Creation
- **Start with manual**: Takes seconds per month at low volume
- **Automate later**: When membership and unit count both grow
- Decision point: When creating topics becomes time-consuming

---

## Support & Troubleshooting

### If members can't access Zulip:
1. Verify they received invitation email
2. Check they're using invite-only sign-up link
3. Confirm they're subscribed to Suhbah stream

### If topics aren't visible:
1. Verify user is subscribed to Suhbah stream
2. Check stream isn't muted
3. Confirm topic was created in correct stream

### For technical issues:
- Contact: support@zulip.com
- Documentation: https://zulip.com/help/
- API docs: https://zulip.com/api/

---

## Next Steps

1. **Brother**: Complete organization setup (Part 1)
2. **Brother**: Create Suhbah and Admin streams (Part 2)
3. **Razia**: Write and post evergreen topic messages (Part 3)
4. **Brother**: Add Suhbah link to members area (Part 6)
5. **Razia**: Test full flow with test account
6. **Both**: Review verification checklist (Part 8)
7. **Razia**: Begin inviting first cohort of members

---

**Implementation Time Estimate**: 2-3 hours for complete setup
**Maintenance Time**: ~10 minutes per month (creating new unit topics)
