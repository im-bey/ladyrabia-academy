(function() {
  'use strict';

  /* ══════════════════════════════════════════════
     CHAT BUBBLE MODAL - Expandable chat widget
     ══════════════════════════════════════════════ */

  const SUPABASE_URL = 'https://swapiobhcpgufihykoqx.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_URN0OI4QtnMRrga7kIIqTg_EpodrVwb';
  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/zulip-chat-v2`;
  const POLL_INTERVAL = 30000; // 30 seconds

  const STREAMS = [
    { id: 'general', name: 'General' },
    { id: 'monthly-themes', name: 'Monthly Themes' },
    { id: 'questions', name: 'Questions' },
    { id: 'reflections', name: 'Reflections' }
  ];

  let isModalOpen = false;
  let currentStream = localStorage.getItem('lra_chat_stream') || 'general';
  let currentUser = localStorage.getItem('lraMemberName') || 'Member';
  let lastMessageCounts = JSON.parse(localStorage.getItem('lra_last_message_counts') || '{}');
  let notificationCount = 0;
  let pollInterval = null;

  /* ══════════════════════════════════════════════
     INJECT CSS STYLES
     ══════════════════════════════════════════════ */
  function injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
      /* Chat Bubble */
      .chat-bubble {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 60px;
        height: 60px;
        background: #1B3C28;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(27,60,40,.25);
        transition: all .3s ease;
        z-index: 999;
      }
      .chat-bubble:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(27,60,40,.35);
      }
      .chat-bubble-icon {
        width: 28px;
        height: 28px;
        stroke: #f9f5ed;
        fill: none;
        stroke-width: 2;
      }
      .chat-bubble.hidden {
        display: none;
      }
      
      /* Notification Badge */
      .chat-notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        background: #d9534f;
        color: white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        padding: 0 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,.2);
        animation: pulse 2s infinite;
      }
      .chat-notification-badge.hidden {
        display: none;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      
      /* Modal Overlay */
      .chat-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.2);
        backdrop-filter: blur(2px);
        z-index: 998;
        opacity: 0;
        pointer-events: none;
        transition: opacity .3s ease;
      }
      .chat-modal-overlay.open {
        opacity: 1;
        pointer-events: all;
      }
      
      /* Modal Container */
      .chat-modal {
        position: fixed;
        bottom: 5rem;
        right: 2rem;
        width: 400px;
        height: 600px;
        background: #f9f5ed;
        border: 1px solid rgba(201,168,76,.35);
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(27,60,40,.15);
        display: flex;
        flex-direction: column;
        z-index: 999;
        transform: translateY(100px) scale(0.9);
        opacity: 0;
        pointer-events: none;
        transition: all .3s cubic-bezier(.22,1,.36,1);
      }
      .chat-modal.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: all;
      }
      
      /* Modal Header */
      .chat-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        background: rgba(249,245,237,.95);
        border-bottom: 1px solid rgba(201,168,76,.25);
        gap: 1rem;
      }
      .chat-modal-title {
        font-family: 'Playfair Display', serif;
        font-size: 18px;
        color: #142e1f;
        flex-shrink: 0;
      }
      .chat-modal-stream-select {
        padding: 6px 10px;
        font-family: 'EB Garamond', serif;
        font-size: 13px;
        color: #5a5240;
        background: #f9f5ed;
        border: 1px solid rgba(201,168,76,.35);
        border-radius: 2px;
        cursor: pointer;
        outline: none;
        flex: 1;
        min-width: 0;
      }
      .chat-modal-stream-select:focus {
        border-color: #b5860d;
      }
      .chat-modal-close {
        width: 32px;
        height: 32px;
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 2px;
        transition: background .3s;
        flex-shrink: 0;
      }
      .chat-modal-close:hover {
        background: rgba(201,168,76,.15);
      }
      .chat-modal-close svg {
        width: 18px;
        height: 18px;
        stroke: #5a5240;
        stroke-width: 2;
      }
      
      /* Modal Body */
      .chat-modal-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .chat-message {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        max-width: 85%;
        padding: 0.625rem 0.875rem;
        background: #f0ebe0;
        border: 1px solid rgba(201,168,76,.2);
        border-radius: 3px;
        animation: fadeInMessage 0.3s ease;
      }
      .chat-message.own {
        align-self: flex-end;
        background: rgba(181,134,13,.08);
        border-color: rgba(181,134,13,.25);
      }
      @keyframes fadeInMessage {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .chat-message-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .chat-message-sender {
        font-size: 12px;
        font-weight: 600;
        color: #1B3C28;
        letter-spacing: 0.02em;
      }
      .chat-message-time {
        font-size: 10px;
        color: #5a5240;
        opacity: 0.7;
      }
      .chat-message-content {
        font-size: 14px;
        line-height: 1.5;
        color: #1c1a14;
        word-wrap: break-word;
      }
      .chat-message-content a {
        color: #1B3C28;
        text-decoration: underline;
      }
      .chat-empty {
        text-align: center;
        padding: 2rem 1rem;
        color: #5a5240;
        font-style: italic;
        font-size: 14px;
      }
      .chat-loading {
        text-align: center;
        padding: 2rem 1rem;
        color: #5a5240;
        font-style: italic;
        font-size: 14px;
      }
      .chat-error {
        color: #a94442;
        background: rgba(169,68,66,.08);
        border: 1px solid rgba(169,68,66,.25);
        border-radius: 2px;
        padding: 0.75rem;
        margin: 0.75rem;
        font-size: 13px;
      }
      
      /* Modal Footer */
      .chat-modal-footer {
        display: flex;
        gap: 0.625rem;
        padding: 0.875rem 1rem;
        background: #f9f5ed;
        border-top: 1px solid rgba(201,168,76,.25);
      }
      .chat-modal-input {
        flex: 1;
        padding: 0.625rem 0.875rem;
        font-family: 'EB Garamond', Georgia, serif;
        font-size: 14px;
        color: #1c1a14;
        background: #f0ebe0;
        border: 1px solid rgba(201,168,76,.35);
        border-radius: 2px;
        outline: none;
        transition: border-color 0.3s;
      }
      .chat-modal-input:focus {
        border-color: #b5860d;
      }
      .chat-modal-send {
        padding: 0.625rem 1.25rem;
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        background: #1B3C28;
        color: #f9f5ed;
        border: none;
        border-radius: 2px;
        cursor: pointer;
        font-family: 'EB Garamond', serif;
        transition: background 0.3s;
      }
      .chat-modal-send:hover {
        background: #142e1f;
      }
      .chat-modal-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      /* Mobile Responsive */
      @media (max-width: 768px) {
        .chat-bubble {
          width: 50px;
          height: 50px;
          bottom: 1.5rem;
          right: 1.5rem;
        }
        .chat-bubble-icon {
          width: 24px;
          height: 24px;
        }
        .chat-modal {
          width: calc(100vw - 2rem);
          height: calc(100vh - 10rem);
          right: 1rem;
          bottom: 4rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════
     HELPER FUNCTIONS
     ══════════════════════════════════════════════ */
  
  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function renderMarkdown(content) {
    return content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ══════════════════════════════════════════════
     MESSAGE OPERATIONS
     ══════════════════════════════════════════════ */

  async function fetchMessages(stream) {
    const messagesEl = document.getElementById('chatModalMessages');
    if (!messagesEl) return [];

    messagesEl.innerHTML = '<div class="chat-loading">Loading messages...</div>';
    
    try {
      const url = `${FUNCTION_URL}/messages?stream=${encodeURIComponent(stream)}&limit=50`;
      console.log('Fetching messages from:', url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        let errorText = '';
        try {
          errorText = await res.text();
          console.error('Server error response:', errorText);
        } catch (e) {
          console.error('Could not read error response');
        }
        
        // Handle 500 errors with helpful message
        if (res.status === 500) {
          messagesEl.innerHTML = `<div class="chat-empty">This channel is not yet available.<br>Please check back soon or try the General channel.</div>`;
          return [];
        }
        
        throw new Error(`Server error ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Received data:', data);
      renderMessages(data.messages || [], messagesEl);
      
      return data.messages || [];
    } catch (err) {
      // Only show error if we haven't already shown the "not available" message
      if (!messagesEl.innerHTML.includes('not yet available')) {
        messagesEl.innerHTML = `<div class="chat-error">Could not load messages. Please try again later.</div>`;
      }
      console.error('Chat fetch error:', err);
      return [];
    }
  }

  function renderMessages(messages, container) {
    if (!messages || messages.length === 0) {
      container.innerHTML = '<div class="chat-empty">No messages yet. Be the first to share.</div>';
      return;
    }

    container.innerHTML = '';
    messages.reverse().forEach((msg) => {
      const isOwn = msg.sender_full_name === currentUser || 
                    msg.sender_email === 'lady-rabia-chat-bot@ladyrabiaacademy.zulipchat.com';
      
      const el = document.createElement('div');
      el.className = 'chat-message' + (isOwn ? ' own' : '');
      el.innerHTML = `
        <div class="chat-message-meta">
          <span class="chat-message-sender">${escapeHtml(msg.sender_full_name || 'Member')}</span>
          <span class="chat-message-time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="chat-message-content">${renderMarkdown(msg.content || '')}</div>
      `;
      container.appendChild(el);
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage(content) {
    if (!content.trim()) return;

    const inputEl = document.getElementById('chatModalInput');
    const sendBtn = document.getElementById('chatModalSend');
    const messagesEl = document.getElementById('chatModalMessages');

    if (!inputEl || !sendBtn || !messagesEl) return;

    inputEl.disabled = true;
    sendBtn.disabled = true;

    try {
      const res = await fetch(`${FUNCTION_URL}/messages`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          stream: currentStream, 
          topic: 'general', 
          content: content.trim() 
        })
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      inputEl.value = '';
      await fetchMessages(currentStream);
    } catch (err) {
      alert('Could not send message: ' + err.message);
      console.error('Chat send error:', err);
    } finally {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  /* ══════════════════════════════════════════════
     NOTIFICATION SYSTEM
     ══════════════════════════════════════════════ */

  async function checkForNewMessages() {
    try {
      const res = await fetch(`${FUNCTION_URL}/messages?stream=${encodeURIComponent(currentStream)}&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        // Silently fail for unavailable streams
        return 0;
      }

      const data = await res.json();
      return data.messages ? data.messages.length : 0;
    } catch (err) {
      // Silently handle errors in background polling
      return 0;
    }
  }

  function updateNotificationBadge(count) {
    const badge = document.getElementById('chatNotificationBadge');
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function clearNotifications() {
    notificationCount = 0;
    updateNotificationBadge(0);
  }

  function startPolling() {
    if (pollInterval) return;

    pollInterval = setInterval(async () => {
      if (!isModalOpen) {
        const messages = await checkForNewMessages();
        const lastCount = lastMessageCounts[currentStream] || 0;
        
        if (messages > lastCount) {
          notificationCount += (messages - lastCount);
          updateNotificationBadge(notificationCount);
        }
      }
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  /* ══════════════════════════════════════════════
     MODAL OPERATIONS
     ══════════════════════════════════════════════ */

  function openModal() {
    isModalOpen = true;

    const bubble = document.getElementById('chatBubble');
    const overlay = document.getElementById('chatModalOverlay');
    const modal = document.getElementById('chatModal');

    if (bubble) bubble.classList.add('hidden');
    if (overlay) overlay.classList.add('open');
    if (modal) modal.classList.add('open');

    clearNotifications();
    fetchMessages(currentStream).then((messages) => {
      lastMessageCounts[currentStream] = messages.length;
      localStorage.setItem('lra_last_message_counts', JSON.stringify(lastMessageCounts));
    });

    // Focus input
    setTimeout(() => {
      const input = document.getElementById('chatModalInput');
      if (input) input.focus();
    }, 300);
  }

  function closeModal() {
    isModalOpen = false;

    const bubble = document.getElementById('chatBubble');
    const overlay = document.getElementById('chatModalOverlay');
    const modal = document.getElementById('chatModal');

    if (overlay) overlay.classList.remove('open');
    if (modal) modal.classList.remove('open');
    
    setTimeout(() => {
      if (bubble) bubble.classList.remove('hidden');
    }, 300);

    startPolling();
  }

  function switchStream(stream) {
    currentStream = stream;
    localStorage.setItem('lra_chat_stream', stream);
    fetchMessages(stream).then((messages) => {
      lastMessageCounts[stream] = messages.length;
      localStorage.setItem('lra_last_message_counts', JSON.stringify(lastMessageCounts));
    });
  }

  /* ══════════════════════════════════════════════
     INITIALIZATION
     ══════════════════════════════════════════════ */

  function init() {
    injectCSS();

    // Create bubble HTML
    const bubbleHTML = `
      <div class="chat-bubble" id="chatBubble">
        <svg class="chat-bubble-icon" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <div class="chat-notification-badge hidden" id="chatNotificationBadge">0</div>
      </div>
    `;

    // Create modal HTML
    const modalHTML = `
      <div class="chat-modal-overlay" id="chatModalOverlay"></div>
      <div class="chat-modal" id="chatModal">
        <div class="chat-modal-header">
          <div class="chat-modal-title">Community</div>
          <select class="chat-modal-stream-select" id="chatModalStreamSelect">
            ${STREAMS.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
          <button class="chat-modal-close" id="chatModalClose" type="button" aria-label="Close chat">
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="chat-modal-messages" id="chatModalMessages"></div>
        <div class="chat-modal-footer">
          <input 
            type="text" 
            class="chat-modal-input" 
            id="chatModalInput" 
            placeholder="Write a message..." 
            autocomplete="off"
          />
          <button class="chat-modal-send" id="chatModalSend" type="button">Send</button>
        </div>
      </div>
    `;

    // Inject into body
    document.body.insertAdjacentHTML('beforeend', bubbleHTML + modalHTML);

    // Get elements
    const bubble = document.getElementById('chatBubble');
    const overlay = document.getElementById('chatModalOverlay');
    const modal = document.getElementById('chatModal');
    const closeBtn = document.getElementById('chatModalClose');
    const streamSelect = document.getElementById('chatModalStreamSelect');
    const input = document.getElementById('chatModalInput');
    const sendBtn = document.getElementById('chatModalSend');

    // Set current stream
    if (streamSelect) streamSelect.value = currentStream;

    // Event listeners
    if (bubble) {
      bubble.addEventListener('click', openModal);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }

    if (streamSelect) {
      streamSelect.addEventListener('change', (e) => {
        switchStream(e.target.value);
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        if (input) sendMessage(input.value);
      });
    }

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage(input.value);
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    });

    // Start polling for notifications
    startPolling();

    console.log('Chat bubble initialized');
  }

  // Export init function
  window.initChatBubble = init;
})();
