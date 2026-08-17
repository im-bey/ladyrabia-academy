/**
 * Zulip API Helper Scripts for Lady Rabi'a Academy
 * 
 * These scripts can be used to automate Zulip configuration once the API connection is fixed.
 * Requires: Zulip API credentials (bot email and API key)
 * 
 * Configuration needed:
 * - ZULIP_SITE: https://ladyrabiaacademy.zulipchat.com
 * - ZULIP_BOT_EMAIL: bot email from Zulip settings
 * - ZULIP_API_KEY: API key from Zulip settings
 */

// Configuration (replace with actual values)
const ZULIP_CONFIG = {
  site: 'https://ladyrabiaacademy.zulipchat.com',
  botEmail: 'YOUR_BOT_EMAIL',
  apiKey: 'YOUR_API_KEY'
};

/**
 * Create the main Suhbah stream
 */
async function createSuhbahStream() {
  const streamData = {
    subscriptions: JSON.stringify([{
      name: 'Suhbah',
      description: 'The suhbah space for Lady Rabi\'a Academy members. Each unit has its own topic for reflection and discussion.'
    }]),
    invite_only: true,
    history_public_to_subscribers: true,
    is_default_stream: true,
    announce: false
  };

  const response = await fetch(`${ZULIP_CONFIG.site}/api/v1/users/me/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${ZULIP_CONFIG.botEmail}:${ZULIP_CONFIG.apiKey}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(streamData)
  });

  const result = await response.json();
  console.log('Suhbah stream created:', result);
  return result;
}

/**
 * Create the admin stream
 */
async function createAdminStream() {
  const streamData = {
    subscriptions: JSON.stringify([{
      name: 'Suhbah — Admin',
      description: 'Private admin space for testing topics and founder notes. Not visible to members.'
    }]),
    invite_only: true,
    history_public_to_subscribers: true,
    is_default_stream: false,
    announce: false
  };

  const response = await fetch(`${ZULIP_CONFIG.site}/api/v1/users/me/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${ZULIP_CONFIG.botEmail}:${ZULIP_CONFIG.apiKey}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(streamData)
  });

  const result = await response.json();
  console.log('Admin stream created:', result);
  return result;
}

/**
 * Create a topic by sending the first message
 */
async function createTopic(streamName, topicName, messageContent) {
  const messageData = {
    type: 'stream',
    to: streamName,
    topic: topicName,
    content: messageContent
  };

  const response = await fetch(`${ZULIP_CONFIG.site}/api/v1/messages`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${ZULIP_CONFIG.botEmail}:${ZULIP_CONFIG.apiKey}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(messageData)
  });

  const result = await response.json();
  console.log(`Topic "${topicName}" created in ${streamName}:`, result);
  return result;
}

/**
 * Create all evergreen topics
 */
async function createEvergreenTopics() {
  const topics = [
    {
      name: 'Start Here — Adab & Guidelines',
      content: `🌙 Welcome to the Suhbah space for Lady Rabi'a Academy

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

May this space be a source of light and companionship on the journey. 🤲`
    },
    {
      name: 'Introduce Yourself',
      content: `Assalamu alaikum! 👋

This is a space for new members to introduce themselves to the community. 

Feel free to share:
- Your name (or what you'd like to be called)
- Where you're joining from
- What drew you to Lady Rabi'a Academy
- Any reflections or intentions as you begin this journey

We're glad you're here! 🌟`
    },
    {
      name: 'Dua Requests',
      content: `🤲 This is a standing space for dua requests.

Share what's on your heart, and we'll hold you in our prayers. You can be as specific or as general as feels right.

May our collective duas be a source of strength and blessing for us all.`
    }
  ];

  for (const topic of topics) {
    await createTopic('Suhbah', topic.name, topic.content);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
}

/**
 * Create Unit 0 topic
 */
async function createUnit0Topic() {
  const content = `Welcome to the discussion space for Unit 0 — The North Star.

This is where we reflect on and discuss the teachings from this unit. Share your insights, questions, and reflections as you move through the content.

Remember: this is suhbah, not therapy or advice-giving. We're here to reflect together and support one another's learning.`;

  return await createTopic('Suhbah', 'Unit 0 — The North Star', content);
}

/**
 * Create a unit topic (for future units)
 */
async function createUnitTopic(unitNumber, unitTitle) {
  const topicName = `Unit ${unitNumber} — ${unitTitle}`;
  const content = `Welcome to the discussion space for ${topicName}.

This is where we reflect on and discuss the teachings from this unit. Share your insights, questions, and reflections as you move through the content.

Remember: this is suhbah, not therapy or advice-giving. We're here to reflect together and support one another's learning.`;

  return await createTopic('Suhbah', topicName, content);
}

/**
 * Invite a user to the organization
 */
async function inviteUser(email) {
  const inviteData = {
    invitee_emails: JSON.stringify([email]),
    invite_as: 400 // 400 = Member role
  };

  const response = await fetch(`${ZULIP_CONFIG.site}/api/v1/invites`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${ZULIP_CONFIG.botEmail}:${ZULIP_CONFIG.apiKey}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(inviteData)
  });

  const result = await response.json();
  console.log(`User ${email} invited:`, result);
  return result;
}

