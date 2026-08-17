(function () {
  'use strict';

  const config = (typeof window !== 'undefined' && window.LRA_CONFIG) ? window.LRA_CONFIG : {};
  const supabaseConfig = config.supabase || {};
  const zulipConfig = config.zulip || {};

  const SUPABASE_URL = supabaseConfig.url || 'https://swapiobhcpgufihykoqx.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = supabaseConfig.publishableKey || 'sb_publishable_URN0OI4QtnMRrga7kIIqTg_EpodrVwb';
  const FUNCTION_URL = `${supabaseConfig.functionsUrl || SUPABASE_URL + '/functions/v1'}/${zulipConfig.functionName || 'zulip-chat-v2'}`;

  const DEFAULT_STREAM = (zulipConfig.defaultStream) || 'Suhbah';
  /* Single private stream for now; more can be added later */
  const STREAMS = [
    { id: 'Suhbah', name: 'Suhbah' }
  ];

  let currentStream = DEFAULT_STREAM;
  let currentUser = 'Member';
  let accessToken = null;

  /* Fetch the current member's access token + display name from Supabase */
  async function resolveMember() {
    if (!window.SupabaseClient) {
      console.error('[Zulip] SupabaseClient not loaded');
      return false;
    }
    
    try {
      const { data: { session }, error } = await window.SupabaseClient.getSession();
      if (error || !session) {
        console.error('[Zulip] No active session:', error);
        return false;
      }
      
      const user = await window.SupabaseClient.getCurrentUser();
      if (!user || !user.profile) {
        console.error('[Zulip] No user profile found');
        return false;
      }
      
      accessToken = session.access_token;
      currentUser = user.profile.name || 'Member';
      console.log('[Zulip] Auth resolved:', { user: currentUser, hasToken: !!accessToken });
      return true;
    } catch (err) {
      console.error('[Zulip] Failed to resolve member:', err);
      return false;
    }
  }

  const injectCSS = () => {
    const style = document.createElement('style');
    style.textContent = `
      .zulip-app { display: flex; flex-direction: column; height: calc(100vh - 300px); min-height: 600px; background: #f0ebe0; border: 1px solid rgba(201,168,76,.35); border-radius: 2px; box-shadow: 0 4px 12px rgba(27,60,40,.08); overflow: hidden; }
      .zulip-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; background: rgba(249,245,237,.95); border-bottom: 1px solid rgba(201,168,76,.25); }
      .zulip-header-title { font-family: 'Playfair Display', serif; font-size: 18px; color: #142e1f; }
      .zulip-stream-select { padding: 8px 14px; font-family: 'EB Garamond', serif; font-size: 14px; color: #5a5240; background: #f9f5ed; border: 1px solid rgba(201,168,76,.35); border-radius: 2px; cursor: pointer; outline: none; }
      .zulip-stream-select:focus { border-color: #b5860d; }
      .zulip-messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
      .zulip-message { display: flex; flex-direction: column; gap: 0.25rem; max-width: 80%; padding: 0.75rem 1rem; background: #f9f5ed; border: 1px solid rgba(201,168,76,.2); border-radius: 2px; animation: fadeInMessage 0.3s ease; }
      .zulip-message.own { align-self: flex-end; background: rgba(181,134,13,.08); border-color: rgba(181,134,13,.25); }
      @keyframes fadeInMessage { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .zulip-message-sender { font-size: 13px; font-weight: 600; color: #1B3C28; letter-spacing: 0.02em; }
      .zulip-message-time { font-size: 11px; color: #5a5240; opacity: 0.7; }
      .zulip-message-content { font-size: 15px; line-height: 1.5; color: #1c1a14; word-wrap: break-word; }
      .zulip-message-content a { color: #1B3C28; text-decoration: underline; }
      .zulip-message-meta { display: flex; align-items: center; gap: 0.75rem; }
      .zulip-input-area { display: flex; gap: 0.75rem; padding: 1rem 1.5rem; background: #f9f5ed; border-top: 1px solid rgba(201,168,76,.25); }
      .zulip-input { flex: 1; padding: 0.75rem 1rem; font-family: 'EB Garamond', Georgia, serif; font-size: 15px; color: #1c1a14; background: #f0ebe0; border: 1px solid rgba(201,168,76,.35); border-radius: 2px; outline: none; transition: border-color 0.3s; }
      .zulip-input:focus { border-color: #b5860d; }
      .zulip-send-btn { padding: 0.75rem 1.5rem; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; background: #1B3C28; color: #f9f5ed; border: none; border-radius: 2px; cursor: pointer; font-family: 'EB Garamond', serif; transition: background 0.3s; }
      .zulip-send-btn:hover { background: #142e1f; }
      .zulip-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .zulip-empty { text-align: center; padding: 3rem; color: #5a5240; font-style: italic; }
      .zulip-error { color: #a94442; background: rgba(169,68,66,.08); border: 1px solid rgba(169,68,66,.25); border-radius: 2px; padding: 1rem; margin: 1rem 1.5rem; font-size: 14px; }
      .zulip-loading { text-align: center; padding: 2rem; color: #5a5240; font-style: italic; }
      @media (max-width: 768px) { .zulip-app { height: calc(100vh - 250px); min-height: 500px; } .zulip-message { max-width: 95%; } }
    `;
    document.head.appendChild(style);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  };

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const renderMarkdown = (content) => {
    return escapeHtml(content)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  };

  /* The bot posts all messages, prefixed with "**Name:**\n". Extract the
     real sender from that prefix; fall back to the Zulip sender name. */
  const parseMessage = (msg) => {
    const content = msg.content || '';
    const match = content.match(/^\*\*(.+?):\*\*\s*\n([\s\S]*)$/);
    if (match) {
      return { sender: match[1], body: match[2], prefixed: true };
    }
    return { sender: msg.sender_full_name || 'Member', body: content, prefixed: false };
  };

  const renderMessages = (messages, container) => {
    container.innerHTML = '';
    if (!messages || messages.length === 0) {
      container.innerHTML = '<div class="zulip-empty">No messages yet. Be the first to share.</div>';
      return;
    }
    messages.reverse().forEach((msg) => {
      const parsed = parseMessage(msg);
      const isOwn = parsed.prefixed && parsed.sender === currentUser;
      const el = document.createElement('div');
      el.className = 'zulip-message' + (isOwn ? ' own' : '');
      el.innerHTML = `
        <div class="zulip-message-meta">
          <span class="zulip-message-sender">${escapeHtml(parsed.sender)}</span>
          <span class="zulip-message-time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="zulip-message-content">${renderMarkdown(parsed.body)}</div>
      `;
      container.appendChild(el);
    });
    container.scrollTop = container.scrollHeight;
  };

  const authHeaders = () => {
    const headers = {
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json'
    };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return headers;
  };

  const fetchMessages = async (container) => {
    container.innerHTML = '<div class="zulip-loading">Loading messages...</div>';
    try {
      const res = await fetch(`${FUNCTION_URL}/messages?stream=${encodeURIComponent(currentStream)}&limit=50`, {
        method: 'GET',
        headers: authHeaders()
      });
      if (res.status === 401) throw new Error('Please sign in again to view the community.');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      renderMessages(data.messages, container);
    } catch (err) {
      container.innerHTML = `<div class="zulip-error">Could not load messages: ${escapeHtml(err.message)}</div>`;
      console.error('Zulip fetch error:', err);
    }
  };

  const sendMessage = async (content, input, container, sendBtn) => {
    if (!content.trim()) return;
    input.disabled = true;
    sendBtn.disabled = true;
    try {
      const res = await fetch(`${FUNCTION_URL}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ stream: currentStream, topic: 'general', content: content.trim() })
      });
      if (res.status === 401) throw new Error('Please sign in again to send messages.');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      input.value = '';
      await fetchMessages(container);
    } catch (err) {
      alert('Could not send message: ' + err.message);
      console.error('Zulip send error:', err);
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  };

  const init = async (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    injectCSS();
    await resolveMember();

    const showStreamPicker = STREAMS.length > 1;

    container.innerHTML = `
      <div class="zulip-app">
        <div class="zulip-header">
          <div class="zulip-header-title">Suhbah — Community Chat</div>
          ${showStreamPicker ? `<select class="zulip-stream-select" aria-label="Select stream">
            ${STREAMS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>` : ''}
        </div>
        <div class="zulip-messages" id="zulipMessages"></div>
        <div class="zulip-input-area">
          <input type="text" class="zulip-input" id="zulipInput" placeholder="Write a message..." autocomplete="off" />
          <button class="zulip-send-btn" id="zulipSendBtn" type="button">Send</button>
        </div>
      </div>
    `;

    const messagesEl = container.querySelector('#zulipMessages');
    const inputEl = container.querySelector('#zulipInput');
    const sendBtn = container.querySelector('#zulipSendBtn');

    if (showStreamPicker) {
      const streamSelect = container.querySelector('.zulip-stream-select');
      streamSelect.value = currentStream;
      streamSelect.addEventListener('change', (e) => {
        currentStream = e.target.value;
        fetchMessages(messagesEl);
      });
    }

    sendBtn.addEventListener('click', () => sendMessage(inputEl.value, inputEl, messagesEl, sendBtn));

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage(inputEl.value, inputEl, messagesEl, sendBtn);
    });

    fetchMessages(messagesEl);
  };

  window.initZulipChat = init;
})();
