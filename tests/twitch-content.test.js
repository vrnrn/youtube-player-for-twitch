const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const original = fs.readFileSync(`${__dirname}/../twitch-content.js`, 'utf8');
const source = original.replace(/\}\)\(\);\s*$/, 'window.testContent = { state, changeVaftSetting, renderVaftSetting, injectYouTube, removeYouTube, syncNow, enforceQuality, createNavButton, applyExtensionVisibility, setupChatControls, renderChatControls, renderTheatreControl, toggleTheatreMode };\n})();');
function fixture({ enabled = false, failure = null, running = null, saved = {} } = {}) {
    const elements = new Map(), calls = [], timers = [], stored = { ...saved }, attrs = new Map(), storageListeners = [], observers = [];
    const element = tag => ({ tag, id: '', style: {}, dataset: {}, children: [], attributes: new Map(), classes: new Set(), isConnected: true,
        get classList() { return { add: name => this.classes.add(name), remove: name => this.classes.delete(name),
            toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) }; },
        appendChild(child) {
            if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child);
            this.children.push(child); child.parentElement = this; elements.set(child.id, child);
        },
        remove() { this.removed = true; elements.delete(this.id); },
        setAttribute(key, value) { this.attributes.set(key, value); }, getAttribute(key) { return this.attributes.get(key) ?? null; },
        querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }
    });
    for (const id of ['ytot-vaft', 'ytot-vaft-status', 'ytot-vaft-reload', 'ytot-status', 'ytot-history-section', 'ytot-toggle', 'ytot-restore', 'ytot-sync-now', 'ytot-actions', 'ytot-hide-extensions', 'ytot-chat-toggle', 'ytot-chat-settings', 'ytot-chat-mode', 'ytot-chat-opacity', 'ytot-chat-font', 'ytot-chat-color', 'ytot-chat-compact', 'ytot-chat-through', 'ytot-chat-reset', 'ytot-theatre', 'ytot-theatre-label']) elements.set(id, element('div'));
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
        setTimeout(fn) { timers.push(fn); return timers.length; }, setInterval() { return 1; }, clearInterval() {},
        console: { log() {}, error() {} }
    });
    vm.runInContext(source, context);
    return { api: context.window.testContent, document, player, element, elements, calls, timers, stored, local, attrs, storageListeners, observers, window: context.window };
}
test('menu explains opt-in reload and uses interruption-blocking terminology', () => {
    const f = fixture();
    const menu = f.api.createNavButton().innerHTML;
    assert.match(menu, /Interruption blocking/);
    assert.match(menu, /ytot-badge">Experimental/);
    assert.match(menu, /Reload Twitch to apply/);
    assert.match(menu, /id="ytot-vaft" disabled/);
    assert.doesNotMatch(menu, /ad blocking/i);
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

test('additional settings is a collapsed native disclosure grouping every optional feature', () => {
    const menu = fixture().api.createNavButton().innerHTML;
    const start = menu.indexOf('<details class="ytot-additional-settings"');
    const end = menu.indexOf('<!-- Actions -->');
    assert.ok(start > 0 && end > start);
    assert.doesNotMatch(menu.slice(start, menu.indexOf('>', start)), /\bopen\b/);
    const settings = menu.slice(start, end);
    for (const id of ['ytot-autosync', 'ytot-quality', 'ytot-chat-toggle', 'ytot-hide-extensions', 'ytot-vaft'])
        assert.ok(settings.includes('id="' + id + '"'), id);
    assert.match(settings, /Additional settings/);
    assert.equal((settings.match(/class="ytot-settings-group"/g) || []).length, 3);
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

test('chat appearance follows enablement and collapses when turned off through the menu', () => {
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
    appearance.open = true;
    f.api.setupChatControls();
    assert.equal(appearance.hidden, true);
    assert.equal(appearance.open, false);
    const toggle = f.elements.get('ytot-chat-toggle');
    toggle.onchange({ target: { checked: true } });
    assert.equal(appearance.hidden, false);
    appearance.open = true;
    f.elements.get('ytot-chat-opacity').onchange({ target: { value: '35' } });
    assert.equal(settings.opacity, 35);
    assert.equal(appearance.open, true);
    toggle.onchange({ target: { checked: false } });
    assert.equal(appearance.hidden, true);
    assert.equal(appearance.open, false);
    assert.equal(settings.opacity, 35);
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
