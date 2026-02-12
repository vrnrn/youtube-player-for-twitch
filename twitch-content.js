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
        MAX_ATTEMPTS: 15,              // Max checks for nav bar before giving up
        QUALITY_CHECK_INTERVAL: 5 * 60 * 1000 // 5 minutes
    };

    const VIDEO_ID_PATTERNS = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ];

    // =====================
    // State Management
    // =====================
    const state = {
        initialized: false,
        youtubeVideoId: null,
        twitchVideo: null,
        autoSyncEnabled: false,
        syncIntervalId: null,
        isSyncing: false,
        forceHighestQuality: false,
        qualityIntervalId: null
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
                <span class="ytot-icon">\u25B6</span>
                <span class="ytot-label">YouTube</span>
            </button>
            
            <div class="ytot-dropdown" id="ytot-dropdown">
                <div class="ytot-dropdown-header">
                    <span>Watch YouTube Stream</span>
                    <button class="ytot-close" id="ytot-close" aria-label="Close">×</button>
                </div>
                
                <!-- Auto-Find Section -->
                <div class="ytot-autofind" id="ytot-autofind-section">
                    <button class="ytot-autofind-btn" id="ytot-autofind">\uD83D\uDD0D Find YouTube Stream</button>
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
                    <label class="ytot-option">
                        <input type="checkbox" id="ytot-quality" />
                        <span>Force Highest Quality (Source)</span>
                    </label>
                </div>
                
                <!-- Actions -->
                <div class="ytot-actions">
                    <button class="ytot-theater-btn" id="ytot-theater" title="Toggle Theater Mode (Alt+T)">\uD83C\uDFAD Theater</button>
                    <button class="ytot-sync-now" id="ytot-sync-now">\u26A1 Sync Now</button>
                    <button class="ytot-restore" id="ytot-restore">Restore Twitch</button>
                </div>
                
                <div class="ytot-status" id="ytot-status"></div>
            </div>
        `;
        return wrapper;
    }

    const uiCache = {};

    function refreshDOMCache() {
        const toggle = document.getElementById('ytot-toggle');
        uiCache.toggle = toggle;
        uiCache.icon = toggle?.querySelector('.ytot-icon');
        uiCache.label = toggle?.querySelector('.ytot-label');
        uiCache.restore = document.getElementById('ytot-restore');
        uiCache.syncNow = document.getElementById('ytot-sync-now');
        uiCache.theater = document.getElementById('ytot-theater');
    }

    /**
     * Updates the toggle button appearance based on active state
     * @param {boolean} isActive 
     */
    function updateToggleButton(isActive) {
        // Fallback if cache is empty (safety net)
        if (!uiCache.toggle) refreshDOMCache();

        const { toggle, icon, label, restore, syncNow } = uiCache;

        if (isActive) {
            toggle?.classList.add('active');
            if (icon) icon.textContent = '\uD83D\uDD34';
            if (label) label.textContent = 'Live';
            if (restore) restore.style.display = 'block';
            if (syncNow) syncNow.style.display = 'block';
        } else {
            toggle?.classList.remove('active');
            if (icon) icon.textContent = '\u25B6';
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

    /**
     * Toggles Twitch theater mode by finding and clicking the native button
     */
    function toggleTheaterMode() {
        const theaterBtn = document.querySelector('[data-a-target="player-theater-mode-button"]') ||
                          document.querySelector('button[aria-label*="Theater Mode"]');

        if (theaterBtn) {
            theaterBtn.click();
            console.log('[YTOT] Theater mode toggled');
        } else {
            console.warn('[YTOT] Theater mode button not found');
            // Fallback: try to dispatch Alt+T to the document
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: 't',
                altKey: true,
                bubbles: true
            }));
        }
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
        for (const pattern of VIDEO_ID_PATTERNS) {
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

        if (a.length > b.length) {
            [a, b] = [b, a];
        }

        const row = new Array(a.length + 1);
        for (let i = 0; i <= a.length; i++) {
            row[i] = i;
        }

        for (let i = 1; i <= b.length; i++) {
            let prevDiagonal = row[0];
            row[0] = i;

            for (let j = 1; j <= a.length; j++) {
                const temp = row[j];
                const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;

                row[j] = Math.min(
                    prevDiagonal + cost,
                    temp + 1,
                    row[j - 1] + 1
                );

                prevDiagonal = temp;
            }
        }
        return row[a.length];
    }

    /**
     * Searches YouTube for a livestream matching the Twitch channel name
     * Uses background script to bypass CORS
     */
    async function searchYouTubeLive(channelName) {
        if (!channelName) return null;

        const resultDiv = document.getElementById('ytot-search-result');
        resultDiv.innerHTML = '<div class="ytot-searching">\uD83D\uDD0D Searching...</div>';

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
            const approxNote = result.approximate ? '<div class="ytot-result-note">\u26A0\uFE0F Best match (channel name differs)</div>' : '';
            resultDiv.innerHTML = `
                <div class="ytot-result-card">
                    ${approxNote}
                    <div class="ytot-result-title">${escapeHtml(result.title)}</div>
                    <div class="ytot-result-channel">\uD83D\uDCFA ${escapeHtml(result.channel)}</div>
                    <button class="ytot-result-use" data-video-id="${result.videoId}">\u25B6 Use This Stream</button>
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

        const theaterToggle = document.createElement('button');
        theaterToggle.id = 'ytot-player-theater';
        theaterToggle.innerHTML = '\uD83C\uDFAD';
        theaterToggle.title = 'Toggle Theater Mode (Alt+T)';
        theaterToggle.onclick = (e) => {
            e.stopPropagation();
            toggleTheaterMode();
        };
        wrapper.appendChild(theaterToggle);

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
        updateStatus('\u26A1 Jumping to live...', 'syncing');

        try {
            // Post commands to YouTube Embed API
            const sendCmd = (func, args) => {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
            };

            // 1. Jump to live
            sendCmd('seekTo', [999999, true]);

            // 2. Speed up briefly
            setTimeout(() => {
                updateStatus('\u26A1 Catching up at 2x...', 'syncing');
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
    // Quality Enforcement
    // =====================

    /**
     * Enforces the user's preferred Twitch stream quality
     */
    function enforceQuality() {
        if (!state.forceHighestQuality) return;

        try {
            // Twitch stores quality in localStorage under 'video-quality'
            // Format: {"default":"160p30"} or {"default":"chunked"} (Source)
            const qualityKey = 'video-quality';
            const currentSettings = JSON.parse(window.localStorage.getItem(qualityKey) || '{}');

            // Map simple values to likely Twitch keys if needed, but for now we try direct mapping
            // Note: Twitch often appends '30' or '60' to resolution (e.g., '160p30').
            // We'll rely on the user selecting an option that roughly matches, or we'd need
            // to fetch available qualities from the player, which is complex.
            // For this feature, we'll try to set what we know.

            // Heuristic updates: if user wants 160p, we might set '160p30' if exact '160p' doesn't work?
            // Actually, localStorage is aggressive. Let's try setting exactly what we want.
            // If it fails, we might need a more complex "get available qualities" loop.

            // Simple mapping for safety
            // 'chunked' is the internal string Twitch uses for "Source" quality (maximum available).
            // This ensures we always request the highest possible resolution and framerate 
            // from the video server (e.g. 1080p60, 4K, etc).
            const target = 'chunked';



            if (currentSettings.default !== target) {
                const newSettings = { ...currentSettings, default: target };
                window.localStorage.setItem(qualityKey, JSON.stringify(newSettings));
                console.log('[YTOT] Enforced quality:', target);
            }
        } catch (e) {
            console.error('[YTOT] Failed to enforce quality:', e);
        }
    }

    function startQualityEnforcement() {
        if (state.qualityIntervalId) return;
        // Run immediately
        enforceQuality();
        state.qualityIntervalId = setInterval(enforceQuality, CONFIG.QUALITY_CHECK_INTERVAL);
        console.log('[YTOT] Quality enforcement started');
    }

    function stopQualityEnforcement() {
        if (state.qualityIntervalId) {
            clearInterval(state.qualityIntervalId);
            state.qualityIntervalId = null;
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

        const theaterBtn = document.getElementById('ytot-theater');
        if (theaterBtn) {
            theaterBtn.onclick = () => toggleTheaterMode();
        }

        autoSyncCheckbox.onchange = (e) => {
            state.autoSyncEnabled = e.target.checked;
            saveState('ytot_autosync', state.autoSyncEnabled);
            state.autoSyncEnabled && state.youtubeVideoId ? startAutoSync() : stopAutoSync();
        };

        const qualityCheckbox = document.getElementById('ytot-quality');
        qualityCheckbox.onchange = (e) => {
            state.forceHighestQuality = e.target.checked;
            saveState('ytot_force_highest', state.forceHighestQuality);
            if (state.forceHighestQuality) {
                enforceQuality();
                startQualityEnforcement();
            } else {
                stopQualityEnforcement();
            }
        };

        // Close on click outside
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('ytot-nav-wrapper');
            if (wrapper && !wrapper.contains(e.target)) closeDropdown();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDropdown();

            // Ignore shortcuts if typing in input/textarea/contenteditable
            const target = e.target;
            const isTyping = target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.isContentEditable;

            if (isTyping) return;

            // Alt+T: Toggle Theater Mode
            if (e.altKey && (e.key === 't' || e.key === 'T')) {
                e.preventDefault();
                toggleTheaterMode();
            }

            // Alt+Y: Toggle Dropdown
            if (e.altKey && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                const dropdown = document.getElementById('ytot-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('visible');
                    if (dropdown.classList.contains('visible')) {
                        document.getElementById('ytot-url')?.focus();
                    }
                }
            }
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
        refreshDOMCache();

        // Restore Settings
        const savedAutoSync = await loadState('ytot_autosync');
        if (savedAutoSync) {
            state.autoSyncEnabled = true;
            document.getElementById('ytot-autosync').checked = true;
        }

        const savedForceHighest = await loadState('ytot_force_highest');
        if (savedForceHighest) {
            state.forceHighestQuality = true;
            const qualityCheckbox = document.getElementById('ytot-quality');
            if (qualityCheckbox) qualityCheckbox.checked = true;
            startQualityEnforcement();
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
