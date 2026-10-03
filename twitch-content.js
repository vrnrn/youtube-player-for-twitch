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

    const Logger = {
        log: (...args) => console.log('[YTOT]', ...args),
        error: (...args) => console.error('[YTOT]', ...args),
        warn: (...args) => console.warn('[YTOT]', ...args)
    };

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
        FAST_CHECK_INTERVAL: 250,      // Fast poll interval for initial load
        MAX_ATTEMPTS: 60,              // Max checks for nav bar before giving up (increased for fast start)
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
    const MENU_ICONS = {
        close: 'm6 6 12 12M18 6 6 18',
        chevron: 'm6 9 6 6 6-6',
        search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
        sync: 'M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7',
        theatre: 'M3 5h18v14H3zM16 5v14'
    };
    const menuIcon = name => '<svg class="ytot-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + MENU_ICONS[name] + '"></path></svg>';

    /**
     * Creates the main navigation button and dropdown menu
     * @returns {HTMLElement} Wrapper element containing button and dropdown
     */
    function createNavButton() {
        const wrapper = document.createElement('div');
        wrapper.id = 'ytot-nav-wrapper';

        wrapper.innerHTML = `
            <button class="ytot-nav-btn" id="ytot-toggle" aria-label="Toggle YouTube Player" title="Toggle YouTube" aria-haspopup="true" aria-expanded="false" aria-controls="ytot-dropdown">
                <span class="ytot-icon">▶</span>
                <span class="ytot-label">YouTube</span>
            </button>
            
            <div class="ytot-dropdown" id="ytot-dropdown">
                <div class="ytot-dropdown-header">
                    <div>
                        <span class="ytot-menu-title">YouTube on Twitch</span>
                        <span class="ytot-menu-subtitle">Your stream, with Twitch chat</span>
                    </div>
                    <button class="ytot-close" id="ytot-close" aria-label="Close">${menuIcon('close')}</button>
                </div>
                
                <!-- Auto-Find Section -->
                <div class="ytot-autofind" id="ytot-autofind-section">
                    <button class="ytot-autofind-btn" id="ytot-autofind">${menuIcon('search')}<span>Find YouTube Stream</span></button>
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
                
                <div class="ytot-layout-controls">
                    <button type="button" class="ytot-theatre" id="ytot-theatre" aria-pressed="false" disabled>${menuIcon('theatre')}<span id="ytot-theatre-label">Theatre Mode</span></button>
                </div>

                <!-- Options -->
                <details class="ytot-additional-settings" id="ytot-additional-settings">
                    <summary><span>Additional settings</span>${menuIcon('chevron')}</summary>
                    <div class="ytot-settings-body">
                        <section class="ytot-settings-group" aria-label="Playback settings">
                            <div class="ytot-section-label">Playback</div>
                            <label class="ytot-option">
                                <input type="checkbox" role="switch" id="ytot-autosync" />
                                <span class="ytot-option-copy"><span class="ytot-option-title">Auto-sync</span><span class="ytot-option-description">Catch up every 10 minutes</span></span>
                            </label>
                            <label class="ytot-option">
                                <input type="checkbox" role="switch" id="ytot-quality" />
                                <span class="ytot-option-copy"><span class="ytot-option-title">Highest Twitch quality</span><span class="ytot-option-description">Keep Twitch set to Source</span></span>
                            </label>
                        </section>
                        <section class="ytot-settings-group" aria-label="Floating chat settings">
                            <div class="ytot-section-label">Chat</div>
                            <label class="ytot-option">
                                <input type="checkbox" role="switch" id="ytot-chat-toggle" />
                                <span class="ytot-option-copy"><span class="ytot-option-title">Floating chat</span></span>
                            </label>
                            <details class="ytot-chat-settings" id="ytot-chat-settings" hidden>
                                <summary><span>Chat appearance</span>${menuIcon('chevron')}</summary>
                                <label class="ytot-chat-setting">Show <select id="ytot-chat-mode"><option value="fullscreen">Fullscreen only</option><option value="always">Always on player</option></select></label>
                                <label class="ytot-chat-setting">Background <input type="color" id="ytot-chat-color" aria-label="Chat background color" /></label>
                                <label class="ytot-chat-setting">Opacity <input type="range" id="ytot-chat-opacity" min="0" max="100" step="5" aria-label="Chat background opacity" /></label>
                                <label class="ytot-chat-setting">Text size <input type="range" id="ytot-chat-font" min="11" max="24" aria-label="Chat text size" /></label>
                                <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-chat-compact" /><span>Compact</span></label>
                                <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-chat-through" /><span>Click-through</span></label>
                                <button type="button" class="ytot-vaft-reload" id="ytot-chat-reset">Reset position &amp; size</button>
                            </details>
                        </section>
                        <section class="ytot-settings-group" aria-label="Player extras">
                            <div class="ytot-section-label">Player extras</div>
                            <label class="ytot-option">
                                <input type="checkbox" role="switch" id="ytot-hide-extensions" />
                                <span class="ytot-option-copy"><span class="ytot-option-title">Hide Twitch extensions</span></span>
                            </label>
                            <div class="ytot-vaft-card">
                                <label class="ytot-option">
                                    <input type="checkbox" role="switch" id="ytot-vaft" disabled aria-describedby="ytot-vaft-status" />
                                    <span class="ytot-option-copy"><span class="ytot-option-title">Interruption blocking <span class="ytot-badge">Experimental</span></span></span>
                                </label>
                                <div id="ytot-vaft-status" class="ytot-vaft-status" role="status" aria-live="polite">Checking setting…</div>
                                <button id="ytot-vaft-reload" class="ytot-vaft-reload" hidden>Reload Twitch to apply</button>
                            </div>
                        </section>
                    </div>
                </details>
                
                <!-- Actions -->
                <div class="ytot-actions" id="ytot-actions" hidden>
                    <button class="ytot-sync-now" id="ytot-sync-now" title="Sync">${menuIcon('sync')}<span>Sync Now</span></button>
                    <button class="ytot-restore" id="ytot-restore">Restore Twitch</button>
                </div>
                
                <div class="ytot-status" id="ytot-status"></div>
            </div>
        `;
        return wrapper;
    }

    // A root attribute makes this preference survive native player/SPA replacement
    // without observing or changing third-party iframe documents.
    const HIDE_EXTENSIONS_KEY = 'ytot_hide_extensions';
    let hideExtensions = false;
    let extensionsRevision = 0;
    function applyExtensionVisibility(value) {
        hideExtensions = value === true;
        extensionsRevision++;
        if (hideExtensions) document.documentElement.setAttribute('data-ypft-hide-extensions', '');
        else document.documentElement.removeAttribute('data-ypft-hide-extensions');
        const toggle = document.getElementById('ytot-hide-extensions');
        if (toggle) toggle.checked = hideExtensions;
    }
    const initialExtensionsRevision = extensionsRevision;
    loadState(HIDE_EXTENSIONS_KEY).then(value => {
        if (extensionsRevision === initialExtensionsRevision) applyExtensionVisibility(value);
    });

    const uiCache = {};
    let vaftEnabled = null;
    let vaftBusy = false;
    let vaftPending = null;
    let vaftError = '';

    function renderVaftSetting() {
        const checkbox = document.getElementById('ytot-vaft');
        const status = document.getElementById('ytot-vaft-status');
        if (!checkbox || !status) return;
        checkbox.disabled = vaftBusy || vaftEnabled === null;
        checkbox.checked = vaftBusy && vaftPending !== null ? vaftPending : vaftEnabled === true;
        const running = document.documentElement.getAttribute('data-ypft-vaft');
        if (vaftError) status.textContent = vaftError;
        else if (vaftBusy) status.textContent = 'Saving… Twitch will reload.';
        else if (vaftEnabled === null) status.textContent = 'Checking setting…';
        else if (!vaftEnabled) status.textContent = running ? 'Off · reload to apply.' : 'Off · changes reload Twitch.';
        else if (running === 'conflict') status.textContent = 'Another playback hook detected.';
        else if (running === 'error') status.textContent = 'Could not start. Turn off to retry.';
        else if (running === 'worker-ready') status.textContent = 'On · changes reload Twitch.';
        else if (running === 'hooks-ready') status.textContent = 'On · waiting for Twitch.';
        else status.textContent = 'On · reload to apply.';
        status.dataset.state = vaftError || running === 'error' ? 'error' :
            running === 'conflict' ? 'warning' : vaftBusy ? 'pending' : vaftEnabled ? 'on' : 'off';
        const needsReload = !vaftBusy && (vaftError || (vaftEnabled !== null &&
            (vaftEnabled ? !running || running === 'conflict' || running === 'error' : !!running)));
        const reload = document.getElementById('ytot-vaft-reload');
        reload.hidden = !needsReload;
        reload.textContent = vaftError ? 'Reload Twitch to retry' : 'Reload Twitch to apply';
    }

    async function loadVaftSetting() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_VAFT_SETTINGS' });
            if (!response || response.error) throw new Error(response?.error || 'Could not read VAFT setting.');
            vaftEnabled = response.enabled;
            vaftError = '';
        } catch (error) { vaftError = `${error.message} Reload Twitch to retry.`; }
        renderVaftSetting();
    }

    async function changeVaftSetting(enabled) {
        if (vaftBusy) return;
        vaftBusy = true;
        vaftPending = enabled;
        vaftError = '';
        renderVaftSetting();
        try {
            if (state.youtubeVideoId) await chrome.storage.local.set({
                [`ytot_active_${getTwitchChannel()}`]: state.youtubeVideoId,
                [`ytot_playback_${getTwitchChannel()}`]: window.__ypftPlayback.snapshot()
            });
            const response = await chrome.runtime.sendMessage({ type: 'SET_VAFT_SETTINGS', enabled });
            if (!response || response.error || response.enabled !== enabled || response.registered !== enabled) {
                throw new Error(response?.error || 'VAFT registration was not confirmed.');
            }
            vaftEnabled = enabled;
            const status = document.getElementById('ytot-vaft-status');
            if (status) status.textContent = 'Saved. Reloading Twitch…';
            location.reload();
        } catch (error) {
            vaftBusy = false;
            vaftPending = null;
            vaftError = `VAFT change failed: ${error.message}`;
            renderVaftSetting();
        }
    }

    function refreshDOMCache() {
        const toggle = document.getElementById('ytot-toggle');
        uiCache.toggle = toggle;
        uiCache.icon = toggle?.querySelector('.ytot-icon');
        uiCache.label = toggle?.querySelector('.ytot-label');
        uiCache.restore = document.getElementById('ytot-restore');
        uiCache.syncNow = document.getElementById('ytot-sync-now');
        uiCache.actions = document.getElementById('ytot-actions');
    }

    /**
     * Updates the toggle button appearance based on active state
     * @param {boolean} isActive 
     */
    function updateToggleButton(isActive) {
        // Fallback if cache is empty (safety net)
        if (!uiCache.toggle) refreshDOMCache();

        const { toggle, icon, label, restore, syncNow, actions } = uiCache;
        if (actions) actions.hidden = !isActive;

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
        document.getElementById('ytot-toggle')?.setAttribute('aria-expanded', 'false');
    }

    let theatreObserver = null;
    let theatreHost = null;
    let theatreNative = null;
    let theatreNavParent = null;

    function nativeTheatreButton() {
        // Current Twitch uses only an aria-label with the Alt+T shortcut. Scope
        // the lookup to its player so the extension never selects its own button.
        return window.__ypftPlayback.container()?.querySelector(
            '[data-a-target="player-theatre-mode-button"], [data-a-target="player-theater-mode-button"], ' +
            'button[aria-label*="(alt+t)" i], button[aria-label*="theatre mode" i], button[aria-label*="theater mode" i]'
        );
    }

    function renderTheatreControl() {
        const button = document.getElementById('ytot-theatre');
        if (!button) return;
        const native = nativeTheatreButton();
        const active = !!document.querySelector('.persistent-player--theatre, .channel-page__video-player--theatre-mode') ||
            native?.getAttribute('aria-pressed') === 'true';
        const player = window.__ypftPlayback.container();
        const host = player?.closest('.persistent-player') || player;
        if (host !== theatreHost || native !== theatreNative) {
            theatreObserver?.disconnect();
            theatreHost = host;
            theatreNative = native;
            theatreObserver ||= new MutationObserver(renderTheatreControl);
            if (host) theatreObserver.observe(host, { attributes: true, attributeFilter: ['class'] });
            if (native) theatreObserver.observe(native, { attributes: true, attributeFilter: ['aria-label', 'aria-pressed', 'disabled'] });
        }
        if (active) document.documentElement.setAttribute('data-ypft-theatre', '');
        else document.documentElement.removeAttribute('data-ypft-theatre');
        // Twitch's theatre layer covers the top navigation. Keep the same menu
        // mounted in a body portal so the exit control stays reachable.
        const nav = document.getElementById('ytot-nav-wrapper');
        if (nav) {
            if (active && nav.parentElement !== document.body) {
                theatreNavParent = nav.parentElement;
                document.body.appendChild(nav);
            } else if (!active && nav.parentElement === document.body) {
                const parent = theatreNavParent?.isConnected ? theatreNavParent :
                    document.querySelector('.top-nav__menu > div:first-child') ||
                    document.querySelector('button[aria-label="More Options"]')?.closest('div[class]')?.parentElement;
                if (parent) {
                    parent.appendChild(nav);
                    theatreNavParent = null;
                }
            }
            nav.classList.toggle('ytot-nav-theatre', active);
        }
        button.disabled = !native || native.disabled || !!document.fullscreenElement;
        button.setAttribute('aria-pressed', String(active));
        const label = active ? 'Exit Theatre Mode' : 'Theatre Mode';
        button.setAttribute('aria-label', label);
        button.title = button.disabled ? 'Theatre mode is unavailable on this page.' : label;
        document.getElementById('ytot-theatre-label').textContent = label;
    }

    function toggleTheatreMode() {
        const native = nativeTheatreButton();
        if (!native || native.disabled || document.fullscreenElement) {
            renderTheatreControl();
            updateStatus('Theatre mode is unavailable on this page.', 'error');
            return;
        }
        // Let Twitch manage its own layout and preference. The stable YouTube
        // portal follows the resized player without replacing or reloading it.
        native.click();
        renderTheatreControl();
        setTimeout(renderTheatreControl, 0);
    }

    /**
     * Saves history with sorting and trimming logic
     * @param {Array} historyList
     */
    function saveAndRenderHistory(historyList) {
        // Separate Pinned and Unpinned
        const pinned = historyList.filter(h => h.pinned).sort((a, b) => b.timestamp - a.timestamp);
        const unpinned = historyList.filter(h => !h.pinned).sort((a, b) => b.timestamp - a.timestamp);

        // Keep max 5 unpinned
        const trimmedUnpinned = unpinned.slice(0, 5);

        // Recombine
        const finalHistory = [...pinned, ...trimmedUnpinned];

        saveState('ytot_history', finalHistory);
        renderHistory();
    }

    async function addToHistory(videoId, metadata) {
        if (!videoId) return;

        let history = (await loadState('ytot_history')) || [];

        // Check if existing item was pinned
        const existingItem = history.find(h => h.videoId === videoId);
        const isPinned = existingItem ? existingItem.pinned : false;

        const newItem = {
            videoId,
            title: metadata?.title || videoId,
            channel: metadata?.channel || 'Unknown Channel',
            timestamp: Date.now(),
            pinned: isPinned
        };

        // Remove duplicates (by videoId)
        history = history.filter(h => h.videoId !== videoId);

        // Add to top
        history.unshift(newItem);

        saveAndRenderHistory(history);
    }

    async function togglePin(videoId) {
        let history = (await loadState('ytot_history')) || [];
        const item = history.find(h => h.videoId === videoId);
        if (item) {
            item.pinned = !item.pinned;
            saveAndRenderHistory(history);
        }
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
                    <div class="ytot-history-item ${item.pinned ? 'pinned' : ''}" data-video-id="${item.videoId}">
                        <div class="ytot-history-info">
                            <div class="ytot-history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                            <div class="ytot-history-channel">${escapeHtml(item.channel)}</div>
                        </div>
                        <button class="ytot-pin-btn" title="${item.pinned ? 'Unpin' : 'Pin'}" data-video-id="${item.videoId}">
                            ${item.pinned ? '📌' : '📍'}
                        </button>
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

        // Add click listeners for items
        container.querySelectorAll('.ytot-history-item').forEach(el => {
            el.onclick = () => {
                const videoId = el.getAttribute('data-video-id');
                const item = history.find(h => h.videoId === videoId);
                injectYouTube(videoId, item);
            };
        });

        // Add click listeners for pins
        container.querySelectorAll('.ytot-pin-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const videoId = btn.getAttribute('data-video-id');
                togglePin(videoId);
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
     * Optimized using Uint16Array and charCodeAt for performance
     */
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        if (a.length > b.length) {
            [a, b] = [b, a];
        }

        const row = new Uint16Array(a.length + 1);
        for (let i = 0; i <= a.length; i++) {
            row[i] = i;
        }

        for (let i = 1; i <= b.length; i++) {
            let prevDiagonal = row[0];
            row[0] = i;

            for (let j = 1; j <= a.length; j++) {
                const temp = row[j];
                const cost = b.charCodeAt(i - 1) === a.charCodeAt(j - 1) ? 0 : 1;

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

    function getLinkedYouTubeChannel() {
        const link = document.querySelector('.social-media-link a[href*="youtube.com"]');
        if (!link?.href) return null;

        try {
            const url = new URL(link.href);
            if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname.toLowerCase())) {
                return null;
            }
            return url.href;
        } catch (e) {
            return null;
        }
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
            const linkedChannelUrl = getLinkedYouTubeChannel();
            if (linkedChannelUrl) {
                const linkedResponse = await chrome.runtime.sendMessage({
                    type: 'SEARCH_YOUTUBE_CHANNEL',
                    channelUrl: linkedChannelUrl
                });

                if (linkedResponse?.results?.length) {
                    return { ...linkedResponse.results[0], linkedChannel: true };
                }

                if (linkedResponse?.error) {
                    Logger.warn('Linked YouTube channel search failed:', linkedResponse.error);
                }
            }

            const response = await chrome.runtime.sendMessage({
                type: 'SEARCH_YOUTUBE',
                query: channelName
            });

            if (!response || response.error) {
                Logger.error('Search error:', response?.error);
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
            Logger.error('Search error:', e);
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
            const linkedNote = result.linkedChannel ? '<div class="ytot-result-note">🔗 Found on the streamer’s linked YouTube channel</div>' : '';
            resultDiv.innerHTML = `
                <div class="ytot-result-card">
                    ${approxNote}
                    ${linkedNote}
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
     * Injects YouTube iframe over the Twitch player
     * @param {string} videoId 
     * @param {object} metadata Optional metadata { title, channel }
     */
    function injectYouTube(videoId, metadata = null, restoredPlayback = null) {
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
        const container = window.__ypftPlayback.container();

        if (!container) {
            updateStatus('Error: Player not found', 'error');
            return;
        }

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
        // A stable portal avoids reloading the YouTube iframe when React replaces
        // Twitch's player. Ownership is published before mounting the iframe.
        window.__ypftPlayback.own(wrapper, restoredPlayback);
        document.body.appendChild(wrapper);
        window.__ypftChat?.sync();

        // Update state
        state.youtubeVideoId = videoId;
        const channel = getTwitchChannel();
        saveState(`ytot_${channel}`, videoId);
        saveState(`ytot_active_${channel}`, videoId); // Mark as active for persistence
        saveState(`ytot_playback_${channel}`, window.__ypftPlayback.snapshot());

        // UI Updates
        updateToggleButton(true);
        closeDropdown();
        updateStatus('YouTube playing', 'success');

        if (state.autoSyncEnabled) {
            startAutoSync();
        }

        Logger.log('YouTube injected:', videoId);
    }

    /**
     * Removes the YouTube overlay and restores Twitch player
     * @param {boolean} keepState If true, preserves active state (used during navigation)
     */
    function removeYouTube(keepState = false) {
        document.getElementById('ytot-youtube-wrapper')?.remove();
        window.__ypftPlayback.release({ navigation: keepState });
        window.__ypftChat?.sync();
        stopAutoSync();

        state.youtubeVideoId = null;
        updateToggleButton(false);
        updateStatus('');

        // Clean up active state only if user explicitly requested removal
        if (!keepState) {
            saveState(`ytot_active_${getTwitchChannel()}`, null);
            saveState(`ytot_playback_${getTwitchChannel()}`, null);
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
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
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
        Logger.log('Auto-sync started');
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
                Logger.log('Enforced quality:', target);
            }
        } catch (e) {
            Logger.error('Failed to enforce quality:', e);
        }
    }

    function startQualityEnforcement() {
        if (state.qualityIntervalId) return;
        // Run immediately
        enforceQuality();
        state.qualityIntervalId = setInterval(enforceQuality, CONFIG.QUALITY_CHECK_INTERVAL);
        Logger.log('Quality enforcement started');
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

    function setupGlobalListeners() {
        // Close on click outside
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('ytot-nav-wrapper');
            if (wrapper && !wrapper.contains(e.target)) closeDropdown();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDropdown();
        });
    }

    function setupEventListeners() {
        setupChatControls();
        document.getElementById('ytot-theatre').onclick = toggleTheatreMode;
        renderTheatreControl();
        const extensionsToggle = document.getElementById('ytot-hide-extensions');
        extensionsToggle.checked = hideExtensions;
        extensionsToggle.onchange = event => {
            applyExtensionVisibility(event.target.checked);
            saveState(HIDE_EXTENSIONS_KEY, hideExtensions);
        };
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
        toggle.onclick = () => {
            renderTheatreControl();
            const visible = dropdown.classList.toggle('visible');
            toggle.setAttribute('aria-expanded', String(visible));
        };
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
        document.getElementById('ytot-vaft').onchange = e => changeVaftSetting(e.target.checked);
        document.getElementById('ytot-vaft-reload').onclick = () => location.reload();
        loadVaftSetting();
    }

    function renderChatControls() {
        const chat = window.__ypftChat;
        const toggle = document.getElementById('ytot-chat-toggle');
        if (!chat || !toggle) return;
        const settings = chat.settings();
        toggle.checked = settings.enabled;
        const appearance = document.getElementById('ytot-chat-settings');
        appearance.hidden = !settings.enabled;
        if (!settings.enabled) appearance.open = false;
        document.getElementById('ytot-chat-mode').value = settings.fullscreenOnly ? 'fullscreen' : 'always';
        document.getElementById('ytot-chat-opacity').value = settings.opacity;
        document.getElementById('ytot-chat-font').value = settings.fontSize;
        document.getElementById('ytot-chat-color').value = settings.color;
        document.getElementById('ytot-chat-compact').checked = settings.compact;
        document.getElementById('ytot-chat-through').checked = settings.clickThrough;
    }
    function setupChatControls() {
        const chat = window.__ypftChat;
        const toggle = document.getElementById('ytot-chat-toggle');
        if (!toggle) return;
        toggle.disabled = !chat;
        if (!chat) return;
        const update = changes => chat.configure({ ...chat.settings(), ...changes }, true);
        toggle.onchange = event => update({ enabled: event.target.checked });
        for (const [id, key, kind] of [
            ['ytot-chat-mode', 'fullscreenOnly', 'mode'], ['ytot-chat-opacity', 'opacity', 'number'],
            ['ytot-chat-font', 'fontSize', 'number'], ['ytot-chat-color', 'color', 'value'],
            ['ytot-chat-compact', 'compact', 'boolean'], ['ytot-chat-through', 'clickThrough', 'boolean']
        ]) {
            document.getElementById(id).onchange = event => update({ [key]:
                kind === 'mode' ? event.target.value === 'fullscreen' :
                kind === 'number' ? Number(event.target.value) :
                kind === 'boolean' ? event.target.checked : event.target.value });
        }
        document.getElementById('ytot-chat-reset').onclick = () => update({ x: 1, y: 0.15, width: 320, height: 0.55 });
        renderChatControls();
    }
    document.addEventListener('ypft-chat-setting', renderChatControls);

    let spawnAttempts = 0;
    let initGeneration = 0;

    async function init() {
        if (state.initialized) return;

        // Try to insert into Twitch Top Nav
        const leftNav = document.querySelector('.top-nav__menu > div:first-child') ||
            document.querySelector('button[aria-label="More Options"]')?.closest('div[class]')?.parentElement;

        if (!leftNav) return;
        state.initialized = true;
        const generation = ++initGeneration;
        const channel = getTwitchChannel();

        // Clean up any stale elements
        document.getElementById('ytot-nav-wrapper')?.remove();

        leftNav.appendChild(createNavButton());
        setupEventListeners();
        refreshDOMCache();

        // Restore Settings
        const [savedAutoSync, savedForceHighest] = await Promise.all([
            loadState('ytot_autosync'), loadState('ytot_force_highest')
        ]);
        if (generation !== initGeneration || channel !== getTwitchChannel()) return;
        if (savedAutoSync) {
            state.autoSyncEnabled = true;
            document.getElementById('ytot-autosync').checked = true;
        }

        if (savedForceHighest) {
            state.forceHighestQuality = true;
            const qualityCheckbox = document.getElementById('ytot-quality');
            if (qualityCheckbox) qualityCheckbox.checked = true;
            startQualityEnforcement();
        }

        renderHistory();

        // Restore Active Stream or Last Used
        if (channel) {
            const [activeStream, savedVideoId, restoredPlayback] = await Promise.all([
                loadState(`ytot_active_${channel}`), loadState(`ytot_${channel}`), loadState(`ytot_playback_${channel}`)
            ]);
            if (generation !== initGeneration || channel !== getTwitchChannel()) return;
            if (activeStream) {
                Logger.log('Restoring active stream:', activeStream);
                const restoreWhenReady = (attempt = 0) => {
                    if (generation !== initGeneration || channel !== getTwitchChannel() || state.youtubeVideoId) return;
                    if (window.__ypftPlayback.container()) injectYouTube(activeStream, null, restoredPlayback);
                    else if (attempt < 40) setTimeout(() => restoreWhenReady(attempt + 1), 250);
                    else updateStatus('Twitch player was not ready. Reopen your saved YouTube stream.', 'error');
                };
                restoreWhenReady();
            } else {
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
        Logger.log('Initialized for:', channel);
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
            // Fast Start: Check more frequently for the first few seconds
            const delay = spawnAttempts <= 20 ? CONFIG.FAST_CHECK_INTERVAL : CONFIG.CHECK_INTERVAL;
            setTimeout(check, delay);
        }
    }

    // SPA Navigation Detection
    function handleNavigation() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            Logger.log('Navigation detected');

            // Navigate away: clear UI but keep state
            removeYouTube(true);
            initGeneration++;
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
    new MutationObserver(renderVaftSetting).observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-ypft-vaft']
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[HIDE_EXTENSIONS_KEY]) {
            applyExtensionVisibility(changes[HIDE_EXTENSIONS_KEY].newValue);
        }
        if (area === 'local' && changes.ytot_vaft_enabled && !vaftBusy) {
            vaftEnabled = changes.ytot_vaft_enabled.newValue === true;
            vaftError = '';
            renderVaftSetting();
        }
    });

    setInterval(() => {
        handleNavigation();
        window.__ypftChat?.sync();
        renderTheatreControl();
        if (state.initialized && !document.getElementById('ytot-nav-wrapper')) {
            state.initialized = false;
            spawnAttempts = 0;
            check();
        }
    }, 2000);

    setupGlobalListeners();
    setTimeout(check, 1000);

})();