/**
 * Subscribe a user to Suhbah stream
 */
async function subscribeUserToSuhbah(userEmail) {
  const subscriptionData = {
    subscriptions: JSON.stringify([{ name: 'Suhbah' }]),
    principals: JSON.stringify([userEmail])
  };

  const response = await fetch(`${ZULIP_CONFIG.site}/api/v1/users/me/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${ZULIP_CONFIG.botEmail}:${ZULIP_CONFIG.apiKey}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(subscriptionData)
  });

  const result = await response.json();
  console.log(`User ${userEmail} subscribed to Suhbah:`, result);
  return result;
}

/**
 * Get stream ID by name
 */
async function getStreamId(streamName) {
  const response = await fetch(`${ZULIP_CONFIG.site}/api/v1/get_stream_id?stream=${encodeURIComponent(streamName)}`, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${ZULIP_CONFIG.botEmail}:${ZULIP_CONFIG.apiKey}`)
    }
  });

  const result = await response.json();
  return result.stream_id;
}

/**
 * Pin a topic to the top of a stream
 * Note: This requires getting the message ID first
 */
async function pinTopic(streamName, topicName) {
  // First, get the stream ID
  const streamId = await getStreamId(streamName);
  
  // Note: Pinning topics requires additional API calls to get message IDs
  // This is a placeholder for the full implementation
  console.log(`To pin topic "${topicName}" in ${streamName}:`);
  console.log('1. Go to the Zulip web interface');
  console.log('2. Navigate to the topic');
  console.log('3. Click the three dots (⋯) next to the topic name');
  console.log('4. Select "Pin topic to top of stream"');
}

/**
 * Complete setup - run all configuration steps
 */
async function completeSetup() {
  console.log('Starting Zulip setup for Lady Rabi\'a Academy...\n');

  try {
    // Step 1: Create streams
    console.log('Step 1: Creating Suhbah stream...');
    await createSuhbahStream();
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 2: Creating Admin stream...');
    await createAdminStream();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Create evergreen topics
    console.log('Step 3: Creating evergreen topics...');
    await createEvergreenTopics();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Create Unit 0 topic
    console.log('Step 4: Creating Unit 0 topic...');
    await createUnit0Topic();

    console.log('\n✅ Setup complete!');
    console.log('\nManual steps remaining:');
    console.log('1. Pin "Start Here — Adab & Guidelines" topic');
    console.log('2. Configure organization settings in Zulip admin panel');
    console.log('3. Set Suhbah as default stream for new users');
    console.log('4. Add Suhbah link to members area website');

  } catch (error) {
    console.error('Error during setup:', error);
  }
}

// Export functions for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createSuhbahStream,
    createAdminStream,
    createTopic,
    createEvergreenTopics,
    createUnit0Topic,
    createUnitTopic,
    inviteUser,
    subscribeUserToSuhbah,
    getStreamId,
    completeSetup
  };
}

// Usage examples:
// await completeSetup(); // Run full setup
// await createUnitTopic(1, 'The Journey Begins'); // Create a new unit topic
// await inviteUser('member@example.com'); // Invite a new member
