/**
 * Twitch Chat for YouTube - Shadow DOM Approach
 * Replaces YouTube chat with Twitch chat, fully isolated via Shadow DOM
 */

(function () {
    'use strict';

    // Guard against multiple executions
    if (window.__tcfyLoaded) return;
    window.__tcfyLoaded = true;

    const TWITCH_URL = 'https://www.twitch.tv/embed/{channel}/chat?parent=www.youtube.com&darkpopout';

    let state = {
        initialized: false,
        channel: null,
        shadowRoot: null,
        originalChat: null
    };

    // CSS for the Shadow DOM (completely isolated)
    const styles = `
    :host {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
    }
    * {
      box-sizing: border-box;
    }
    .container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #0e0e10;
      border-bottom: 1px solid #303032;
    }
    .title {
      color: #efeff1;
      font-size: 14px;
      font-weight: 600;
    }
    .toggle-btn {
      padding: 6px 12px;
      background: #3a3a3d;
      border: none;
      border-radius: 4px;
      color: #efeff1;
      font-size: 12px;
      cursor: pointer;
    }
    .toggle-btn:hover {
      background: #4a4a4d;
    }
    .content {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .setup {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0e0e10;
      padding: 20px;
    }
    .setup.hidden {
      display: none;
    }
    .setup-title {
      color: #efeff1;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .setup-hint {
      color: #9147ff;
      font-size: 13px;
      margin-bottom: 16px;
    }
    .input-row {
      display: flex;
      gap: 8px;
    }
    input {
      padding: 10px 14px;
      background: #1f1f23;
      border: 1px solid #3a3a3d;
      border-radius: 6px;
      color: #efeff1;
      font-size: 14px;
      outline: none;
      width: 180px;
    }
    input:focus {
      border-color: #9147ff;
    }
    button.connect {
      padding: 10px 20px;
      background: #9147ff;
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button.connect:hover {
      background: #772ce8;
    }
  `;

    function createShadowUI() {
        // Create host element
        const host = document.createElement('div');
        host.id = 'tcfy-shadow-host';
        host.style.cssText = 'width:100%;height:100%;';

        // Create shadow root
        const shadow = host.attachShadow({ mode: 'closed' });
        state.shadowRoot = shadow;

        // Add styles
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        shadow.appendChild(styleEl);

        // Add HTML
        const container = document.createElement('div');
        container.className = 'container';
        container.innerHTML = `
      <div class="header">
        <span class="title">📺 Twitch Chat</span>
        <button class="toggle-btn">Show YouTube</button>
      </div>
      <div class="content">
        <iframe src="about:blank"></iframe>
        <div class="setup">
          <div class="setup-title">Enter Twitch Channel</div>
          <div class="setup-hint"></div>
          <div class="input-row">
            <input type="text" placeholder="Channel name" />
            <button class="connect">Connect</button>
          </div>
        </div>
      </div>
    `;
        shadow.appendChild(container);

        // Get elements
        const iframe = shadow.querySelector('iframe');
        const setup = shadow.querySelector('.setup');
        const input = shadow.querySelector('input');
        const connectBtn = shadow.querySelector('.connect');
        const toggleBtn = shadow.querySelector('.toggle-btn');
        const title = shadow.querySelector('.title');
        const hint = shadow.querySelector('.setup-hint');

        // Connect function
        function connect(channel) {
            if (!channel) return;
            channel = channel.trim().toLowerCase();
            iframe.src = TWITCH_URL.replace('{channel}', channel);
            setup.classList.add('hidden');
            title.textContent = '📺 ' + channel;
            state.channel = channel;

            try {
                chrome.storage?.local?.set({ tcfy_channel: channel });
            } catch (e) { }
        }

        // Toggle function
        let showingTwitch = true;
        function toggle() {
            showingTwitch = !showingTwitch;
            if (showingTwitch) {
                host.style.display = 'block';
                if (state.originalChat) state.originalChat.style.display = 'none';
                toggleBtn.textContent = 'Show YouTube';
            } else {
                host.style.display = 'none';
                if (state.originalChat) state.originalChat.style.display = '';
                toggleBtn.textContent = 'Show Twitch';
            }
        }

        // Events
        connectBtn.onclick = () => connect(input.value);
        input.onkeydown = (e) => { if (e.key === 'Enter') connect(input.value); };
        toggleBtn.onclick = toggle;

        // Load saved channel
        try {
            chrome.storage?.local?.get(['tcfy_channel'], (r) => {
                if (r?.tcfy_channel) connect(r.tcfy_channel);
            });
        } catch (e) { }

        // Set hint
        const channelEl = document.querySelector('ytd-channel-name a, #channel-name a, #owner-name a');
        if (channelEl?.textContent) {
            const suggested = channelEl.textContent.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
            hint.textContent = 'Suggested: ' + suggested;
            input.value = suggested;
        }

        return host;
    }

    function init() {
        if (state.initialized) return;

        // Find YouTube chat container
        const chatContainer = document.querySelector('#chat, #chat-container');
        if (!chatContainer) return;

        // Already injected?
        if (document.querySelector('#tcfy-shadow-host')) return;

        // Store original chat
        state.originalChat = chatContainer.querySelector('ytd-live-chat-frame, iframe#chatframe');

        // Create and inject our UI
        const host = createShadowUI();
        chatContainer.style.position = 'relative';
        chatContainer.insertBefore(host, chatContainer.firstChild);

        // Hide original
        if (state.originalChat) {
            state.originalChat.style.display = 'none';
        }

        state.initialized = true;
        console.log('[TCFY] Initialized with Shadow DOM');
    }

    // Simple one-time check with retry
    let attempts = 0;
    function check() {
        if (state.initialized || attempts > 10) return;
        attempts++;

        if (document.querySelector('#chat, #chat-container')) {
            init();
        } else {
            setTimeout(check, 2000);
        }
    }

    // Start
    setTimeout(check, 1000);

    // Handle YT navigation
    window.addEventListener('yt-navigate-finish', () => {
        state.initialized = false;
        attempts = 0;
        setTimeout(check, 1500);
    });
})();
