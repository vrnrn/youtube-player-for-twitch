// YouTube player, stream discovery, and controls on Twitch.

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

    const CONFIG = {
        SYNC_INTERVAL: 10 * 60 * 1000, // 10 minutes
        SYNC_SPEED: 2.0,               // Speed to catch up
        NORMAL_SPEED: 1.0,             // Normal playback speed
        CHECK_INTERVAL: 1500,          // Poll interval for nav bar
        FAST_CHECK_INTERVAL: 250,      // Fast poll interval for initial load
        MAX_ATTEMPTS: 60,              // Fast startup checks; the backup loop can retry later
        QUALITY_CHECK_INTERVAL: 5 * 60 * 1000 // 5 minutes
    };

    const validVideoId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value);

    const state = {
        initialized: false,
        youtubeVideoId: null,
        autoSyncEnabled: false,
        syncIntervalId: null,
        isSyncing: false,
        syncTimeoutId: null,
        forceHighestQuality: false,
        qualityIntervalId: null
    };

    async function saveState(key, value) {
        if (!chrome.runtime?.id) return;
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (e) {
            // The page can outlive its extension context after an update.
        }
    }

    function loadState(key) {
        return new Promise((resolve) => {
            if (!chrome.runtime?.id || !chrome.storage?.local) {
                resolve(null);
                return;
            }
            try {
                chrome.storage.local.get([key], result => resolve(chrome.runtime.lastError ? null : result?.[key]));
            } catch (e) {
                resolve(null);
            }
        });
    }

    function getTwitchChannel() {
        const match = window.location.pathname.match(/^\/([a-zA-Z0-9_]+)\/?$/);
        const reserved = /^(directory|downloads|drops|friends|jobs|moderator|p|popout|prime|search|settings|store|subscriptions|team|turbo|u|videos|wallet)$/i;
        return match && !reserved.test(match[1]) ? match[1].toLowerCase() : null;
    }

    const MENU_ICONS = {
        close: 'm6 6 12 12M18 6 6 18',
        chevron: 'm6 9 6 6 6-6',
        search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
        sync: 'M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7',
        theatre: 'M3 5h18v14H3zM16 5v14',
        playback: 'm9 5 11 7-11 7z',
        chat: 'M4 4h16v12H9l-5 4zM8 8h8M8 12h5',
        settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 4 4 1v8l-4 1-1 4H9l-1-4-4-1V8l4-1z',
        pin: 'M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7M12 15v6'
    };
    const menuIcon = name => '<svg class="ytot-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + MENU_ICONS[name] + '"></path></svg>';

    function navParent() {
        return document.querySelector('.top-nav__menu > div:last-child') ||
            document.querySelector('[data-a-target="user-menu-toggle"]')?.closest('.top-nav__menu > div');
    }
    function placeNavButton(nav, parent) {
        let account = parent.querySelector('[data-a-target="user-menu-toggle"]');
        while (account && account.parentElement !== parent) account = account.parentElement;
        if (account) parent.insertBefore(nav, account);
        else parent.appendChild(nav);
    }

    function createNavButton() {
        const wrapper = document.createElement('div');
        wrapper.id = 'ytot-nav-wrapper';

        wrapper.innerHTML = `
            <button type="button" class="ytot-nav-btn" id="ytot-toggle" aria-label="YouTube Player for Twitch" title="YouTube Player for Twitch" aria-expanded="false" aria-controls="ytot-dropdown">
                <span class="ytot-label">YPFT</span>
            </button>

            <div class="ytot-dropdown" id="ytot-dropdown">
                <div class="ytot-dropdown-header">
                    <div>
                        <span class="ytot-menu-title">YouTube Player for Twitch</span>
                        <span class="ytot-menu-subtitle">Your stream, with Twitch chat</span>
                    </div>
                    <button class="ytot-close" id="ytot-close" aria-label="Close">${menuIcon('close')}</button>
                </div>

                <!-- Auto-Find Section -->
                <div class="ytot-autofind" id="ytot-autofind-section">
                    <button class="ytot-autofind-btn" id="ytot-autofind">${menuIcon('search')}<span>Find YouTube Stream</span></button>
                    <div class="ytot-search-result" id="ytot-search-result" role="status" aria-live="polite"></div>
                </div>

                <!-- History Section -->
                <div id="ytot-history-section" class="ytot-history-section"></div>

                <div class="ytot-divider">or paste URL</div>

                <!-- Manual Input -->
                <div class="ytot-dropdown-body">
                    <input type="url" id="ytot-url" aria-label="${window.__ypftKick?.enabled() ? 'YouTube video or Kick channel URL' : 'YouTube video or livestream URL'}" aria-describedby="ytot-status" placeholder="${window.__ypftKick?.enabled() ? 'Paste YouTube or Kick URL' : 'Paste YouTube URL'}" spellcheck="false" autocomplete="off" />
                    <button class="ytot-go" id="ytot-go">Go</button>
                </div>

                <!-- Actions -->
                <div class="ytot-actions" id="ytot-actions" hidden>
                    <button class="ytot-sync-now" id="ytot-sync-now" title="Sync">${menuIcon('sync')}<span>Sync Now</span></button>
                    <button class="ytot-restore" id="ytot-restore">Restore Twitch</button>
                </div>

                <div class="ytot-status" id="ytot-status" role="status" aria-live="polite"></div>
                <div class="ytot-menu-footer">
                    <button type="button" class="ytot-open-settings" id="ytot-open-settings" aria-haspopup="dialog">${menuIcon('settings')}<span>Settings</span>${menuIcon('chevron')}</button>
                </div>
            </div>
        `;
        return wrapper;
    }

    const SETTINGS_TABS = ['playback', 'chat', 'extras', 'kick'];
    let settingsDialog = null;
    let settingsTab = 'playback';

    function createSettingsDialog() {
        const dialog = document.createElement('dialog');
        dialog.id = 'ytot-settings-dialog';
        dialog.className = 'ytot-settings-dialog';
        dialog.setAttribute('aria-labelledby', 'ytot-settings-title');
        dialog.innerHTML = `
            <div class="ytot-settings-shell">
                <aside class="ytot-settings-sidebar">
                    <div class="ytot-settings-brand"><span class="ytot-settings-mark">YPFT</span><span>YouTube Player for Twitch</span></div>
                    <nav class="ytot-settings-tabs" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
                        <button type="button" role="tab" id="ytot-tab-playback" data-ytot-settings-tab="playback" aria-controls="ytot-panel-playback">${menuIcon('playback')}<span>Playback</span></button>
                        <button type="button" role="tab" id="ytot-tab-chat" data-ytot-settings-tab="chat" aria-controls="ytot-panel-chat">${menuIcon('chat')}<span>Chat</span></button>
                        <button type="button" role="tab" id="ytot-tab-extras" data-ytot-settings-tab="extras" aria-controls="ytot-panel-extras">${menuIcon('settings')}<span>Player extras</span></button>
                        <button type="button" role="tab" id="ytot-tab-kick" data-ytot-settings-tab="kick" aria-controls="ytot-panel-kick">${menuIcon('pin')}<span>Kick</span></button>
                    </nav>
                    <p class="ytot-settings-note">Settings save automatically.</p>
                </aside>
                <div class="ytot-settings-main">
                    <header class="ytot-settings-header"><h1 id="ytot-settings-title">Settings</h1><button type="button" class="ytot-close" id="ytot-settings-close" aria-label="Close settings">${menuIcon('close')}</button></header>
                    <div class="ytot-settings-content">
                        <section class="ytot-settings-panel" id="ytot-panel-playback" role="tabpanel" aria-labelledby="ytot-tab-playback" tabindex="0">
                            <h2>Playback</h2><p class="ytot-settings-intro">Keep your stream in sync and choose how you watch.</p>
                            <div class="ytot-settings-group">
                                <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-autosync" /><span class="ytot-option-copy"><span class="ytot-option-title">Auto-sync</span><span class="ytot-option-description">Catch up to the live edge every 10 minutes.</span></span></label>
                                <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-quality" /><span class="ytot-option-copy"><span class="ytot-option-title">Highest Twitch quality</span><span class="ytot-option-description">Keep the Twitch player set to Source quality.</span></span></label>
                            </div>
                            <h3>Layout</h3>
                            <div class="ytot-settings-group ytot-settings-action"><div class="ytot-option-copy"><span class="ytot-option-title">Theatre mode</span><span class="ytot-option-description">Expand the player using Twitch's native layout.</span></div><button type="button" class="ytot-theatre" id="ytot-theatre" aria-pressed="false" disabled>${menuIcon('theatre')}<span id="ytot-theatre-label">Theatre Mode</span></button></div>
                        </section>
                        <section class="ytot-settings-panel" id="ytot-panel-chat" role="tabpanel" aria-labelledby="ytot-tab-chat" tabindex="0" hidden>
                            <h2>Chat</h2><p class="ytot-settings-intro">More emotes and a chat overlay that follows your player.</p>
                            <div class="ytot-settings-group">
                                <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-emotes-toggle" /><span class="ytot-option-copy"><span class="ytot-option-title">Extra emotes</span><span class="ytot-option-description">Global &amp; channel emotes from BTTV, FFZ &amp; 7TV.</span></span></label>
                                <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-chat-toggle" /><span class="ytot-option-copy"><span class="ytot-option-title">Floating chat</span><span class="ytot-option-description">Show Twitch chat over your video, including fullscreen.</span></span></label>
                            </div>
                            <div class="ytot-chat-settings" id="ytot-chat-settings" hidden>
                                <h3>Chat appearance</h3>
                                <div class="ytot-chat-customization">
                                    <div class="ytot-chat-fields">
                                        <label class="ytot-chat-setting">Show <select id="ytot-chat-mode"><option value="fullscreen">Fullscreen only</option><option value="always">Always on player</option></select></label>
                                        <label class="ytot-chat-setting">Background <input type="color" id="ytot-chat-color" aria-label="Chat background color" /></label>
                                        <label class="ytot-chat-setting">Opacity <span class="ytot-range-control"><input type="range" id="ytot-chat-opacity" min="0" max="100" step="5" aria-label="Chat background opacity" /><output id="ytot-chat-opacity-value" for="ytot-chat-opacity">70%</output></span></label>
                                        <label class="ytot-chat-setting">Text size <span class="ytot-range-control"><input type="range" id="ytot-chat-font" min="11" max="24" aria-label="Chat text size" /><output id="ytot-chat-font-value" for="ytot-chat-font">14px</output></span></label>
                                        <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-chat-compact" /><span class="ytot-option-copy"><span class="ytot-option-title">Compact spacing</span></span></label>
                                        <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-chat-through" /><span class="ytot-option-copy"><span class="ytot-option-title">Click-through</span><span class="ytot-option-description">Let clicks pass through the chat messages to your video.</span></span></label>
                                        <button type="button" class="ytot-vaft-reload" id="ytot-chat-reset">Reset position &amp; size</button>
                                    </div>
                                    <figure class="ytot-chat-preview-stage" aria-label="Chat appearance preview">
                                        <div class="ytot-chat-preview" id="ytot-chat-preview">
                                            <div class="ytot-chat-preview-header">${menuIcon('chat')}<span>Twitch chat</span></div>
                                            <div class="ytot-chat-preview-line"><span class="ytot-chat-preview-author">Viewer:</span> Sample message</div>
                                            <div class="ytot-chat-preview-line"><span class="ytot-chat-preview-author">Community:</span> Chat stays with the stream.</div>
                                            <div class="ytot-chat-preview-line">Messages, badges and emotes.</div>
                                        </div>
                                        <figcaption>Appearance preview · sample messages</figcaption>
                                    </figure>
                                </div>
                            </div>
                        </section>
                        <section class="ytot-settings-panel" id="ytot-panel-extras" role="tabpanel" aria-labelledby="ytot-tab-extras" tabindex="0" hidden>
                            <h2>Player extras</h2><p class="ytot-settings-intro">Adjust Twitch's overlays and optional playback features.</p>
                            <div class="ytot-settings-group"><label class="ytot-option"><input type="checkbox" role="switch" id="ytot-hide-extensions" /><span class="ytot-option-copy"><span class="ytot-option-title">Hide Twitch extensions</span><span class="ytot-option-description">Hide native player overlays and extension buttons.</span></span></label></div>
                            <h3>Interruption blocking <span class="ytot-badge">Experimental</span></h3>
                            <div class="ytot-settings-group ytot-vaft-card">
                                <label class="ytot-option"><input type="checkbox" role="switch" id="ytot-vaft" disabled aria-describedby="ytot-vaft-status" /><span class="ytot-option-copy"><span class="ytot-option-title">Interruption blocking</span><span class="ytot-option-description">Changing this setting reloads Twitch.</span></span></label>
                                <div id="ytot-vaft-status" class="ytot-vaft-status" role="status" aria-live="polite">Checking setting…</div>
                                <button type="button" id="ytot-vaft-reload" class="ytot-vaft-reload" hidden>Reload Twitch to apply</button>
                            </div>
                        </section>
                        <section class="ytot-settings-panel" id="ytot-panel-kick" role="tabpanel" aria-labelledby="ytot-tab-kick" tabindex="0" hidden>
                            <h2>Kick <span class="ytot-badge">Experimental</span></h2><p class="ytot-settings-intro">Watch Kick streams inside Twitch and pin channels in the sidebar.</p>
                            <div class="ytot-settings-group"><label class="ytot-option"><input type="checkbox" role="switch" id="ytot-kick-enabled" disabled /><span class="ytot-option-copy"><span class="ytot-option-title">Enable Kick support</span><span class="ytot-option-description">Off by default. Kick embeds, chat sign-in and channel status may be unavailable.</span></span></label></div>
                            <div id="ytot-kick-options" hidden>
                                <div class="ytot-settings-group"><label class="ytot-option"><input type="checkbox" role="switch" id="ytot-kick-chat-enabled" /><span class="ytot-option-copy"><span class="ytot-option-title">Show Kick chat</span><span class="ytot-option-description">Use Kick's chat beside the stream. On a Twitch channel, switch between Kick and Twitch chat.</span></span></label></div>
                                <h3>Pinned channels</h3><p class="ytot-settings-intro">Live pins appear alongside Twitch's Followed Channels. Status is checked every 10 minutes. Open any saved pin here to watch with Kick chat. Up to 30 pins.</p>
                                <form id="ytot-kick-pin-form" class="ytot-kick-pin-form"><label for="ytot-kick-channel">Kick channel name or URL</label><div><input type="text" id="ytot-kick-channel" placeholder="https://kick.com/channel" autocomplete="off" spellcheck="false" aria-describedby="ytot-kick-status" /><button type="submit" id="ytot-kick-pin">Pin channel</button></div></form>
                                <div id="ytot-kick-pins"></div>
                                <h3>Substitute a stream</h3><p class="ytot-settings-intro">Open a Twitch channel, then paste a Kick channel URL into the YPFT menu. Restore Twitch returns to its player. Auto-sync applies to YouTube only.</p>
                            </div>
                            <p id="ytot-kick-status" role="status" aria-live="polite"></p>
                        </section>
                    </div>
                </div>
            </div>`;
        return dialog;
    }

    function selectSettingsTab(tab) {
        if (!SETTINGS_TABS.includes(tab) || !settingsDialog) return;
        updateSettingsOrientation();
        settingsTab = tab;
        for (const name of SETTINGS_TABS) {
            const selected = name === tab;
            const button = document.getElementById(`ytot-tab-${name}`);
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
            document.getElementById(`ytot-panel-${name}`).hidden = !selected;
        }
        settingsDialog.querySelector('.ytot-settings-content').scrollTop = 0;
    }

    function updateSettingsOrientation() {
        settingsDialog?.querySelector('[role="tablist"]')?.setAttribute('aria-orientation', window.innerWidth <= 560 ? 'horizontal' : 'vertical');
    }

    function closeSettings(restoreFocus = true) {
        if (!settingsDialog) return;
        const dialog = settingsDialog;
        settingsDialog = null;
        dialog.close();
        dialog.remove();
        if (restoreFocus) document.getElementById('ytot-toggle')?.focus();
    }

    function openSettings() {
        if (settingsDialog) return;
        closeDropdown();
        settingsDialog = createSettingsDialog();
        document.body.appendChild(settingsDialog);
        settingsDialog.oncancel = event => { event.preventDefault(); closeSettings(); };
        settingsDialog.onclose = event => { if (event.target === settingsDialog) closeSettings(); };
        settingsDialog.onclick = event => {
            const tab = event.target.closest('[data-ytot-settings-tab]');
            if (tab) { selectSettingsTab(tab.dataset.ytotSettingsTab); return; }
            if (event.target !== settingsDialog) return;
            const bounds = settingsDialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSettings();
        };
        settingsDialog.onkeydown = event => {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); closeSettings(); return;
            }
            if (event.key === 'Tab') {
                event.stopPropagation();
                const controls = Array.from(settingsDialog.querySelectorAll('button, input, select, [tabindex]'))
                    .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
                const first = controls[0], last = controls.at(-1);
                if (first && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
                    event.preventDefault(); (event.shiftKey ? last : first).focus();
                }
                return;
            }
            const tab = event.target.closest('[data-ytot-settings-tab]');
            if (!tab || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = SETTINGS_TABS.indexOf(tab.dataset.ytotSettingsTab);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? SETTINGS_TABS.length - 1 :
                (index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + SETTINGS_TABS.length) % SETTINGS_TABS.length;
            selectSettingsTab(SETTINGS_TABS[next]);
            document.getElementById(`ytot-tab-${settingsTab}`).focus();
        };
        document.getElementById('ytot-settings-close').onclick = () => closeSettings();
        setupSettingsListeners();
        selectSettingsTab(settingsTab);
        settingsDialog.showModal();
        document.getElementById(`ytot-tab-${settingsTab}`).focus();
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
        uiCache.label = toggle?.querySelector('.ytot-label');
        uiCache.restore = document.getElementById('ytot-restore');
        uiCache.syncNow = document.getElementById('ytot-sync-now');
        uiCache.actions = document.getElementById('ytot-actions');
    }

    function updateToggleButton(isActive) {
        if (!uiCache.toggle) refreshDOMCache();

        const { toggle, label, restore, syncNow, actions } = uiCache;
        if (actions) actions.hidden = !isActive;
        if (label) label.textContent = 'YPFT';

        if (isActive) {
            toggle?.classList.add('active');
            if (restore) restore.style.display = 'block';
            if (syncNow) syncNow.style.display = state.youtubeVideoId ? 'block' : 'none';
        } else {
            toggle?.classList.remove('active');
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

    function closeDropdown(restoreFocus = false) {
        document.getElementById('ytot-dropdown')?.classList.remove('visible');
        document.getElementById('ytot-toggle')?.setAttribute('aria-expanded', 'false');
        clearHistoryUI();
        if (restoreFocus) document.getElementById('ytot-toggle')?.focus();
    }

    let theatreObserver = null;
    let theatreHost = null;
    let theatreNative = null;
    let theatreNavParent = null;

    function releaseTheatreControl() {
        theatreObserver?.disconnect();
        theatreObserver = theatreHost = theatreNative = theatreNavParent = null;
        document.documentElement.removeAttribute('data-ypft-theatre');
    }

    function releaseUI() {
        closeSettings(false);
        releaseTheatreControl();
        for (const key of Object.keys(uiCache)) delete uiCache[key];
        clearHistoryUI();
        if (restoreTimeout !== null) clearTimeout(restoreTimeout);
        restoreTimeout = null;
    }

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
        if (!button && !document.getElementById('ytot-nav-wrapper')) { releaseTheatreControl(); return; }
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
                const parent = theatreNavParent?.isConnected ? theatreNavParent : navParent();
                if (parent) {
                    placeNavButton(nav, parent);
                    theatreNavParent = null;
                }
            }
            nav.classList.toggle('ytot-nav-theatre', active);
        }
        if (!button) return;
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

    // Serialize local history edits so rapid playback/pin actions do not lose entries.
    let historyQueue = Promise.resolve();
    let historyGeneration = 0;
    function readHistory(value) {
        return Array.isArray(value) ? value.filter(item => item && validVideoId(item.videoId)) : [];
    }
    function editHistory(update) {
        historyQueue = historyQueue.then(async () => {
            const history = update(readHistory(await loadState('ytot_history')));
            const byNewest = (a, b) => (b.timestamp || 0) - (a.timestamp || 0);
            const pinned = history.filter(item => item.pinned).sort(byNewest);
            const recent = history.filter(item => !item.pinned).sort(byNewest).slice(0, 5);
            await saveState('ytot_history', [...pinned, ...recent]);
            await renderHistory();
        }).catch(error => Logger.warn('Could not update stream history:', error));
        return historyQueue;
    }
    function addToHistory(videoId, metadata) {
        if (!validVideoId(videoId)) return;
        return editHistory(history => [{
            videoId,
            title: metadata?.title || videoId,
            channel: metadata?.channel || 'Unknown Channel',
            timestamp: Date.now(),
            pinned: history.find(item => item.videoId === videoId)?.pinned === true
        }, ...history.filter(item => item.videoId !== videoId)]);
    }
    function togglePin(videoId) {
        return editHistory(history => history.map(item => item.videoId === videoId
            ? { ...item, pinned: !item.pinned } : item));
    }

    function historyVisible() {
        return document.getElementById('ytot-dropdown')?.classList.contains('visible') === true;
    }

    function clearHistoryUI() {
        historyGeneration++;
        const container = document.getElementById('ytot-history-section');
        if (container) { container.innerHTML = ''; container.style.display = 'none'; }
    }

    async function renderHistory() {
        const container = document.getElementById('ytot-history-section');
        if (!container) return;
        if (!historyVisible()) { clearHistoryUI(); return; }

        const generation = ++historyGeneration;
        const history = readHistory(await loadState('ytot_history'));
        if (generation !== historyGeneration || !historyVisible() || container !== document.getElementById('ytot-history-section')) return;
        const focused = document.activeElement;
        const focusId = container.contains(focused) ? focused.getAttribute('data-video-id') : null;
        const focusClass = focused?.classList.contains('ytot-pin-btn') ? 'ytot-pin-btn' : 'ytot-history-play';

        if (history.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            if (focusId || focused?.id === 'ytot-clear-history') document.getElementById('ytot-autofind')?.focus();
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
                        <button type="button" class="ytot-history-play" data-video-id="${item.videoId}" aria-label="Play ${escapeHtml(item.title)}">
                            <span class="ytot-history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
                            <span class="ytot-history-channel">${escapeHtml(item.channel)}</span>
                        </button>
                        <button type="button" class="ytot-pin-btn" aria-label="${item.pinned ? 'Unpin' : 'Pin'} ${escapeHtml(item.title)}" aria-pressed="${!!item.pinned}" title="${item.pinned ? 'Unpin' : 'Pin'}" data-video-id="${item.videoId}">
                            ${menuIcon('pin')}
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        const clearBtn = container.querySelector('#ytot-clear-history');
        if (clearBtn) {
            clearBtn.onclick = (e) => {
                e.stopPropagation();
                editHistory(() => []);
            };
        }

        container.querySelectorAll('.ytot-history-play').forEach(el => {
            el.onclick = () => {
                const videoId = el.getAttribute('data-video-id');
                const item = history.find(h => h.videoId === videoId);
                injectYouTube(videoId, item);
            };
        });

        if (validVideoId(focusId)) container.querySelector(`.${focusClass}[data-video-id="${focusId}"]`)?.focus();

        container.querySelectorAll('.ytot-pin-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const videoId = btn.getAttribute('data-video-id');
                togglePin(videoId);
            };
        });
    }

    function extractVideoId(url) {
        if (typeof url !== 'string' || !url.trim()) return null;
        try {
            const input = url.trim();
            const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`);
            if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) return null;
            let id;
            if (['youtu.be', 'www.youtu.be'].includes(parsed.hostname)) {
                id = parsed.pathname.match(/^\/([^/]+)\/?$/)?.[1];
            } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(parsed.hostname)) {
                id = parsed.pathname === '/watch' ? parsed.searchParams.get('v')
                    : parsed.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)\/?$/)?.[1];
            }
            return validVideoId(id) ? id : null;
        } catch {
            return null;
        }
    }

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

    async function searchYouTubeLive(channelName) {
        if (!channelName) return null;

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
            throw new Error(response?.error || 'Search failed');
        }

        const contents = response.results;
        if (!contents || contents.length === 0) return null;

        const normalizedChannel = channelName.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Prefer a matching channel; flag the first live result otherwise.
        for (const video of contents) {
            const normalizedResult = video.channel.toLowerCase().replace(/[^a-z0-9]/g, '');
            const isSimilar = normalizedResult && normalizedChannel && (normalizedResult.includes(normalizedChannel) ||
                normalizedChannel.includes(normalizedResult) ||
                levenshteinDistance(normalizedChannel, normalizedResult) <= 3);

            if (isSimilar) return video;
        }

        return { ...contents[0], approximate: true };

    }

    let searchGeneration = 0;
    async function handleAutoFind() {
        const channel = getTwitchChannel();
        if (!channel) {
            updateStatus('Open a Twitch channel to find its YouTube stream.', 'error');
            return;
        }
        const generation = ++searchGeneration;
        const resultDiv = document.getElementById('ytot-search-result');
        const button = document.getElementById('ytot-autofind');
        if (!resultDiv) return;
        if (button) button.disabled = true;
        resultDiv.textContent = 'Searching YouTube…';
        const current = () => generation === searchGeneration && channel === getTwitchChannel() &&
            resultDiv === document.getElementById('ytot-search-result');
        try {
            const result = await searchYouTubeLive(channel);
            if (!current()) return;
            if (!result || !validVideoId(result.videoId)) {
                resultDiv.textContent = 'No live stream found. Try pasting a YouTube link.';
                return;
            }
            const approxNote = result.approximate ? '<div class="ytot-result-note">Best match · check the channel before playing</div>' : '';
            const linkedNote = result.linkedChannel ? '<div class="ytot-result-note">From the streamer’s linked YouTube channel</div>' : '';
            resultDiv.innerHTML = `
                <div class="ytot-result-card">
                    ${approxNote}${linkedNote}
                    <div class="ytot-result-title">${escapeHtml(result.title)}</div>
                    <div class="ytot-result-channel">${escapeHtml(result.channel)}</div>
                    <button type="button" class="ytot-result-use">Use This Stream</button>
                </div>
            `;
            resultDiv.querySelector('.ytot-result-use').onclick = () => {
                if (current()) injectYouTube(result.videoId, result);
            };
        } catch (error) {
            if (current()) resultDiv.textContent = `Search unavailable: ${error.message} You can paste a YouTube link.`;
        } finally {
            if (button && generation === searchGeneration) button.disabled = false;
        }
    }

    function escapeHtml(text) {
        const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(text ?? '').replace(/[&<>"']/g, character => entities[character]);
    }

    function injectYouTube(videoId, metadata = null, restoredPlayback = null) {
        if (!validVideoId(videoId)) return;
        const container = window.__ypftPlayback.container();
        if (!container || !getTwitchChannel()) {
            updateStatus('Open a Twitch channel with a player first.', 'error');
            return;
        }
        window.__ypftKick?.stop({ forget: true });
        searchGeneration++;
        const searchButton = document.getElementById('ytot-autofind');
        if (searchButton) searchButton.disabled = false;
        const searchResult = document.getElementById('ytot-search-result');
        if (searchResult) searchResult.textContent = '';
        cancelSync();

        if (metadata) {
            addToHistory(videoId, metadata);
        } else {
            // Fetch metadata asynchronously
            if (chrome.runtime?.id) {
                chrome.runtime.sendMessage({ type: 'GET_VIDEO_DETAILS', videoId })
                    .then(response => addToHistory(videoId, response && !response.error
                        ? response : { title: videoId, channel: 'Manual Entry' }))
                    .catch(() => addToHistory(videoId, { title: videoId, channel: 'Manual Entry' }));
            }
        }

        document.getElementById('ytot-youtube-wrapper')?.remove();

        const wrapper = document.createElement('div');
        wrapper.id = 'ytot-youtube-wrapper';

        const iframe = document.createElement('iframe');
        iframe.id = 'ytot-youtube-player';
        iframe.title = 'YouTube video player';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        iframe.setAttribute('allowfullscreen', 'true');

        wrapper.appendChild(iframe);
        // A stable portal avoids reloading the YouTube iframe when React replaces
        // Twitch's player. Ownership is published before mounting the iframe.
        window.__ypftPlayback.own(wrapper, restoredPlayback);
        document.body.appendChild(wrapper);
        window.__ypftChat?.sync();

        state.youtubeVideoId = videoId;
        const channel = getTwitchChannel();
        saveState(`ytot_${channel}`, videoId);
        saveState(`ytot_active_${channel}`, videoId); // Mark as active for persistence
        saveState(`ytot_playback_${channel}`, window.__ypftPlayback.snapshot());

        updateToggleButton(true);
        closeDropdown(document.getElementById('ytot-dropdown')?.contains(document.activeElement));
        updateStatus('YouTube playing', 'success');

        if (state.autoSyncEnabled) {
            startAutoSync();
        }

        Logger.log('YouTube injected:', videoId);
    }

    function removeYouTube(keepState = false) {
        cancelSync();
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

    function cancelSync() {
        clearTimeout(state.syncTimeoutId);
        state.syncTimeoutId = null;
        state.isSyncing = false;
        const button = document.getElementById('ytot-sync-now');
        if (button) button.disabled = false;
    }

    function syncNow() {
        const iframe = document.getElementById('ytot-youtube-player');
        if (!iframe || state.isSyncing) return;
        cancelSync();
        state.isSyncing = true;
        const button = document.getElementById('ytot-sync-now');
        if (button) button.disabled = true;
        updateStatus('Jumping to live…', 'syncing');
        const sendCmd = (func, args) => iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
        const step = (delay, action) => {
            state.syncTimeoutId = setTimeout(() => {
                if (iframe !== document.getElementById('ytot-youtube-player')) { cancelSync(); return; }
                try { action(); }
                catch { cancelSync(); updateStatus('Sync failed. Try again.', 'error'); }
            }, delay);
        };
        try {
            sendCmd('seekTo', [999999, true]);
            step(500, () => {
                sendCmd('setPlaybackRate', [CONFIG.SYNC_SPEED]);
                updateStatus('Catching up at 2×…', 'syncing');
                step(5000, () => {
                    sendCmd('setPlaybackRate', [CONFIG.NORMAL_SPEED]);
                    cancelSync();
                    updateStatus('Caught up to live', 'success');
                    step(3000, () => updateStatus(''));
                });
            });
        } catch {
            cancelSync();
            updateStatus('Sync failed. Try again.', 'error');
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

    function enforceQuality() {
        if (!state.forceHighestQuality) return;

        try {
            // Twitch stores quality in localStorage under 'video-quality'
            // Format: {"default":"160p30"} or {"default":"chunked"} (Source)
            const qualityKey = 'video-quality';
            const currentSettings = JSON.parse(window.localStorage.getItem(qualityKey) || '{}');

            // Twitch uses 'chunked' for the source stream. Preserve its other preferences.
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

    function setupGlobalListeners() {
        // Close on click outside
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('ytot-nav-wrapper');
            if (wrapper && !wrapper.contains(e.target)) closeDropdown();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('ytot-dropdown')?.classList.contains('visible')) closeDropdown(true);
        });
    }

    function setupEventListeners() {
        renderTheatreControl();
        const toggle = document.getElementById('ytot-toggle');
        const dropdown = document.getElementById('ytot-dropdown');
        const close = document.getElementById('ytot-close');
        const urlInput = document.getElementById('ytot-url');
        const goBtn = document.getElementById('ytot-go');
        const restore = document.getElementById('ytot-restore');
        const syncNowBtn = document.getElementById('ytot-sync-now');
        const autoFindBtn = document.getElementById('ytot-autofind');

        autoFindBtn.onclick = handleAutoFind;
        toggle.onclick = () => {
            renderTheatreControl();
            const visible = dropdown.classList.toggle('visible');
            toggle.setAttribute('aria-expanded', String(visible));
            if (visible) renderHistory();
            else clearHistoryUI();
        };
        close.onclick = () => closeDropdown(true);

        const handleGo = () => {
            const kick = window.__ypftKick;
            const kickChannel = kick?.parseChannel(urlInput.value);
            if (kickChannel && /^(?:https?:\/\/)?(?:www\.)?kick\.com\//i.test(urlInput.value.trim())) {
                urlInput.setAttribute('aria-invalid', String(!kick.enabled()));
                if (!kick.enabled()) { updateStatus('Enable Kick support in Settings → Kick (Experimental) first.', 'error'); return; }
                kick.play(kickChannel); closeDropdown(true); return;
            }
            const videoId = extractVideoId(urlInput.value);
            urlInput.setAttribute('aria-invalid', String(!videoId));
            if (videoId) injectYouTube(videoId);
            else {
                updateStatus(kick?.enabled() ? 'Enter a valid YouTube or Kick channel URL.' : 'Enter a valid YouTube video or livestream URL.', 'error');
                urlInput.focus();
            }
        };

        goBtn.onclick = handleGo;
        urlInput.oninput = () => {
            if (urlInput.getAttribute('aria-invalid') !== 'true') return;
            urlInput.setAttribute('aria-invalid', 'false');
            updateStatus('');
        };
        urlInput.onkeydown = (e) => {
            if (e.key === 'Enter') handleGo();
        };

        restore.onclick = () => window.__ypftKick?.active() ? window.__ypftKick.restore() : removeYouTube(false);
        syncNowBtn.onclick = syncNow;
        document.getElementById('ytot-open-settings').onclick = openSettings;
    }

    function renderPlaybackControls() {
        const sync = document.getElementById('ytot-autosync');
        const quality = document.getElementById('ytot-quality');
        if (sync) sync.checked = state.autoSyncEnabled;
        if (quality) quality.checked = state.forceHighestQuality;
    }

    function setupSettingsListeners() {
        window.__ypftKick?.setupSettings();
        const emotesToggle = document.getElementById('ytot-emotes-toggle');
        emotesToggle.disabled = !window.__ypftEmotes;
        emotesToggle.onchange = event => window.__ypftEmotes?.configure(event.target.checked, true);
        renderEmoteControl();
        setupChatControls();
        document.getElementById('ytot-theatre').onclick = toggleTheatreMode;
        renderTheatreControl();
        const extensionsToggle = document.getElementById('ytot-hide-extensions');
        extensionsToggle.checked = hideExtensions;
        extensionsToggle.onchange = event => {
            applyExtensionVisibility(event.target.checked);
            saveState(HIDE_EXTENSIONS_KEY, hideExtensions);
        };

        const autoSyncCheckbox = document.getElementById('ytot-autosync');
        autoSyncCheckbox.onchange = (e) => {
            settingsRevision.autoSync++;
            state.autoSyncEnabled = e.target.checked;
            saveState('ytot_autosync', state.autoSyncEnabled);
            state.autoSyncEnabled && state.youtubeVideoId ? startAutoSync() : stopAutoSync();
        };

        const qualityCheckbox = document.getElementById('ytot-quality');
        qualityCheckbox.onchange = (e) => {
            settingsRevision.quality++;
            state.forceHighestQuality = e.target.checked;
            saveState('ytot_force_highest', state.forceHighestQuality);
            if (state.forceHighestQuality) {
                startQualityEnforcement();
            } else {
                stopQualityEnforcement();
            }
        };
        document.getElementById('ytot-vaft').onchange = e => changeVaftSetting(e.target.checked);
        document.getElementById('ytot-vaft-reload').onclick = () => location.reload();
        renderPlaybackControls();
        renderVaftSetting();
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
        document.getElementById('ytot-chat-mode').value = settings.fullscreenOnly ? 'fullscreen' : 'always';
        document.getElementById('ytot-chat-opacity').value = settings.opacity;
        document.getElementById('ytot-chat-font').value = settings.fontSize;
        document.getElementById('ytot-chat-color').value = settings.color;
        document.getElementById('ytot-chat-compact').checked = settings.compact;
        document.getElementById('ytot-chat-through').checked = settings.clickThrough;
        renderChatAppearance(settings);
    }
    function renderChatAppearance(settings) {
        const opacity = document.getElementById('ytot-chat-opacity-value');
        const font = document.getElementById('ytot-chat-font-value');
        if (opacity) opacity.textContent = `${settings.opacity}%`;
        if (font) font.textContent = `${settings.fontSize}px`;
        const preview = document.getElementById('ytot-chat-preview');
        if (!preview) return;
        const rgb = [1, 3, 5].map(index => parseInt(settings.color.slice(index, index + 2), 16));
        preview.style.backgroundColor = `rgba(${rgb.join(',')},${settings.opacity / 100})`;
        preview.style.fontSize = `${settings.fontSize}px`;
        preview.classList.toggle('ytot-chat-preview-compact', settings.compact);
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
            const control = document.getElementById(id);
            const value = event =>
                kind === 'mode' ? event.target.value === 'fullscreen' :
                kind === 'number' ? Number(event.target.value) :
                kind === 'boolean' ? event.target.checked : event.target.value;
            control.onchange = event => update({ [key]: value(event) });
            if (['opacity', 'fontSize', 'color'].includes(key)) {
                control.oninput = event => renderChatAppearance({ ...chat.settings(), [key]: value(event) });
            }
        }
        document.getElementById('ytot-chat-reset').onclick = () => update({ x: 1, y: 0.15, width: 320, height: 0.55 });
        renderChatControls();
    }
    document.addEventListener('ypft-chat-setting', renderChatControls);
    function renderEmoteControl() {
        const toggle = document.getElementById('ytot-emotes-toggle');
        if (toggle) toggle.checked = window.__ypftEmotes?.enabled() === true;
    }
    document.addEventListener('ypft-emote-setting', renderEmoteControl);

    let spawnAttempts = 0;
    let initGeneration = 0;
    let restoreTimeout = null;
    const settingsRevision = { autoSync: 0, quality: 0 };

    async function init() {
        if (state.initialized) return;

        // Try to insert into Twitch Top Nav
        const rightNav = navParent();

        if (!rightNav) return;
        state.initialized = true;
        const generation = ++initGeneration;
        const channel = getTwitchChannel();

        document.getElementById('ytot-nav-wrapper')?.remove();

        placeNavButton(createNavButton(), rightNav);
        setupEventListeners();
        refreshDOMCache();

        // A late storage read must not overwrite a setting just changed in the menu.
        const revision = { ...settingsRevision };
        const [savedAutoSync, savedForceHighest] = await Promise.all([
            loadState('ytot_autosync'), loadState('ytot_force_highest')
        ]);
        if (generation !== initGeneration || channel !== getTwitchChannel()) return;
        if (revision.autoSync === settingsRevision.autoSync) state.autoSyncEnabled = savedAutoSync === true;
        if (revision.quality === settingsRevision.quality) state.forceHighestQuality = savedForceHighest === true;
        renderPlaybackControls();
        if (state.forceHighestQuality) startQualityEnforcement();
        else stopQualityEnforcement();
        updateToggleButton(!!state.youtubeVideoId || !!window.__ypftKick?.active());
        if (state.autoSyncEnabled && state.youtubeVideoId) startAutoSync();
        else stopAutoSync();

        renderHistory();

        // Restore Active Stream or Last Used
        if (channel) {
            const [activeStream, savedVideoId, restoredPlayback] = await Promise.all([
                loadState(`ytot_active_${channel}`), loadState(`ytot_${channel}`), loadState(`ytot_playback_${channel}`)
            ]);
            if (generation !== initGeneration || channel !== getTwitchChannel()) return;
            if (validVideoId(activeStream)) {
                Logger.log('Restoring active stream:', activeStream);
                const restoreWhenReady = (attempt = 0) => {
                    if (generation !== initGeneration || channel !== getTwitchChannel() || state.youtubeVideoId || window.__ypftKick?.active()) return;
                    if (window.__ypftPlayback.container()) injectYouTube(activeStream, null, restoredPlayback);
                    else if (attempt < 40) restoreTimeout = setTimeout(() => {
                        restoreTimeout = null;
                        restoreWhenReady(attempt + 1);
                    }, 250);
                    else updateStatus('Twitch player was not ready. Reopen your saved YouTube stream.', 'error');
                };
                restoreWhenReady();
            } else {
                if (validVideoId(savedVideoId)) {
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

    let lastChannel = getTwitchChannel();
    let checkTimeout = null;
    function scheduleCheck(delay) {
        if (checkTimeout !== null) clearTimeout(checkTimeout);
        checkTimeout = setTimeout(() => { checkTimeout = null; check(); }, delay);
    }

    function check() {
        // If nav bar exists but we aren't initialized, try init
        if (state.initialized) return;
        init();
        if (!state.initialized && spawnAttempts < CONFIG.MAX_ATTEMPTS) {
            spawnAttempts++;
            // Fast Start: Check more frequently for the first few seconds
            const delay = spawnAttempts <= 20 ? CONFIG.FAST_CHECK_INTERVAL : CONFIG.CHECK_INTERVAL;
            scheduleCheck(delay);
        }
    }

    // SPA Navigation Detection
    function handleNavigation() {
        window.__ypftDirectory?.sync();
        window.__ypftEmotes?.sync();
        const channel = getTwitchChannel();
        if (channel !== lastChannel) {
            lastChannel = channel;
            searchGeneration++;
            Logger.log('Navigation detected');

            // Navigate away: clear UI but keep state
            removeYouTube(true);
            releaseUI();
            initGeneration++;
            state.initialized = false;
            state.youtubeVideoId = null;
            spawnAttempts = 0;

            // Re-bind to new page
            scheduleCheck(500);
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

    function refreshPage() {
        handleNavigation();
        window.__ypftKick?.sync();
        window.__ypftChat?.sync();
        updateSettingsOrientation();
        if (document.visibilityState === 'hidden') { closeSettings(false); closeDropdown(); releaseTheatreControl(); return; }
        renderTheatreControl();
        if (!document.getElementById('ytot-nav-wrapper') && checkTimeout === null) {
            releaseUI();
            state.initialized = false;
            spawnAttempts = 0;
            check();
        }
    }
    setInterval(refreshPage, 2000);
    document.addEventListener('visibilitychange', refreshPage);

    window.__ypftKick?.connect({ beforePlay: () => removeYouTube(false), changed: () => {
        updateToggleButton(!!state.youtubeVideoId || !!window.__ypftKick?.active());
        const input = document.getElementById('ytot-url');
        if (input) {
            input.placeholder = window.__ypftKick?.enabled() ? 'Paste YouTube or Kick URL' : 'Paste YouTube URL';
            input.setAttribute('aria-label', window.__ypftKick?.enabled() ? 'YouTube video or Kick channel URL' : 'YouTube video or livestream URL');
        }
    } });
    setupGlobalListeners();
    scheduleCheck(1000);

})();
