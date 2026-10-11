const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const original = fs.readFileSync(`${__dirname}/../twitch-content.js`, 'utf8');
const source = original.replace(/\}\)\(\);\s*$/, 'window.testContent = { state, closeDropdown, openSettings, closeSettings, selectSettingsTab, createSettingsDialog, setupSettingsListeners, memory: () => ({ settings: !!settingsDialog, ui: Object.values(uiCache).filter(Boolean).length, theatre: [theatreObserver, theatreHost, theatreNative, theatreNavParent].filter(Boolean).length }), changeVaftSetting, renderVaftSetting, injectYouTube, removeYouTube, syncNow, enforceQuality, createNavButton, navParent, placeNavButton, updateToggleButton, applyExtensionVisibility, setupChatControls, renderChatControls, renderTheatreControl, toggleTheatreMode, extractVideoId, escapeHtml, handleAutoFind, handleNavigation, addToHistory, togglePin, renderHistory, getTwitchChannel, setupEventListeners, init };\n})();');
function fixture({ enabled = false, failure = null, running = null, saved = {}, sendMessage = null } = {}) {
    const elements = new Map(), calls = [], timers = [], stored = { ...saved }, attrs = new Map(), storageListeners = [], observers = [];
    const element = tag => ({ tag, id: '', style: {}, dataset: {}, children: [], attributes: new Map(), classes: new Set(), isConnected: true,
        focus() { document.activeElement = this; },
        showModal() { this.open = true; }, close() { this.open = false; },
        contains(node) { for (; node; node = node.parentElement) if (node === this) return true; return false; },
        get classList() { return { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name),
            toggle: (name, active = !this.classes.has(name)) => { if (active) this.classes.add(name); else this.classes.delete(name); return active; } }; },
        appendChild(child) {
            if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child);
            this.children.push(child); child.parentElement = this; elements.set(child.id, child);
        },
        insertBefore(child, before) { this.appendChild(child); this.children.pop(); this.children.splice(this.children.indexOf(before), 0, child); },
        remove() { this.removed = true; elements.delete(this.id); },
        setAttribute(key, value) { this.attributes.set(key, value); }, getAttribute(key) { return this.attributes.get(key) ?? null; },
        querySelector(selector) { return selector === '.ytot-settings-content' ? (this.content ||= { scrollTop: 0 }) : null; }, querySelectorAll() { return []; }, closest() { return null; }
    });
    for (const id of ['ytot-vaft', 'ytot-vaft-status', 'ytot-vaft-reload', 'ytot-status', 'ytot-history-section', 'ytot-toggle', 'ytot-restore', 'ytot-sync-now', 'ytot-actions', 'ytot-hide-extensions', 'ytot-chat-toggle', 'ytot-emotes-toggle', 'ytot-chat-settings', 'ytot-chat-mode', 'ytot-chat-opacity', 'ytot-chat-font', 'ytot-chat-color', 'ytot-chat-compact', 'ytot-chat-through', 'ytot-chat-reset', 'ytot-theatre', 'ytot-theatre-label', 'ytot-search-result', 'ytot-autofind', 'ytot-dropdown', 'ytot-close', 'ytot-url', 'ytot-go', 'ytot-autosync', 'ytot-quality']) elements.set(id, element('div'));
    for (const id of ['ytot-open-settings', 'ytot-settings-close', ...['playback', 'chat', 'extras'].flatMap(tab => [`ytot-tab-${tab}`, `ytot-panel-${tab}`])]) elements.set(id, element('div'));
    for (const tab of ['playback', 'chat', 'extras']) {
        const button = elements.get(`ytot-tab-${tab}`); button.dataset.ytotSettingsTab = tab;
        button.closest = selector => selector === '[data-ytot-settings-tab]' ? button : null;
    }
    if (running) attrs.set('data-ypft-vaft', running);
    const document = {
        body: element('body'), head: null,
        documentElement: { getAttribute: k => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k) },
        createElement: element, getElementById: id => elements.get(id), querySelector() { return null; }, addEventListener() {}
    };
    const local = new Map([['video-quality', '{"default":"160p30","other":"kept"}']]);
    const player = element('div');
    const playback = { container: () => player, own(wrapper, restored) { calls.push({ own: wrapper, restored }); },
        release(options) { calls.push({ release: options }); }, snapshot: () => ({ paused: true, muted: true, volume: 0.2 }) };
    const context = vm.createContext({
        window: { location: { pathname: '/channel' }, __ypftPlayback: playback, localStorage: { getItem: k => local.get(k), setItem: (k, v) => local.set(k, v) } },
        location: { href: 'https://www.twitch.tv/channel', reload() { calls.push('reload-page'); } },
        chrome: { runtime: { id: 'ypft', async sendMessage(message) {
            calls.push(message);
            if (sendMessage) return sendMessage(message);
            if (failure) return { error: failure };
            if (message.type === 'SET_VAFT_SETTINGS') { enabled = message.enabled; return { enabled, registered: enabled, reloadRequired: true }; }
            if (message.type === 'GET_VIDEO_DETAILS') return { error: 'fixture' };
            return { enabled, registered: enabled };
        } }, storage: { local: {
            async set(data) { calls.push({ persist: data }); Object.assign(stored, data); },
            get(keys, callback) { callback(stored); }
        }, onChanged: { addListener(listener) { storageListeners.push(listener); } } } },
        document, MutationObserver: class {
            constructor(fn) { this.fn = fn; this.targets = []; observers.push(this); }
            observe(target) { this.targets.push(target); }
            disconnect() { this.targets = []; }
        },
        setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout(id) { if (id) timers[id - 1] = null; }, setInterval() { return 1; }, clearInterval() {},
        URL, console: { log() {}, error() {}, warn() {} }
    });
    vm.runInContext(source, context);
    return { api: context.window.testContent, document, player, element, elements, calls, timers, stored, local, attrs, storageListeners, observers, window: context.window, location: context.location };
}
test('settings window explains opt-in reload and uses interruption-blocking terminology', () => {
    const f = fixture();
    const menu = f.api.createSettingsDialog().innerHTML;
    assert.match(menu, /Interruption blocking/);
    assert.match(menu, /ytot-badge">Experimental/);
    assert.match(menu, /Reload Twitch to apply/);
    assert.match(menu, /id="ytot-vaft" disabled/);
    assert.doesNotMatch(menu, /ad blocking/i);
});
test('YPFT uses the right navigation column before the account controls and keeps its accessible name', () => {
    const f = fixture(), left = f.element('div'), right = f.element('div'), account = f.element('div'), user = f.element('button');
    right.appendChild(account); account.appendChild(user);
    right.querySelector = () => user;
    f.document.querySelector = selector => selector === '.top-nav__menu > div:last-child' ? right : left;
    assert.equal(f.api.navParent(), right);
    const nav = f.api.createNavButton(); f.api.placeNavButton(nav, f.api.navParent());
    assert.deepEqual(right.children, [nav, account]); assert.equal(left.children.length, 0);
    assert.match(nav.innerHTML, /ytot-label">YPFT</);
    assert.match(nav.innerHTML, /aria-label="YouTube Player for Twitch"/);
    assert.doesNotMatch(nav.innerHTML, /ytot-icon/);
    assert.match(nav.innerHTML, /aria-haspopup="dialog"/);
    assert.doesNotMatch(nav.innerHTML, /Extra emotes/);
});
test('emote settings control persists its setting independently of floating chat', () => {
    const f = fixture(); let enabled = true, saves = 0;
    f.window.__ypftEmotes = { enabled: () => enabled, configure(value, save) { enabled = value; if (save) saves++; } };
    f.api.setupSettingsListeners();
    const toggle = f.elements.get('ytot-emotes-toggle');
    assert.equal(toggle.checked, true); assert.equal(toggle.disabled, false);
    toggle.onchange({ target: { checked: false } });
    assert.equal(enabled, false); assert.equal(saves, 1);
});
test('YPFT label stays unchanged after initialization, activation and restoring Twitch', () => {
    const f = fixture(), label = f.element('span'), toggle = f.elements.get('ytot-toggle');
    toggle.querySelector = selector => selector === '.ytot-label' ? label : null;
    for (const active of [false, true, false]) {
        f.api.updateToggleButton(active);
        assert.equal(label.textContent, 'YPFT');
        assert.equal(toggle.classes.has('active'), active);
        assert.equal(f.elements.get('ytot-actions').hidden, !active);
    }
});
test('toggle confirms preference and registration before forcing reload, preserving active YouTube state', async () => {
    const f = fixture();
    f.api.state.youtubeVideoId = 'abcdefghijk';
    await f.api.changeVaftSetting(true);
    assert.equal(f.calls[0].persist.ytot_active_channel, 'abcdefghijk');
    assert.equal(f.calls[0].persist.ytot_playback_channel.muted, true);
    assert.equal(f.calls[1].type, 'SET_VAFT_SETTINGS');
    assert.equal(f.calls[2], 'reload-page');
    assert.equal(f.elements.get('ytot-vaft-status').textContent, 'Saved. Reloading Twitch…');
});
test('failed registration does not reload and surfaces a retryable error', async () => {
    const f = fixture({ failure: 'Registration failed' });
    await f.api.changeVaftSetting(true);
    assert.equal(f.calls.includes('reload-page'), false);
    assert.match(f.elements.get('ytot-vaft-status').textContent, /Registration failed/);
});
test('YouTube injection uses untouched iframe URL/API and a body portal; restore relinquishes ownership', () => {
    const f = fixture();
    f.api.injectYouTube('abcdefghijk', { title: 'Fixture', channel: 'Fixture' });
    const iframe = f.elements.get('ytot-youtube-player');
    assert.equal(iframe.src, 'https://www.youtube.com/embed/abcdefghijk?autoplay=1&rel=0&enablejsapi=1');
    assert.match(iframe.allow, /fullscreen/);
    const wrapper = f.elements.get('ytot-youtube-wrapper');
    assert.equal(f.document.body.children[0], wrapper);
    assert.equal(f.calls.find(c => c.own)?.own, wrapper);
    assert.equal(f.elements.get('ytot-actions').hidden, false);
    const messages = [];
    iframe.contentWindow = { postMessage(data, origin) { messages.push({ data: JSON.parse(data), origin }); } };
    f.api.syncNow();
    assert.equal(messages[0].origin, 'https://www.youtube.com');
    assert.equal(messages[0].data.func, 'seekTo');
    f.api.removeYouTube();
    assert.equal(wrapper.removed, true);
    assert.equal(f.calls.find(c => c.release)?.release.navigation, false);
    assert.equal(f.api.state.youtubeVideoId, null);
    assert.equal(f.elements.get('ytot-actions').hidden, true);
});
test('quality preference preserves other Twitch keys and never writes YouTube settings', () => {
    const f = fixture();
    f.api.state.forceHighestQuality = true;
    f.api.enforceQuality();
    assert.deepEqual(JSON.parse(f.local.get('video-quality')), { default: 'chunked', other: 'kept' });
    assert.equal(f.local.size, 1);
});

test('dropdown keeps stream search and selection while optional controls are grouped in modal tabs', () => {
    const menu = fixture().api.createNavButton().innerHTML;
    const dialog = fixture().api.createSettingsDialog(), settings = dialog.innerHTML;
    for (const id of ['ytot-autofind', 'ytot-history-section', 'ytot-url', 'ytot-go', 'ytot-sync-now', 'ytot-restore', 'ytot-open-settings'])
        assert.ok(menu.includes('id="' + id + '"'), id);
    for (const id of ['ytot-autosync', 'ytot-quality', 'ytot-emotes-toggle', 'ytot-chat-toggle', 'ytot-hide-extensions', 'ytot-vaft', 'ytot-theatre']) {
        assert.ok(settings.includes('id="' + id + '"'), id); assert.ok(!menu.includes('id="' + id + '"'), id);
    }
    assert.equal(dialog.tag, 'dialog'); assert.equal(dialog.getAttribute('aria-labelledby'), 'ytot-settings-title');
    assert.equal((settings.match(/role="tabpanel"/g) || []).length, 3);
    assert.match(settings, /aria-orientation="vertical"/);
    assert.doesNotMatch(menu, /<details/);
});

test('invalid URL feedback identifies and focuses the field, then clears while correcting it', () => {
    const f = fixture(); f.api.setupEventListeners();
    const input = f.elements.get('ytot-url');
    input.value = 'bad url'; f.elements.get('ytot-go').onclick();
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(f.document.activeElement, input);
    assert.match(f.elements.get('ytot-status').textContent, /YouTube.*URL/);
    assert.match(f.api.createNavButton().innerHTML, /aria-describedby="ytot-status"/);
    input.value = 'https://www.youtube.com/watch?v=abcdefghijk'; input.oninput();
    assert.equal(input.getAttribute('aria-invalid'), 'false');
    assert.equal(f.elements.get('ytot-status').textContent, '');
    f.elements.get('ytot-go').onclick();
    assert.equal(f.api.state.youtubeVideoId, 'abcdefghijk');
});

test('settings opens lazily, switches accessible tabs by keyboard, and releases its dialog on close', () => {
    const f = fixture(); f.api.setupEventListeners();
    assert.equal(f.api.memory().settings, false); assert.equal(f.elements.has('ytot-settings-dialog'), false);
    f.elements.get('ytot-dropdown').classes.add('visible');
    f.elements.get('ytot-open-settings').onclick();
    const dialog = f.elements.get('ytot-settings-dialog');
    assert.equal(dialog.open, true); assert.equal(f.elements.get('ytot-dropdown').classes.has('visible'), false);
    assert.equal(f.document.activeElement, f.elements.get('ytot-tab-playback'));
    assert.equal(f.elements.get('ytot-panel-chat').hidden, true);
    let prevented = 0;
    dialog.onkeydown({ target: f.elements.get('ytot-tab-playback'), key: 'ArrowRight', preventDefault() { prevented++; } });
    assert.equal(prevented, 1); assert.equal(f.document.activeElement, f.elements.get('ytot-tab-chat'));
    assert.equal(f.elements.get('ytot-panel-chat').hidden, false);
    assert.equal(f.elements.get('ytot-tab-chat').getAttribute('aria-selected'), 'true');
    assert.equal(f.elements.get('ytot-tab-playback').tabIndex, -1);
    f.api.selectSettingsTab('invalid'); assert.equal(f.elements.get('ytot-panel-chat').hidden, false);
    f.api.openSettings(); assert.equal(f.elements.get('ytot-settings-dialog'), dialog);
    dialog.oncancel({ preventDefault() { prevented++; } });
    assert.equal(dialog.open, false); assert.equal(dialog.removed, true); assert.equal(f.api.memory().settings, false);
    assert.equal(f.document.activeElement, f.elements.get('ytot-toggle'));
    f.api.openSettings(); const next = f.elements.get('ytot-settings-dialog');
    assert.notEqual(next, dialog); assert.equal(f.elements.get('ytot-panel-chat').hidden, false);
    dialog.onclose({ target: dialog }); assert.equal(next.open, true);
    f.elements.get('ytot-settings-close').onclick(); assert.equal(f.api.memory().settings, false);
});

test('settings edits persist across window recreation, and navigation closes the window', async () => {
    const f = fixture(); f.api.openSettings();
    f.elements.get('ytot-autosync').onchange({ target: { checked: true } });
    f.elements.get('ytot-hide-extensions').onchange({ target: { checked: true } });
    f.api.closeSettings(); f.api.openSettings();
    assert.equal(f.elements.get('ytot-autosync').checked, true);
    assert.equal(f.elements.get('ytot-hide-extensions').checked, true);
    assert.equal(f.stored.ytot_autosync, true); assert.equal(f.stored.ytot_hide_extensions, true);
    const dialog = f.elements.get('ytot-settings-dialog');
    f.window.location.pathname = '/other'; f.api.handleNavigation();
    assert.equal(dialog.removed, true); assert.equal(f.api.memory().settings, false);
    await Promise.resolve();
});

test('modal focus wraps at both ends and Escape closes without reaching Twitch shortcuts', () => {
    const f = fixture(); f.api.openSettings();
    const dialog = f.elements.get('ytot-settings-dialog'), first = f.elements.get('ytot-tab-playback'), last = f.elements.get('ytot-settings-close');
    first.tabIndex = last.tabIndex = 0; first.getClientRects = last.getClientRects = () => [{}];
    dialog.querySelectorAll = () => [first, last];
    let prevented = 0, stopped = 0;
    const key = (key, shiftKey = false) => dialog.onkeydown({ key, shiftKey, target: f.document.activeElement,
        preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
    first.focus(); key('Tab', true); assert.equal(f.document.activeElement, last);
    key('Tab'); assert.equal(f.document.activeElement, first);
    key('Escape'); assert.equal(f.elements.has('ytot-settings-dialog'), false);
    assert.equal(f.document.activeElement, f.elements.get('ytot-toggle'));
    assert.equal(prevented, 3); assert.equal(stopped, 3);
});

test('initialization restores preferences when the settings window has never been mounted', async () => {
    const f = fixture({ saved: { ytot_autosync: true, ytot_force_highest: true } });
    f.elements.delete('ytot-autosync'); f.elements.delete('ytot-quality');
    f.document.querySelector = selector => selector.includes('top-nav__menu') ? f.document.body : null;
    await f.api.init();
    assert.equal(f.api.state.autoSyncEnabled, true); assert.equal(f.api.state.forceHighestQuality, true);
    assert.equal(f.api.memory().settings, false);
});
test('native extension visibility restores local preference, changes across tabs and switches off cleanly', async () => {
    const f = fixture({ saved: { ytot_hide_extensions: true } });
    await Promise.resolve();
    assert.equal(f.attrs.has('data-ypft-hide-extensions'), true);
    assert.equal(f.elements.get('ytot-hide-extensions').checked, true);
    f.storageListeners[0]({ ytot_hide_extensions: { newValue: false } }, 'sync');
    assert.equal(f.attrs.has('data-ypft-hide-extensions'), true);
    f.storageListeners[0]({ ytot_hide_extensions: { newValue: false } }, 'local');
    assert.equal(f.attrs.has('data-ypft-hide-extensions'), false);
    assert.equal(f.elements.get('ytot-hide-extensions').checked, false);
    assert.equal(f.calls.includes('reload-page'), false);
    assert.equal(f.calls.some(call => call?.release || call?.own), false);
});
test('delayed visibility restore does not overwrite a newer local choice', async () => {
    const f = fixture({ saved: { ytot_hide_extensions: true } });
    f.api.applyExtensionVisibility(false);
    await Promise.resolve();
    assert.equal(f.attrs.has('data-ypft-hide-extensions'), false);
});

test('chat appearance follows enablement in settings and preserves values when turned off', () => {
    const f = fixture();
    let settings = { enabled: false, fullscreenOnly: true, opacity: 70, fontSize: 14,
        color: '#18151f', compact: false, clickThrough: false };
    f.window.__ypftChat = {
        settings: () => ({ ...settings }),
        configure(value, save) {
            assert.equal(save, true);
            settings = value;
            f.api.renderChatControls();
        }
    };
    const appearance = f.elements.get('ytot-chat-settings');
    f.api.setupChatControls();
    assert.equal(appearance.hidden, true);
    const toggle = f.elements.get('ytot-chat-toggle');
    toggle.onchange({ target: { checked: true } });
    assert.equal(appearance.hidden, false);
    f.elements.get('ytot-chat-opacity').onchange({ target: { value: '35' } });
    assert.equal(settings.opacity, 35);
    toggle.onchange({ target: { checked: false } });
    assert.equal(appearance.hidden, true);
    assert.equal(settings.opacity, 35);
});

test('appearance input previews changes without writing preferences until committed', () => {
    const f = fixture();
    let settings = { enabled: true, fullscreenOnly: true, opacity: 70, fontSize: 14,
        color: '#18151f', compact: false, clickThrough: false }, saves = 0;
    for (const id of ['ytot-chat-preview', 'ytot-chat-opacity-value', 'ytot-chat-font-value']) {
        f.elements.set(id, f.element('div'));
    }
    f.window.__ypftChat = {
        settings: () => ({ ...settings }),
        configure(value, save) { settings = value; if (save) saves++; f.api.renderChatControls(); }
    };
    f.api.setupChatControls();
    const opacity = f.elements.get('ytot-chat-opacity');
    opacity.oninput({ target: { value: '35' } });
    assert.equal(f.elements.get('ytot-chat-opacity-value').textContent, '35%');
    assert.equal(settings.opacity, 70); assert.equal(saves, 0);
    f.elements.get('ytot-chat-font').oninput({ target: { value: '20' } });
    assert.equal(f.elements.get('ytot-chat-font-value').textContent, '20px');
    assert.equal(settings.fontSize, 14); assert.equal(saves, 0);
    opacity.onchange({ target: { value: '35' } });
    assert.equal(settings.opacity, 35); assert.equal(saves, 1);
    assert.equal(f.elements.get('ytot-chat-font-value').textContent, '14px');
    f.api.closeSettings();
    assert.equal(f.api.memory().settings, false);
});

test('theatre menu toggles Twitch without replacing YouTube or changing playback ownership', () => {
    const f = fixture();
    let active = false, clicks = 0;
    const native = f.element('button');
    native.click = () => { active = !active; clicks++; };
    f.player.querySelector = selector => {
        assert.match(selector, /button\[aria-label\*="\(alt\+t\)" i\]/);
        return native;
    };
    f.document.querySelector = () => active ? f.player : null;
    f.api.injectYouTube('abcdefghijk', { title: 'Fixture', channel: 'Fixture' });
    const iframe = f.elements.get('ytot-youtube-player');
    const stored = JSON.stringify(f.stored);
    f.api.renderTheatreControl();
    const button = f.elements.get('ytot-theatre');
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    f.api.toggleTheatreMode();
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(f.elements.get('ytot-theatre-label').textContent, 'Exit Theatre Mode');
    f.api.toggleTheatreMode();
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(clicks, 2);
    assert.equal(f.elements.get('ytot-youtube-player'), iframe);
    assert.equal(f.api.state.youtubeVideoId, 'abcdefghijk');
    assert.equal(f.calls.filter(call => call?.own).length, 1);
    assert.equal(f.calls.some(call => call?.release || call === 'reload-page'), false);
    assert.equal(JSON.stringify(f.stored), stored);
});

test('theatre menu reflects external changes and reacquires a replaced native control', () => {
    const f = fixture();
    let native = f.element('button'), clicks = 0;
    f.player.querySelector = () => native;
    f.api.renderTheatreControl();
    assert.equal(f.elements.get('ytot-theatre').getAttribute('aria-pressed'), 'false');
    native = f.element('button');
    native.setAttribute('aria-pressed', 'true');
    native.click = () => { clicks++; native.setAttribute('aria-pressed', 'false'); };
    f.api.renderTheatreControl();
    const observer = f.observers.find(item => item.targets.includes(native));
    assert.equal(observer.targets.includes(f.player), true);
    assert.equal(f.elements.get('ytot-theatre').getAttribute('aria-pressed'), 'true');
    f.api.toggleTheatreMode();
    assert.equal(clicks, 1);
    assert.equal(f.elements.get('ytot-theatre').getAttribute('aria-pressed'), 'false');
    native.setAttribute('aria-pressed', 'true');
    observer.fn();
    assert.equal(f.elements.get('ytot-theatre').getAttribute('aria-pressed'), 'true');
    native = null;
    observer.fn();
    assert.equal(observer.targets.length, 1);
    assert.equal(f.elements.get('ytot-theatre').disabled, true);
});

test('theatre mode is unavailable without a native control, while disabled or in fullscreen', () => {
    const f = fixture();
    const button = f.elements.get('ytot-theatre');
    f.api.renderTheatreControl();
    assert.equal(button.disabled, true);
    f.api.toggleTheatreMode();
    assert.match(f.elements.get('ytot-status').textContent, /unavailable/);
    const native = f.element('button');
    native.click = () => assert.fail('unavailable native control must not be clicked');
    f.player.querySelector = () => native;
    native.disabled = true;
    f.api.renderTheatreControl();
    assert.equal(button.disabled, true);
    f.api.toggleTheatreMode();
    native.disabled = false;
    f.document.fullscreenElement = {};
    f.api.renderTheatreControl();
    assert.equal(button.disabled, true);
    f.api.toggleTheatreMode();
    f.document.fullscreenElement = null;
    f.api.renderTheatreControl();
    assert.equal(button.disabled, false);
    assert.equal(f.calls.length, 0);
});

test('theatre mode keeps the same menu reachable above the player and restores its navigation parent', () => {
    const f = fixture();
    const parent = f.element('div'), nav = f.api.createNavButton(), native = f.element('button');
    parent.appendChild(nav);
    f.player.querySelector = () => native;
    let active = false;
    f.document.querySelector = () => active ? f.player : null;
    f.api.renderTheatreControl();
    assert.equal(nav.parentElement, parent);
    active = true;
    f.api.renderTheatreControl();
    assert.equal(nav.parentElement, f.document.body);
    assert.equal(nav.classes.has('ytot-nav-theatre'), true);
    assert.equal(f.attrs.has('data-ypft-theatre'), true);
    f.api.renderTheatreControl();
    active = false;
    f.api.renderTheatreControl();
    assert.equal(nav.parentElement, parent);
    assert.equal(nav.classes.has('ytot-nav-theatre'), false);
    assert.equal(f.attrs.has('data-ypft-theatre'), false);
    assert.equal(f.elements.get('ytot-nav-wrapper'), nav);
});

test('leaving theatre mode reacquires top navigation if Twitch replaced the original parent', () => {
    const f = fixture();
    const parent = f.element('div'), replacement = f.element('div'), nav = f.api.createNavButton(), native = f.element('button');
    parent.appendChild(nav);
    f.player.querySelector = () => native;
    f.document.querySelector = () => f.player;
    f.api.renderTheatreControl();
    assert.equal(nav.parentElement, f.document.body);
    parent.isConnected = false;
    f.document.querySelector = selector => selector.includes('top-nav__menu') ? replacement : null;
    f.api.renderTheatreControl();
    assert.equal(nav.parentElement, replacement);
    assert.equal(f.attrs.has('data-ypft-theatre'), false);
});

test('video URLs support shared, reordered, live, embed and Shorts links without accepting lookalike hosts', () => {
    const { extractVideoId } = fixture().api;
    for (const url of ['https://www.youtube.com/watch?si=share&v=abcdefghijk&t=30',
        ' youtu.be/abcdefghijk?si=share ', 'https://m.youtube.com/live/abcdefghijk/',
        'https://youtube.com/embed/abcdefghijk', 'https://youtube.com/shorts/abcdefghijk'])
        assert.equal(extractVideoId(url), 'abcdefghijk', url);
    for (const url of ['https://evil.example/youtube.com/watch?v=abcdefghijk',
        'https://youtube.com.evil.example/watch?v=abcdefghijk', 'https://youtube.com@evil.example/watch?v=abcdefghijk',
        'javascript:youtube.com/watch?v=abcdefghijk', 'https://youtu.be/abcdefghijkZ',
        'https://youtube.com/watch?v=short', null, {}])
        assert.equal(extractVideoId(url), null, String(url));
});

test('history escapes quoted metadata and ignores malformed stored entries', async () => {
    const f = fixture({ saved: { ytot_history: [null, { videoId: '" onmouseover="bad' },
        { videoId: 'abcdefghijk', title: '" autofocus onfocus="bad <&', channel: 'Creator' }] } });
    f.elements.get('ytot-dropdown').classes.add('visible');
    await f.api.renderHistory();
    const html = f.elements.get('ytot-history-section').innerHTML;
    assert.ok(html.includes('title="&quot; autofocus onfocus=&quot;bad &lt;&amp;"'));
    assert.doesNotMatch(html, /onmouseover/);
    assert.match(html, /<button type="button" class="ytot-history-play"/);
    assert.equal(f.api.escapeHtml(null), '');
});

test('concurrent history additions and pin changes preserve every entry', async () => {
    const f = fixture();
    await Promise.all([
        f.api.addToHistory('abcdefghijk', { title: 'First' }),
        f.api.addToHistory('zyxwvutsrqp', { title: 'Second' }),
        f.api.togglePin('abcdefghijk')
    ]);
    assert.equal(f.stored.ytot_history.length, 2);
    assert.equal(f.stored.ytot_history[0].videoId, 'abcdefghijk');
    assert.equal(f.stored.ytot_history[0].pinned, true);
});

test('closed menus release history rows without losing saved pins; a late read cannot rebuild closed UI', async () => {
    const f = fixture({ saved: { ytot_history: [{ videoId: 'abcdefghijk', title: 'Saved', pinned: true }] } });
    const container = f.elements.get('ytot-history-section'), dropdown = f.elements.get('ytot-dropdown');
    await f.api.renderHistory(); assert.equal(container.innerHTML, '');
    dropdown.classes.add('visible'); await f.api.renderHistory(); assert.match(container.innerHTML, /Saved/);
    f.api.closeDropdown(); assert.equal(container.innerHTML, '');
    dropdown.classes.add('visible');
    const pending = f.api.renderHistory(); f.api.closeDropdown(); await pending;
    assert.equal(container.innerHTML, '');
    assert.equal(f.stored.ytot_history[0].pinned, true);
    dropdown.classes.add('visible'); await f.api.renderHistory(); assert.match(container.innerHTML, /Saved/);
});

test('navigation and missing menu controls release references to replaced player and navigation nodes', () => {
    const f = fixture();
    f.api.updateToggleButton(false); f.api.renderTheatreControl();
    assert.ok(f.api.memory().ui > 0); assert.ok(f.api.memory().theatre > 0);
    f.window.location.pathname = '/other'; f.api.handleNavigation();
    assert.equal(f.api.memory().ui, 0); assert.equal(f.api.memory().theatre, 0);
    assert.ok(f.observers.every(observer => !observer.targets.includes(f.player)));
    f.api.renderTheatreControl(); f.elements.delete('ytot-theatre'); f.api.renderTheatreControl();
    assert.equal(f.api.memory().theatre, 0);
});

test('sync ignores duplicate clicks, resets speed, and cancels pending steps when playback changes', () => {
    const f = fixture();
    f.api.injectYouTube('abcdefghijk', { title: 'First' });
    const messages = [];
    f.elements.get('ytot-youtube-player').contentWindow = { postMessage: data => messages.push(JSON.parse(data)) };
    f.api.syncNow();
    f.api.syncNow();
    assert.equal(messages.length, 1);
    f.timers[f.api.state.syncTimeoutId - 1]();
    assert.deepEqual(messages.at(-1).args, [2]);
    f.timers[f.api.state.syncTimeoutId - 1]();
    assert.deepEqual(messages.at(-1).args, [1]);
    assert.equal(f.api.state.isSyncing, false);
    f.api.syncNow();
    const pending = f.api.state.syncTimeoutId;
    f.api.injectYouTube('zyxwvutsrqp', { title: 'Second' });
    assert.equal(f.timers[pending - 1], null);
    assert.equal(f.api.state.isSyncing, false);
    f.elements.get('ytot-youtube-player').contentWindow = { postMessage() {} };
    f.api.syncNow();
    const removal = f.api.state.syncTimeoutId;
    f.api.removeYouTube();
    assert.equal(f.timers[removal - 1], null);
});

test('late search results do not follow the user into a different Twitch channel', async () => {
    let resolve;
    const f = fixture({ sendMessage: () => new Promise(done => { resolve = done; }) });
    const search = f.api.handleAutoFind();
    assert.equal(f.elements.get('ytot-autofind').disabled, true);
    f.window.location.pathname = '/other';
    f.api.handleNavigation();
    const target = f.element('div');
    f.elements.set('ytot-search-result', target);
    resolve({ results: [{ videoId: 'abcdefghijk', title: 'Old channel', channel: 'channel' }] });
    await search;
    assert.equal(target.innerHTML, undefined);
});

test('search failures are distinct from no matches and leave retry available', async () => {
    const f = fixture({ sendMessage: async () => ({ error: 'YouTube returned HTTP 503' }) });
    await f.api.handleAutoFind();
    assert.match(f.elements.get('ytot-search-result').textContent, /503/);
    assert.equal(f.elements.get('ytot-autofind').disabled, false);
});

test('query and hash changes preserve active playback; directory pages are not channels', () => {
    const f = fixture();
    f.api.injectYouTube('abcdefghijk', { title: 'First' });
    f.location.href = 'https://www.twitch.tv/channel?ref=test#chat';
    f.api.handleNavigation();
    assert.equal(f.api.state.youtubeVideoId, 'abcdefghijk');
    for (const pathname of ['/directory', '/videos/1234', '/channel/videos', '/settings']) {
        f.window.location.pathname = pathname;
        assert.equal(f.api.getTwitchChannel(), null);
    }
    f.api.handleNavigation();
    assert.equal(f.api.state.youtubeVideoId, null);
});

test('a setting changed while initialization loads is not overwritten by stored preferences', async () => {
    const f = fixture({ saved: { ytot_autosync: true, ytot_force_highest: true } });
    f.document.querySelector = selector => selector.includes('top-nav__menu') ? f.document.body : null;
    const init = f.api.init();
    f.api.setupSettingsListeners();
    f.elements.get('ytot-autosync').onchange({ target: { checked: false } });
    await init;
    assert.equal(f.api.state.autoSyncEnabled, false);
    assert.equal(f.elements.get('ytot-autosync').checked, false);
    assert.equal(f.api.state.forceHighestQuality, true);
});
