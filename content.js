/**
 * Twitch Chat for YouTube - Content Script
 * Merges Twitch chat with YouTube livestream chat
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    TWITCH_CHAT_URL: 'https://www.twitch.tv/embed/{channel}/chat?parent=www.youtube.com&darkpopout',
    CHECK_INTERVAL: 2000,
    MAX_RETRIES: 10
  };

  // State
  let state = {
    isInitialized: false,
    youtubeChannel: null,
    twitchChannel: null,
    activeView: 'both', // 'both', 'youtube', 'twitch'
    originalChatParent: null,
    originalChatElement: null
  };

  /**
   * Check if the current page is a YouTube livestream
   */
  function isLiveStream() {
    // Check for live chat iframe or live badge
    const chatFrame = document.querySelector('iframe#chatframe');
    const liveBadge = document.querySelector('.ytp-live-badge');
    const liveIndicator = document.querySelector('[aria-label*="LIVE"]');
    
    return !!(chatFrame || (liveBadge && liveBadge.getAttribute('disabled') === null) || liveIndicator);
  }

  /**
   * Extract YouTube channel name from the page
   */
  function getYouTubeChannelName() {
    // Try multiple selectors for channel name
    const selectors = [
      'ytd-channel-name yt-formatted-string a',
      'ytd-channel-name a',
      '#channel-name a',
      '#owner-name a',
      '.ytd-channel-name a'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }

    // Fallback: Try to get from page metadata
    const channelLink = document.querySelector('link[itemprop="name"]');
    if (channelLink) {
      return channelLink.getAttribute('content');
    }

    return null;
  }

  /**
   * Normalize channel name for Twitch lookup
   * (Remove spaces, special chars, lowercase)
   */
  function normalizeTwitchName(name) {
    if (!name) return null;
    return name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Create the merged chat UI
   */
  function createMergedChatUI() {
    const container = document.createElement('div');
    container.className = 'tcfy-container';
    container.id = 'tcfy-merged-chat';

    container.innerHTML = `
      <div class="tcfy-header">
        <div class="tcfy-title">
          <span>💬</span>
          <span>Merged Chat</span>
        </div>
        <div class="tcfy-tabs">
          <button class="tcfy-tab active" data-view="both">Both</button>
          <button class="tcfy-tab youtube-only" data-view="youtube">YouTube</button>
          <button class="tcfy-tab" data-view="twitch">Twitch</button>
        </div>
      </div>
      
      <div class="tcfy-chat-panels">
        <div class="tcfy-chat-panel" id="tcfy-youtube-panel">
          <div class="tcfy-panel-header youtube">
            <span>▶</span> YouTube Chat
          </div>
          <div id="tcfy-youtube-chat-container" style="flex: 1; overflow: hidden;"></div>
        </div>
        
        <div class="tcfy-chat-panel" id="tcfy-twitch-panel">
          <div class="tcfy-panel-header twitch">
            <span>◆</span> Twitch Chat
          </div>
          <iframe 
            id="tcfy-twitch-iframe" 
            class="tcfy-chat-frame"
            src="about:blank"
          ></iframe>
          
          <div class="tcfy-manual-input-overlay" id="tcfy-manual-overlay">
            <div class="tcfy-overlay-icon">📺</div>
            <div class="tcfy-overlay-title">Twitch Channel Not Found</div>
            <div class="tcfy-overlay-message" id="tcfy-overlay-message">
              Could not automatically find a matching Twitch channel for this stream.
            </div>
            <div class="tcfy-input-group">
              <input 
                type="text" 
                class="tcfy-input" 
                id="tcfy-twitch-input" 
                placeholder="Enter Twitch channel"
              />
              <button class="tcfy-btn" id="tcfy-connect-btn">Connect</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="tcfy-status-bar">
        <div class="tcfy-status-item">
          <span class="tcfy-status-dot connected" id="tcfy-yt-status"></span>
          <span>YouTube</span>
        </div>
        <div class="tcfy-status-item">
          <span class="tcfy-status-dot" id="tcfy-twitch-status"></span>
          <span id="tcfy-twitch-channel-display">Twitch: --</span>
        </div>
      </div>
      
      <button class="tcfy-toggle-native" id="tcfy-toggle-native">
        Show Original Chat
      </button>
    `;

    return container;
  }

  /**
   * Set up event listeners for the UI
   */
  function setupEventListeners(container) {
    // Tab switching
    const tabs = container.querySelectorAll('.tcfy-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        setActiveView(view, container);
      });
    });

    // Manual Twitch channel input
    const connectBtn = container.querySelector('#tcfy-connect-btn');
    const input = container.querySelector('#tcfy-twitch-input');
    
    connectBtn.addEventListener('click', () => {
      const channel = input.value.trim();
      if (channel) {
        connectToTwitch(channel, container);
      }
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const channel = input.value.trim();
        if (channel) {
          connectToTwitch(channel, container);
        }
      }
    });

    // Toggle native chat
    const toggleBtn = container.querySelector('#tcfy-toggle-native');
    toggleBtn.addEventListener('click', () => {
      toggleNativeChat();
    });
  }

  /**
   * Set the active view (both, youtube, twitch)
   */
  function setActiveView(view, container) {
    state.activeView = view;

    // Update tab states
    const tabs = container.querySelectorAll('.tcfy-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });

    // Update panel visibility
    const youtubePanel = container.querySelector('#tcfy-youtube-panel');
    const twitchPanel = container.querySelector('#tcfy-twitch-panel');

    youtubePanel.classList.toggle('hidden', view === 'twitch');
    twitchPanel.classList.toggle('hidden', view === 'youtube');
  }

  /**
   * Connect to a Twitch channel
   */
  function connectToTwitch(channel, container) {
    state.twitchChannel = channel;
    
    const iframe = container.querySelector('#tcfy-twitch-iframe');
    const overlay = container.querySelector('#tcfy-manual-overlay');
    const statusDot = container.querySelector('#tcfy-twitch-status');
    const channelDisplay = container.querySelector('#tcfy-twitch-channel-display');

    // Hide overlay and load Twitch chat
    overlay.classList.add('hidden');
    iframe.src = CONFIG.TWITCH_CHAT_URL.replace('{channel}', channel.toLowerCase());
    
    // Update status
    statusDot.classList.add('connected');
    channelDisplay.textContent = `Twitch: ${channel}`;

    // Save preference
    saveChannelMapping(state.youtubeChannel, channel);
  }

  /**
   * Show the manual input overlay with a message
   */
  function showManualInput(container, message) {
    const overlay = container.querySelector('#tcfy-manual-overlay');
    const messageEl = container.querySelector('#tcfy-overlay-message');
    
    if (message) {
      messageEl.textContent = message;
    }
    
    overlay.classList.remove('hidden');
  }

  /**
   * Toggle between merged chat and native YouTube chat
   */
  function toggleNativeChat() {
    const mergedChat = document.querySelector('#tcfy-merged-chat');
    const toggleBtn = document.querySelector('#tcfy-toggle-native');

    if (mergedChat.style.display === 'none') {
      // Show merged chat
      mergedChat.style.display = 'flex';
      if (state.originalChatElement) {
        state.originalChatElement.style.display = 'none';
      }
      toggleBtn.textContent = 'Show Original Chat';
    } else {
      // Show original chat
      mergedChat.style.display = 'none';
      if (state.originalChatElement) {
        state.originalChatElement.style.display = '';
      }
      toggleBtn.textContent = 'Show Merged Chat';
    }
  }

  /**
   * Save channel mapping to storage
   */
  function saveChannelMapping(youtubeChannel, twitchChannel) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        [`channel_${normalizeTwitchName(youtubeChannel)}`]: twitchChannel
      });
    }
  }

  /**
   * Load saved channel mapping from storage
   */
  async function loadChannelMapping(youtubeChannel) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        const key = `channel_${normalizeTwitchName(youtubeChannel)}`;
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] || null);
        });
      });
    }
    return null;
  }

  /**
   * Inject the merged chat UI into the page
   */
  async function injectMergedChat() {
    if (state.isInitialized) return;

    // Find the YouTube chat container
    const chatContainer = document.querySelector('#chat') || 
                          document.querySelector('ytd-live-chat-frame') ||
                          document.querySelector('#chat-container');
    
    if (!chatContainer) {
      console.log('[TCFY] Chat container not found, retrying...');
      return false;
    }

    // Store reference to original chat
    state.originalChatElement = chatContainer.querySelector('iframe#chatframe') || 
                                 chatContainer.querySelector('ytd-live-chat-frame');
    state.originalChatParent = chatContainer;

    // Get YouTube channel name
    state.youtubeChannel = getYouTubeChannelName();
    console.log('[TCFY] YouTube channel:', state.youtubeChannel);

    // Create and inject merged chat UI
    const mergedChat = createMergedChatUI();
    
    // Move original YouTube chat iframe into our container
    const ytChatContainer = mergedChat.querySelector('#tcfy-youtube-chat-container');
    if (state.originalChatElement) {
      const clonedChat = state.originalChatElement.cloneNode(true);
      clonedChat.style.width = '100%';
      clonedChat.style.height = '100%';
      clonedChat.style.border = 'none';
      ytChatContainer.appendChild(clonedChat);
      state.originalChatElement.style.display = 'none';
    }

    // Insert our UI
    chatContainer.style.position = 'relative';
    chatContainer.insertBefore(mergedChat, chatContainer.firstChild);

    // Set up events
    setupEventListeners(mergedChat);

    // Try to auto-connect to Twitch
    await attemptTwitchConnection(mergedChat);

    state.isInitialized = true;
    console.log('[TCFY] Merged chat initialized');
    return true;
  }

  /**
   * Attempt to connect to Twitch automatically
   */
  async function attemptTwitchConnection(container) {
    const youtubeChannel = state.youtubeChannel;
    
    // First, check for saved mapping
    const savedChannel = await loadChannelMapping(youtubeChannel);
    if (savedChannel) {
      console.log('[TCFY] Using saved Twitch channel:', savedChannel);
      connectToTwitch(savedChannel, container);
      return;
    }

    // Try normalized channel name
    const normalizedName = normalizeTwitchName(youtubeChannel);
    if (normalizedName) {
      console.log('[TCFY] Trying Twitch channel:', normalizedName);
      
      // We can't easily check if a Twitch channel is live without API
      // So we'll just try to load it and show manual input as fallback
      const input = container.querySelector('#tcfy-twitch-input');
      input.value = normalizedName;
      
      // Show overlay with suggestion
      showManualInput(
        container, 
        `Suggested Twitch channel: "${normalizedName}". Click Connect to try, or enter a different channel name.`
      );
    } else {
      showManualInput(
        container,
        'Could not detect the YouTube channel name. Please enter the Twitch channel manually.'
      );
    }
  }

  /**
   * Initialize the extension
   */
  function init() {
    console.log('[TCFY] Twitch Chat for YouTube loaded');

    let retries = 0;
    
    const checkAndInject = () => {
      if (!isLiveStream()) {
        console.log('[TCFY] Not a livestream, checking again...');
        if (retries < CONFIG.MAX_RETRIES) {
          retries++;
          setTimeout(checkAndInject, CONFIG.CHECK_INTERVAL);
        }
        return;
      }

      injectMergedChat().then(success => {
        if (!success && retries < CONFIG.MAX_RETRIES) {
          retries++;
          setTimeout(checkAndInject, CONFIG.CHECK_INTERVAL);
        }
      });
    };

    // Start checking
    checkAndInject();

    // Also listen for navigation (YouTube is a SPA)
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        state.isInitialized = false;
        retries = 0;
        setTimeout(checkAndInject, 1000);
      }
    }).observe(document.body, { subtree: true, childList: true });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
