/**
 * YouTube on Twitch - Content Script
 * 
 * Features:
 * - Overlays YouTube player on Twitch stream
 * - Preserves Twitch chat
 * - Auto-finds YouTube stream based on Twitch channel name
 * - Syncs playback speed to catch up with live edge
 * - Persists state across page reloads and navigation
 * 
 * @author YouTube on Twitch Team
 */

(function () {
    'use strict';

    // Prevent double execution
    if (window.__ytOnTwitchLoaded) return;
    window.__ytOnTwitchLoaded = true;

    // =====================
    // Configuration
    // =====================
    const CONFIG = {
        SYNC_INTERVAL: 10 * 60 * 1000, // 10 minutes
        SYNC_SPEED: 2.0,               // Speed to catch up
        NORMAL_SPEED: 1.0,             // Normal playback speed
        CHECK_INTERVAL: 1500,          // Poll interval for nav bar
        MAX_ATTEMPTS: 15               // Max checks for nav bar before giving up
    };

    // =====================
    // State Management
    // =====================
    const state = {
        initialized: false,
        youtubeVideoId: null,
        twitchVideo: null,
        autoSyncEnabled: false,
        syncIntervalId: null,
        isSyncing: false
    };

    /**
     * Persist data to Chrome storage
     * @param {string} key 
     * @param {any} value 
     */
    function saveState(key, value) {
        if (!chrome.runtime?.id) return;
        try {
            chrome.storage?.local?.set({ [key]: value });
        } catch (e) {
            // Silent fail
        }
    }

    /**
     * Retrieve data from Chrome storage
     * @param {string} key 
     * @returns {Promise<any>}
     */
    function loadState(key) {
        return new Promise((resolve) => {
            if (!chrome.runtime?.id) {
                resolve(null);
                return;
            }
            try {
                chrome.storage?.local?.get([key], (result) => resolve(result?.[key]));
            } catch (e) {
                resolve(null);
            }
        });
    }

    /**
     * Get current Twitch channel name from URL
     * @returns {string|null}
     */
    function getTwitchChannel() {
        // Matches /channelName at start of path
        const match = window.location.pathname.match(/^\/([a-zA-Z0-9_]+)/);
        return match ? match[1].toLowerCase() : null;
    }

    // =====================
    // UI Components
    // =====================

    /**
     * Creates the main navigation button and dropdown menu
     * @returns {HTMLElement} Wrapper element containing button and dropdown
     */
    function createNavButton() {
        const wrapper = document.createElement('div');
        wrapper.id = 'ytot-nav-wrapper';

        wrapper.innerHTML = `
            <button class="ytot-nav-btn" id="ytot-toggle" aria-label="Toggle YouTube Player">
                <span class="ytot-icon">▶</span>
                <span class="ytot-label">YouTube</span>
            </button>
            
            <div class="ytot-dropdown" id="ytot-dropdown">
                <div class="ytot-dropdown-header">
                    <span>Watch YouTube Stream</span>
                    <button class="ytot-close" id="ytot-close" aria-label="Close">×</button>
                </div>
                
                <!-- Auto-Find Section -->
                <div class="ytot-autofind" id="ytot-autofind-section">
                    <button class="ytot-autofind-btn" id="ytot-autofind">🔍 Find YouTube Stream</button>
                    <div class="ytot-search-result" id="ytot-search-result"></div>
                </div>

                <!-- History Section -->
                <div id="ytot-history-section" class="ytot-history-section"></div>
                
                <div class="ytot-divider">or paste URL</div>
                
                <!-- Manual Input -->
                <div class="ytot-dropdown-body">
                    <input type="text" id="ytot-url" placeholder="Paste YouTube URL" spellcheck="false" />
                    <button class="ytot-go" id="ytot-go">Go</button>
                </div>
                
                <!-- Options -->
                <div class="ytot-options">
                    <label class="ytot-option">
                        <input type="checkbox" id="ytot-autosync" />
                        <span>Auto-sync (catch up every 10 min)</span>
                    </label>
                </div>
                
                <!-- Actions -->
                <div class="ytot-actions">
                    <button class="ytot-sync-now" id="ytot-sync-now">⚡ Sync Now</button>
                    <button class="ytot-restore" id="ytot-restore">Restore Twitch</button>
                </div>
                
                <div class="ytot-status" id="ytot-status"></div>
            </div>
        `;
        return wrapper;
    }

    /**
     * Updates the toggle button appearance based on active state
     * @param {boolean} isActive 
     */
    function updateToggleButton(isActive) {
        const toggle = document.getElementById('ytot-toggle');
        const icon = toggle?.querySelector('.ytot-icon');
        const label = toggle?.querySelector('.ytot-label');
        const restore = document.getElementById('ytot-restore');
        const syncNow = document.getElementById('ytot-sync-now');

        if (isActive) {
            toggle?.classList.add('active');
            if (icon) icon.textContent = '🔴';
            if (label) label.textContent = 'Live';
            if (restore) restore.style.display = 'block';
            if (syncNow) syncNow.style.display = 'block';
        } else {
            toggle?.classList.remove('active');
            if (icon) icon.textContent = '▶';
            if (label) label.textContent = 'YouTube';
            if (restore) restore.style.display = 'none';
            if (syncNow) syncNow.style.display = 'none';
        }
    }

    function updateStatus(message, type = '') {
        const status = document.getElementById('ytot-status');
        if (status) {
            status.textContent = message;
            status.className = 'ytot-status' + (type ? ` ytot-status-${type}` : '');
        }
    }

    function closeDropdown() {
        document.getElementById('ytot-dropdown')?.classList.remove('visible');
    }

    async function addToHistory(videoId, metadata) {
        if (!videoId) return;

        const history = (await loadState('ytot_history')) || [];
        const newItem = {
            videoId,
            title: metadata?.title || videoId,
            channel: metadata?.channel || 'Unknown Channel',
            timestamp: Date.now()
        };

        // Remove duplicates (by videoId)
        const filtered = history.filter(h => h.videoId !== videoId);

        // Add to top
        filtered.unshift(newItem);

        // Keep max 5
        const trimmed = filtered.slice(0, 5);

        saveState('ytot_history', trimmed);
        renderHistory();
    }

    async function renderHistory() {
        const container = document.getElementById('ytot-history-section');
        if (!container) return;

        const history = (await loadState('ytot_history')) || [];

        if (history.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="ytot-history-header">
                <span>Recent Streams</span>
                <button class="ytot-clear-history" id="ytot-clear-history" title="Clear History">Clear</button>
            </div>
            <div class="ytot-history-list">
                ${history.map(item => `
                    <div class="ytot-history-item" data-video-id="${item.videoId}">
                        <div class="ytot-history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                        <div class="ytot-history-channel">${escapeHtml(item.channel)}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Clear button listener
        const clearBtn = container.querySelector('#ytot-clear-history');
        if (clearBtn) {
            clearBtn.onclick = (e) => {
                e.stopPropagation();
                saveState('ytot_history', []);
                renderHistory();
            };
        }

        // Add click listeners
        container.querySelectorAll('.ytot-history-item').forEach(el => {
            el.onclick = () => {
                const videoId = el.getAttribute('data-video-id');
                const item = history.find(h => h.videoId === videoId);
                injectYouTube(videoId, item);
            };
        });
    }

    // =====================
    // Parsing & Search logic
    // =====================

    /**
     * Extracts YouTube Video ID from various URL formats
     * @param {string} url 
     * @returns {string|null} Video ID
     */
    function extractVideoId(url) {
        if (!url) return null;
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Calculates Levenshtein distance for fuzzy string matching
     */
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + cost, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     * Searches YouTube for a livestream matching the Twitch channel name
     * Uses background script to bypass CORS
     */
    async function searchYouTubeLive(channelName) {
        if (!channelName) return null;

        const resultDiv = document.getElementById('ytot-search-result');
        resultDiv.innerHTML = '<div class="ytot-searching">🔍 Searching...</div>';

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SEARCH_YOUTUBE',
                query: `${channelName} live`
            });

            if (!response || response.error) {
                console.error('[YTOT] Search error:', response?.error);
                throw new Error(response?.error || 'Search failed');
            }

            const contents = response.results;
            if (!contents || contents.length === 0) throw new Error('No results found');

            // Find best match
            const normalizedChannel = channelName.toLowerCase().replace(/[^a-z0-9]/g, '');

            // 1. Exact/Close Match
            for (const video of contents) {
                const normalizedResult = video.channel.toLowerCase().replace(/[^a-z0-9]/g, '');
                const isSimilar = normalizedResult.includes(normalizedChannel) ||
                    normalizedChannel.includes(normalizedResult) ||
                    levenshteinDistance(normalizedChannel, normalizedResult) <= 3;

                if (isSimilar) return { ...video, channel: video.channel };
            }

            // 2. Fallback: First live result
            return { ...contents[0], approximate: true };

        } catch (e) {
            console.error('[YTOT] Search error:', e);
            return null;
        }
    }

    async function handleAutoFind() {
        const channel = getTwitchChannel();
        if (!channel) {
            updateStatus('Could not detect Twitch channel', 'error');
            return;
        }

        const result = await searchYouTubeLive(channel);
        const resultDiv = document.getElementById('ytot-search-result');

        if (result) {
            const approxNote = result.approximate ? '<div class="ytot-result-note">⚠️ Best match (channel name differs)</div>' : '';
            resultDiv.innerHTML = `
                <div class="ytot-result-card">
                    ${approxNote}
                    <div class="ytot-result-title">${escapeHtml(result.title)}</div>
                    <div class="ytot-result-channel">📺 ${escapeHtml(result.channel)}</div>
                    <button class="ytot-result-use" data-video-id="${result.videoId}">▶ Use This Stream</button>
                </div>
            `;
            resultDiv.querySelector('.ytot-result-use').onclick = () => injectYouTube(result.videoId, result);
        } else {
            resultDiv.innerHTML = '<div class="ytot-no-result">No live stream found for this channel</div>';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =====================
    // Player Control
    // =====================

    /**
     * Pauses and mutes the Twitch player
     */
    function pauseTwitch() {
        const video = document.querySelector('video');
        if (video) {
            video.pause();
            video.muted = true;
            state.twitchVideo = video;
        }
    }

    /**
     * Resumes the Twitch player
     */
    function resumeTwitch() {
        if (state.twitchVideo) {
            state.twitchVideo.muted = false;
            state.twitchVideo.play().catch(() => { });
        }
    }

    /**
     * Injects YouTube iframe over the Twitch player
     * @param {string} videoId 
     * @param {object} metadata Optional metadata { title, channel }
     */
    function injectYouTube(videoId, metadata = null) {
        if (!videoId) return;

        // Update History
        if (metadata) {
            addToHistory(videoId, metadata);
        } else {
            // Fetch metadata asynchronously
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({
                    type: 'GET_VIDEO_DETAILS',
                    videoId
                }, (response) => {
                    if (response && !response.error) {
                        addToHistory(videoId, response);
                    } else {
                        addToHistory(videoId, { title: videoId, channel: 'Manual Entry' });
                    }
                });
            }
        }

        // Try multiple selectors to support Twitch layout changes
        const container = document.querySelector('[data-a-target="video-player-layout"]') ||
            document.querySelector('.video-player__container') ||
            document.querySelector('.video-player');

        if (!container) {
            updateStatus('Error: Player not found', 'error');
            return;
        }

        pauseTwitch();

        // Cleanup existing
        document.getElementById('ytot-youtube-wrapper')?.remove();

        // Create overlay
        const wrapper = document.createElement('div');
        wrapper.id = 'ytot-youtube-wrapper';

        const iframe = document.createElement('iframe');
        iframe.id = 'ytot-youtube-player';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        iframe.setAttribute('allowfullscreen', 'true');

        wrapper.appendChild(iframe);
        container.style.position = 'relative';
        container.appendChild(wrapper);

        // Update state
        state.youtubeVideoId = videoId;
        const channel = getTwitchChannel();
        saveState(`ytot_${channel}`, videoId);
        saveState(`ytot_active_${channel}`, videoId); // Mark as active for persistence

        // UI Updates
        updateToggleButton(true);
        closeDropdown();
        updateStatus('YouTube playing', 'success');

        if (state.autoSyncEnabled) {
            startAutoSync();
        }

        console.log('[YTOT] YouTube injected:', videoId);
    }

    /**
     * Removes the YouTube overlay and restores Twitch player
     * @param {boolean} keepState If true, preserves active state (used during navigation)
     */
    function removeYouTube(keepState = false) {
        document.getElementById('ytot-youtube-wrapper')?.remove();
        resumeTwitch();
        stopAutoSync();

        state.youtubeVideoId = null;
        updateToggleButton(false);
        updateStatus('');

        // Clean up active state only if user explicitly requested removal
        if (!keepState) {
            saveState(`ytot_active_${getTwitchChannel()}`, null);
        }
    }

    // =====================
    // Sync Logic
    // =====================

    /**
     * Forces the YouTube player to jump to live edge
     * Strategy: Seek to far future -> 2x speed for 5s -> Normal speed
     */
    function syncNow() {
        const iframe = document.getElementById('ytot-youtube-player');
        if (!iframe) return;

        state.isSyncing = true;
        updateStatus('⚡ Jumping to live...', 'syncing');

        try {
            // Post commands to YouTube Embed API
            const sendCmd = (func, args) => {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
            };

            // 1. Jump to live
            sendCmd('seekTo', [999999, true]);

            // 2. Speed up briefly
            setTimeout(() => {
                updateStatus('⚡ Catching up at 2x...', 'syncing');
                sendCmd('setPlaybackRate', [CONFIG.SYNC_SPEED]);

                // 3. Return to normal
                setTimeout(() => {
                    sendCmd('setPlaybackRate', [CONFIG.NORMAL_SPEED]);
                    state.isSyncing = false;
                    updateStatus('✓ Synced to live', 'success');

                    // Clear status message
                    setTimeout(() => {
                        if (!state.isSyncing) updateStatus('');
                    }, 3000);
                }, 5000);
            }, 500);

        } catch (e) {
            state.isSyncing = false;
            updateStatus('Sync failed', 'error');
        }
    }

    function startAutoSync() {
        if (state.syncIntervalId) return;
        state.syncIntervalId = setInterval(() => {
            if (state.youtubeVideoId && !state.isSyncing) syncNow();
        }, CONFIG.SYNC_INTERVAL);
        console.log('[YTOT] Auto-sync started');
    }

    function stopAutoSync() {
        if (state.syncIntervalId) {
            clearInterval(state.syncIntervalId);
            state.syncIntervalId = null;
        }
    }

    // =====================
    // Lifecycle & Events
    // =====================

    function setupEventListeners() {
        const toggle = document.getElementById('ytot-toggle');
        const dropdown = document.getElementById('ytot-dropdown');
        const close = document.getElementById('ytot-close');
        const urlInput = document.getElementById('ytot-url');
        const goBtn = document.getElementById('ytot-go');
        const restore = document.getElementById('ytot-restore');
        const syncNowBtn = document.getElementById('ytot-sync-now');
        const autoSyncCheckbox = document.getElementById('ytot-autosync');
        const autoFindBtn = document.getElementById('ytot-autofind');

        autoFindBtn.onclick = handleAutoFind;
        toggle.onclick = () => dropdown.classList.toggle('visible');
        close.onclick = closeDropdown;

        const handleGo = () => {
            const videoId = extractVideoId(urlInput.value);
            if (videoId) injectYouTube(videoId);
            else updateStatus('Invalid YouTube URL', 'error');
        };

        goBtn.onclick = handleGo;
        urlInput.onkeydown = (e) => {
            if (e.key === 'Enter') handleGo();
        };

        restore.onclick = () => removeYouTube(false); // Explicit removal
        syncNowBtn.onclick = syncNow;

        autoSyncCheckbox.onchange = (e) => {
            state.autoSyncEnabled = e.target.checked;
            saveState('ytot_autosync', state.autoSyncEnabled);
            state.autoSyncEnabled && state.youtubeVideoId ? startAutoSync() : stopAutoSync();
        };

        // Close on click outside
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('ytot-nav-wrapper');
            if (wrapper && !wrapper.contains(e.target)) closeDropdown();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDropdown();
        });
    }

    let spawnAttempts = 0;

    async function init() {
        if (state.initialized) return;

        // Try to insert into Twitch Top Nav
        const leftNav = document.querySelector('.top-nav__menu > div:first-child') ||
            document.querySelector('button[aria-label="More Options"]')?.closest('div[class]')?.parentElement;

        if (!leftNav) return;

        // Clean up any stale elements
        document.getElementById('ytot-nav-wrapper')?.remove();

        leftNav.appendChild(createNavButton());
        setupEventListeners();

        // Restore Settings
        const savedAutoSync = await loadState('ytot_autosync');
        if (savedAutoSync) {
            state.autoSyncEnabled = true;
            document.getElementById('ytot-autosync').checked = true;
        }

        renderHistory();

        // Restore Active Stream or Last Used
        const channel = getTwitchChannel();
        if (channel) {
            const activeStream = await loadState(`ytot_active_${channel}`);
            if (activeStream) {
                console.log('[YTOT] Restoring active stream:', activeStream);
                injectYouTube(activeStream);
            } else {
                const savedVideoId = await loadState(`ytot_${channel}`);
                if (savedVideoId) {
                    const urlInput = document.getElementById('ytot-url');
                    if (urlInput) {
                        urlInput.value = `https://youtube.com/watch?v=${savedVideoId}`;
                        urlInput.placeholder = 'Last: ' + savedVideoId;
                    }
                }
            }
        }

        state.initialized = true;
        console.log('[YTOT] Initialized for:', channel);
    }

    // =====================
    // Main Loop
    // =====================
    let lastUrl = location.href;

    function check() {
        // If nav bar exists but we aren't initialized, try init
        if (!state.initialized && document.querySelector('.top-nav__menu')) {
            init();
        } else if (!state.initialized && spawnAttempts <= CONFIG.MAX_ATTEMPTS) {
            spawnAttempts++;
            setTimeout(check, CONFIG.CHECK_INTERVAL);
        }
    }

    // SPA Navigation Detection
    function handleNavigation() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[YTOT] Navigation detected');

            // Navigate away: clear UI but keep state
            removeYouTube(true);
            state.initialized = false;
            state.youtubeVideoId = null;
            spawnAttempts = 0;

            // Re-bind to new page
            setTimeout(check, 500);
        }
    }

    // Observer for immediate detection (Title changes on nav)
    const observer = new MutationObserver(() => {
        handleNavigation();
    });

    if (document.head) {
        observer.observe(document.head, { childList: true, subtree: true });
    }

    // Backup interval (slower check for robustness)
    setInterval(handleNavigation, 2000);

    setTimeout(check, 1000);

})();
