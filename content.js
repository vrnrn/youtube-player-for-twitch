/**
 * Twitch Chat for YouTube - Content Script
 * Replaces YouTube livestream chat with Twitch chat
 */

(function () {
  'use strict';

  // Only run once
  if (window.__tcfyLoaded) return;
  window.__tcfyLoaded = true;

  console.log('[TCFY] Content script loaded');

  const TWITCH_CHAT_URL = 'https://www.twitch.tv/embed/{channel}/chat?parent=www.youtube.com&darkpopout';

  let state = {
    initialized: false,
    showingTwitch: true,
    originalChat: null,
    youtubeChannel: null
  };

  function getChannelName() {
    const selectors = [
      'ytd-channel-name yt-formatted-string a',
      'ytd-channel-name a',
      '#channel-name a',
      '#owner-name a'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent) return el.textContent.trim();
    }
    return null;
  }

  function normalize(name) {
    return name ? name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '') : '';
  }

  function createUI() {
    const div = document.createElement('div');
    div.id = 'tcfy-container';
    div.innerHTML = `
      <div class="tcfy-header">
        <span class="tcfy-title">📺 Twitch Chat</span>
        <button class="tcfy-toggle" id="tcfy-toggle">YouTube</button>
      </div>
      <div class="tcfy-body">
        <iframe id="tcfy-iframe" src="about:blank"></iframe>
        <div class="tcfy-overlay" id="tcfy-overlay">
          <div class="tcfy-form">
            <div class="tcfy-label">Enter Twitch Channel</div>
            <div class="tcfy-hint" id="tcfy-hint"></div>
            <div class="tcfy-row">
              <input type="text" id="tcfy-input" placeholder="channel name" />
              <button id="tcfy-go">Go</button>
            </div>
          </div>
        </div>
      </div>
    `;
    return div;
  }

  function connect(channel) {
    if (!channel) return;
    const iframe = document.getElementById('tcfy-iframe');
    const overlay = document.getElementById('tcfy-overlay');
    iframe.src = TWITCH_CHAT_URL.replace('{channel}', channel.toLowerCase());
    overlay.style.display = 'none';
    document.querySelector('.tcfy-title').textContent = '📺 ' + channel;

    // Save preference
    const key = 'tcfy_' + normalize(state.youtubeChannel);
    try { chrome?.storage?.local?.set({ [key]: channel }); } catch (e) { }
    console.log('[TCFY] Connected:', channel);
  }

  function toggle() {
    state.showingTwitch = !state.showingTwitch;
    const container = document.getElementById('tcfy-container');
    const btn = document.getElementById('tcfy-toggle');

    if (state.showingTwitch) {
      container.style.display = 'flex';
      if (state.originalChat) state.originalChat.style.display = 'none';
      btn.textContent = 'YouTube';
    } else {
      container.style.display = 'none';
      if (state.originalChat) state.originalChat.style.display = '';
      btn.textContent = 'Twitch';
    }
  }

  function init() {
    if (state.initialized) return;

    // Find chat container
    const chat = document.querySelector('#chat');
    if (!chat) return;

    // Check if already injected
    if (document.getElementById('tcfy-container')) return;

    state.originalChat = chat.querySelector('ytd-live-chat-frame') || chat.querySelector('iframe#chatframe');
    state.youtubeChannel = getChannelName();

    // Create and inject UI
    const ui = createUI();
    chat.style.position = 'relative';
    chat.insertBefore(ui, chat.firstChild);

    // Hide original
    if (state.originalChat) state.originalChat.style.display = 'none';

    // Events
    document.getElementById('tcfy-toggle').onclick = toggle;
    document.getElementById('tcfy-go').onclick = () => connect(document.getElementById('tcfy-input').value.trim());
    document.getElementById('tcfy-input').onkeypress = (e) => {
      if (e.key === 'Enter') connect(e.target.value.trim());
    };

    // Try to load saved channel
    const suggested = normalize(state.youtubeChannel);
    const input = document.getElementById('tcfy-input');
    const hint = document.getElementById('tcfy-hint');

    if (suggested) {
      input.value = suggested;
      hint.textContent = 'Suggested: ' + suggested;
    }

    const key = 'tcfy_' + suggested;
    try {
      chrome?.storage?.local?.get([key], (r) => {
        if (r?.[key]) connect(r[key]);
      });
    } catch (e) { }

    state.initialized = true;
    console.log('[TCFY] Initialized for:', state.youtubeChannel);
  }

  // Simple polling - stops once initialized
  let attempts = 0;
  function check() {
    if (state.initialized || attempts > 15) return;
    attempts++;

    const hasChat = document.querySelector('#chat');
    if (hasChat) {
      init();
    } else {
      setTimeout(check, 1500);
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    setTimeout(check, 500);
  }

  // Handle YouTube navigation
  window.addEventListener('yt-navigate-finish', () => {
    state.initialized = false;
    attempts = 0;
    setTimeout(check, 1000);
  });
})();
