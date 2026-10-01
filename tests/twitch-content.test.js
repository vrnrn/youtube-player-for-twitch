const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const original = fs.readFileSync(`${__dirname}/../twitch-content.js`, 'utf8');
const source = original.replace(/\}\)\(\);\s*$/, 'window.testContent = { state, changeVaftSetting, renderVaftSetting, injectYouTube, removeYouTube, syncNow, enforceQuality, createNavButton, applyExtensionVisibility };\n})();');
function fixture({ enabled = false, failure = null, running = null, saved = {} } = {}) {
    const elements = new Map(), calls = [], timers = [], stored = { ...saved }, attrs = new Map(), storageListeners = [];
    const element = tag => ({ tag, id: '', style: {}, dataset: {}, children: [], classList: { add() {}, remove() {}, toggle() {} },
        appendChild(child) { this.children.push(child); elements.set(child.id, child); },
        remove() { this.removed = true; elements.delete(this.id); },
        setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }
    });
    for (const id of ['ytot-vaft', 'ytot-vaft-status', 'ytot-vaft-reload', 'ytot-status', 'ytot-history-section', 'ytot-toggle', 'ytot-restore', 'ytot-sync-now', 'ytot-hide-extensions']) elements.set(id, element('div'));
    if (running) attrs.set('data-ypft-vaft', running);
    const document = {
        body: element('body'), head: null,
        documentElement: { getAttribute: k => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k) },
        createElement: element, getElementById: id => elements.get(id), querySelector() { return null; }, addEventListener() {}
    };
    const local = new Map([['video-quality', '{"default":"160p30","other":"kept"}']]);
    const playback = { container: () => ({}), own(wrapper, restored) { calls.push({ own: wrapper, restored }); },
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
        document, MutationObserver: class { observe() {} },
        setTimeout(fn) { timers.push(fn); return timers.length; }, setInterval() { return 1; }, clearInterval() {},
        console: { log() {}, error() {} }
    });
    vm.runInContext(source, context);
    return { api: context.window.testContent, document, elements, calls, timers, stored, local, attrs, storageListeners };
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
    const messages = [];
    iframe.contentWindow = { postMessage(data, origin) { messages.push({ data: JSON.parse(data), origin }); } };
    f.api.syncNow();
    assert.equal(messages[0].origin, 'https://www.youtube.com');
    assert.equal(messages[0].data.func, 'seekTo');
    f.api.removeYouTube();
    assert.equal(wrapper.removed, true);
    assert.equal(f.calls.find(c => c.release)?.release.navigation, false);
    assert.equal(f.api.state.youtubeVideoId, null);
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
