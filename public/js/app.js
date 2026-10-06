document.addEventListener('DOMContentLoaded', () => {
  // WebRTC ICE Server Configuration for Live HTTPS / Mobile Network Traversal
  const PEER_CONFIG = {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    },
    debug: 0
  };

  // State Management
  let peer = null;
  let activeConn = null;
  let currentRoomCode = null;
  let partnerConnected = false;
  let typingTimeout = null;
  let isTyping = false;
  let heartbeatInterval = null;

  // DOM Elements - Home View
  const homeView = document.getElementById('home-view');
  const tabCreate = document.getElementById('tab-create');
  const tabJoin = document.getElementById('tab-join');
  const sectionCreate = document.getElementById('section-create');
  const sectionJoin = document.getElementById('section-join');
  const createdCodeDisplay = document.getElementById('created-code-display');
  const btnGenerateCode = document.getElementById('btn-generate-code');
  const createActions = document.getElementById('create-actions');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnEnterChat = document.getElementById('btn-enter-chat');
  const joinCodeInput = document.getElementById('join-code-input');
  const btnJoinRoom = document.getElementById('btn-join-room');

  // DOM Elements - Chat View
  const chatView = document.getElementById('chat-view');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const headerCodePill = document.getElementById('header-code-pill');
  const headerRoomCode = document.getElementById('header-room-code');
  const btnClearChat = document.getElementById('btn-clear-chat');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnLeaveChat = document.getElementById('btn-leave-chat');
  const chatMessages = document.getElementById('chat-messages');
  const typingIndicator = document.getElementById('typing-indicator');
  const emojiPicker = document.getElementById('emoji-picker');
  const btnEmojiToggle = document.getElementById('btn-emoji-toggle');
  const messageInput = document.getElementById('message-input');
  const btnSendMessage = document.getElementById('btn-send-message');

  // Toast Container & Connection Banner
  const toastContainer = document.getElementById('toast-container');
  const connectionBanner = document.getElementById('connection-banner');

  // --- HELPER FUNCTIONS ---

  /**
   * Display Toast Notification
   */
  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    const bgColors = {
      info: 'bg-gray-800 text-white dark:bg-white dark:text-gray-900',
      success: 'bg-wa-green text-white',
      error: 'bg-red-600 text-white'
    };

    toast.className = `${bgColors[type] || bgColors.info} px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all transform duration-300 translate-y-2 opacity-0 flex items-center gap-2 pointer-events-auto z-50`;
    toast.innerHTML = `<span>${message}</span>`;
    
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /**
   * Switch between Home Tabs
   */
  function switchHomeTab(tab) {
    if (!tabCreate || !tabJoin || !sectionCreate || !sectionJoin) return;
    if (tab === 'create') {
      tabCreate.className = 'flex-1 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-wa-headerdark text-wa-green shadow-sm transition-all cursor-pointer';
      tabJoin.className = 'flex-1 py-2 text-sm font-semibold rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer';
      sectionCreate.classList.remove('hidden');
      sectionJoin.classList.add('hidden');
    } else {
      tabJoin.className = 'flex-1 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-wa-headerdark text-wa-green shadow-sm transition-all cursor-pointer';
      tabCreate.className = 'flex-1 py-2 text-sm font-semibold rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer';
      sectionJoin.classList.remove('hidden');
      sectionCreate.classList.add('hidden');
      if (joinCodeInput) joinCodeInput.focus();
    }
  }

  /**
   * Transition to Chat Interface
   */
  function enterChatView(code) {
    currentRoomCode = code;
    if (homeView) homeView.classList.add('hidden');
    if (chatView) chatView.classList.remove('hidden');
    if (headerRoomCode) headerRoomCode.textContent = code;
    if (headerCodePill) headerCodePill.classList.remove('hidden');
    if (messageInput) messageInput.focus();
    updatePartnerStatus(partnerConnected);
  }

  /**
   * Update Partner Status Display
   */
  function updatePartnerStatus(connected) {
    partnerConnected = connected;
    if (!statusIndicator || !statusText) return;
    if (connected) {
      statusIndicator.className = 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-wa-green border-2 border-white dark:border-wa-headerdark status-pulse';
      statusText.textContent = 'Online';
      statusText.className = 'text-xs text-wa-green dark:text-wa-green font-medium';
      startHeartbeat();
    } else {
      statusIndicator.className = 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-wa-headerdark';
      statusText.textContent = 'Waiting for partner...';
      statusText.className = 'text-xs text-amber-600 dark:text-amber-400 font-medium';
      stopHeartbeat();
    }
  }

  /**
   * WebRTC DataChannel Keep-Alive Heartbeat
   */
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
      if (activeConn && activeConn.open) {
        activeConn.send({ type: 'ping' });
      }
    }, 15000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  /**
   * Scroll Chat Window to Bottom
   */
  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  /**
   * Format ISO Timestamp to 12h Time string
   */
  function formatTime(isoString) {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Append Message Bubble to Chat
   */
  function appendMessage({ id, content, isOutgoing, timestamp, status = 'sent' }) {
    if (!chatMessages) return;
    const wrapper = document.createElement('div');
    wrapper.id = `msg-wrap-${id}`;
    wrapper.className = `flex ${isOutgoing ? 'justify-end' : 'justify-start'} my-1`;

    const bubble = document.createElement('div');
    bubble.className = `bubble ${isOutgoing ? 'bubble-out' : 'bubble-in'} p-2.5 px-3.5 rounded-xl text-sm max-w-[85%] sm:max-w-[70%]`;

    const contentHtml = escapeHTML(content).replace(/\n/g, '<br>');
    const timeStr = formatTime(timestamp);

    let statusTicks = '';
    if (isOutgoing) {
      if (status === 'delivered') {
        statusTicks = `<svg class="w-4 h-4 text-sky-500 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7M5 7l4 4L19 1"/></svg>`;
      } else {
        statusTicks = `<svg class="w-4 h-4 text-gray-400 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
      }
    }

    bubble.innerHTML = `
      <div class="leading-relaxed text-gray-900 dark:text-gray-100">${contentHtml}</div>
      <div class="flex items-center justify-end gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-1 select-none">
        <span>${timeStr}</span>
        ${statusTicks ? `<span class="tick-icon">${statusTicks}</span>` : ''}
      </div>
    `;

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
  }

  /**
   * Update message delivery status to double tick
   */
  function markMessageDelivered(msgId) {
    const msgWrap = document.getElementById(`msg-wrap-${msgId}`);
    if (msgWrap) {
      const tickSpan = msgWrap.querySelector('.tick-icon');
      if (tickSpan) {
        tickSpan.innerHTML = `<svg class="w-4 h-4 text-sky-500 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7M5 7l4 4L19 1"/></svg>`;
      }
    }
  }

  // --- WEBRTC CONNECTION LISTENERS ---

  function setupConnectionListeners(conn) {
    conn.on('open', () => {
      updatePartnerStatus(true);
      showToast('Partner connected via WebRTC!', 'success');
    });

    conn.on('data', (data) => {
      if (!data) return;
      if (data.type === 'ping') {
        // Keep-alive heartbeat acknowledgement
        return;
      }
      if (data.type === 'chat-message') {
        appendMessage({
          id: data.id,
          content: data.content,
          isOutgoing: false,
          timestamp: data.timestamp
        });
        // Send delivery receipt
        conn.send({ type: 'message-delivered', id: data.id });
      } else if (data.type === 'message-delivered') {
        markMessageDelivered(data.id);
      } else if (data.type === 'typing') {
        if (typingIndicator) typingIndicator.classList.remove('hidden');
        scrollToBottom();
      } else if (data.type === 'stop-typing') {
        if (typingIndicator) typingIndicator.classList.add('hidden');
      } else if (data.type === 'error') {
        showToast(data.message, 'error');
      }
    });

    conn.on('close', () => {
      updatePartnerStatus(false);
      if (statusText) {
        statusText.textContent = 'Partner left the chat.';
        statusText.className = 'text-xs text-red-500 font-medium';
      }
      showToast('Partner disconnected.', 'error');
      activeConn = null;
    });

    conn.on('error', (err) => {
      showToast(`Connection error: ${err.message || err}`, 'error');
    });
  }

  function setupPeerErrorHandlers(p) {
    p.on('error', (err) => {
      console.warn('[PEER ERROR]', err);
      if (err.type === 'peer-unavailable') {
        showToast('Invalid or expired room code. Please check the code.', 'error');
      } else if (err.type === 'unavailable-id') {
        showToast('Room code is already active. Generating new code...', 'info');
      } else {
        showToast(`Peer connection error: ${err.type || 'disconnected'}`, 'error');
      }
    });
  }

  // --- HOME EVENT LISTENERS ---

  if (tabCreate) tabCreate.addEventListener('click', () => switchHomeTab('create'));
  if (tabJoin) tabJoin.addEventListener('click', () => switchHomeTab('join'));

  // Generate Room Code Action
  if (btnGenerateCode) {
    btnGenerateCode.addEventListener('click', () => {
      if (typeof Peer === 'undefined') {
        showToast('WebRTC library loading... Please check internet connection.', 'error');
        return;
      }

      showToast('Generating serverless room...', 'info');

      // Random 6-digit numeric room code
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
      const peerId = `chatling-v1-${roomCode}`;

      if (peer) peer.destroy();

      peer = new Peer(peerId, PEER_CONFIG);
      setupPeerErrorHandlers(peer);

      peer.on('open', (id) => {
        currentRoomCode = roomCode;
        if (createdCodeDisplay) createdCodeDisplay.textContent = roomCode;
        if (createActions) createActions.classList.remove('hidden');
        btnGenerateCode.classList.add('hidden');
        showToast(`Room ${roomCode} ready!`, 'success');
      });

      // Listen for incoming partner connection
      peer.on('connection', (conn) => {
        if (activeConn) {
          conn.send({ type: 'error', message: 'Room is full (Max 2 participants).' });
          setTimeout(() => conn.close(), 500);
          return;
        }
        activeConn = conn;
        setupConnectionListeners(conn);
      });
    });
  }

  // Copy Code Button
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode);
        showToast('Room code copied to clipboard!', 'info');
      }
    });
  }

  // Copy Direct Link Button
  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      if (currentRoomCode) {
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
        navigator.clipboard.writeText(shareUrl);
        showToast('Direct chat link copied to clipboard!', 'info');
      }
    });
  }

  // Enter Chat Button
  if (btnEnterChat) {
    btnEnterChat.addEventListener('click', () => {
      if (currentRoomCode) {
        enterChatView(currentRoomCode);
      }
    });
  }

  // Join Room Action
  function handleJoinRoom() {
    if (!joinCodeInput) return;
    const code = joinCodeInput.value.trim();
    if (code.length !== 6 || isNaN(code)) {
      showToast('Please enter a valid 6-digit room code.', 'error');
      return;
    }

    if (typeof Peer === 'undefined') {
      showToast('WebRTC library loading... Please check internet connection.', 'error');
      return;
    }

    showToast('Connecting to room ' + code + '...', 'info');

    const targetPeerId = `chatling-v1-${code}`;

    if (peer) peer.destroy();

    peer = new Peer(PEER_CONFIG);
    setupPeerErrorHandlers(peer);

    peer.on('open', () => {
      const conn = peer.connect(targetPeerId, { reliable: true });
      activeConn = conn;
      setupConnectionListeners(conn);

      // Auto enter view
      currentRoomCode = code;
      enterChatView(code);
    });
  }

  if (btnJoinRoom) btnJoinRoom.addEventListener('click', handleJoinRoom);

  if (joinCodeInput) {
    joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleJoinRoom();
      }
    });
  }

  // Auto Join via URL Query (`?room=839201`)
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam && roomParam.length === 6) {
    switchHomeTab('join');
    if (joinCodeInput) joinCodeInput.value = roomParam;
    setTimeout(() => {
      handleJoinRoom();
    }, 600);
  }

  // --- CHAT EVENT LISTENERS ---

  if (headerCodePill) {
    headerCodePill.addEventListener('click', () => {
      if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode);
        showToast('Room code copied!', 'info');
      }
    });
  }

  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      if (!chatMessages) return;
      chatMessages.innerHTML = `
        <div class="flex justify-center my-2 select-none">
          <div class="bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs px-3 py-1.5 rounded-lg shadow-sm text-center max-w-sm flex items-center gap-1.5">
            <svg class="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <span>Messages are ephemeral and kept in server memory. Room purges upon exit.</span>
          </div>
        </div>
      `;
      showToast('Local chat log cleared.', 'info');
    });
  }

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
    });
  }

  if (btnLeaveChat) {
    btnLeaveChat.addEventListener('click', () => {
      if (activeConn) activeConn.close();
      if (peer) peer.destroy();
      activeConn = null;
      peer = null;
      currentRoomCode = null;
      partnerConnected = false;
      stopHeartbeat();
      if (chatView) chatView.classList.add('hidden');
      if (homeView) homeView.classList.remove('hidden');
      if (createActions) createActions.classList.add('hidden');
      if (btnGenerateCode) btnGenerateCode.classList.remove('hidden');
      if (createdCodeDisplay) createdCodeDisplay.textContent = '------';
      if (joinCodeInput) joinCodeInput.value = '';
      showToast('You left the chat room.', 'info');
    });
  }

  // Send Message Trigger
  function handleSendMessage() {
    if (!messageInput) return;
    const content = messageInput.value.trim();
    if (!content || !currentRoomCode) return;

    const tempId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    // Append outgoing bubble locally
    appendMessage({
      id: tempId,
      content,
      isOutgoing: true,
      timestamp,
      status: partnerConnected ? 'delivered' : 'sent'
    });

    // Send over WebRTC DataChannel
    if (activeConn && activeConn.open) {
      activeConn.send({
        type: 'chat-message',
        id: tempId,
        content,
        timestamp
      });
    }

    // Reset input field
    messageInput.value = '';
    if (activeConn && activeConn.open) {
      activeConn.send({ type: 'stop-typing' });
    }
    isTyping = false;
  }

  if (btnSendMessage) btnSendMessage.addEventListener('click', handleSendMessage);

  if (messageInput) {
    messageInput.addEventListener('focus', () => {
      setTimeout(() => scrollToBottom(), 300);
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    messageInput.addEventListener('input', () => {
      if (!isTyping && activeConn && activeConn.open) {
        isTyping = true;
        activeConn.send({ type: 'typing' });
      }

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        if (activeConn && activeConn.open) {
          activeConn.send({ type: 'stop-typing' });
        }
      }, 1500);
    });
  }

  // Handle Mobile Virtual Keyboard (visualViewport) Viewport Adjustment
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (chatView && !chatView.classList.contains('hidden')) {
        scrollToBottom();
      }
    });
  }

  // Emoji Picker Toggle
  if (btnEmojiToggle && emojiPicker) {
    btnEmojiToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPicker.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!emojiPicker.contains(e.target) && e.target !== btnEmojiToggle) {
        emojiPicker.classList.add('hidden');
      }
    });

    document.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (messageInput) {
          messageInput.value += btn.textContent;
          messageInput.focus();
        }
      });
    });
  }
});
