const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { Node } = require('./helpers/chat-fixture.cjs');
const source = fs.readFileSync(`${__dirname}/../kick-support.js`, 'utf8');
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

class Element extends Node {
    constructor(tag) {
        super(tag); this.dataset = {};
        this.classList.add = name => this.classes.add(name);
        this.classList.remove = name => this.classes.delete(name);
    }
    matches(selector) {
        const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        if (attribute) return attribute[2] === undefined ? this.attrs.has(attribute[1]) : this.getAttribute(attribute[1]) === attribute[2];
        if (selector.startsWith('#')) return this.id === selector.slice(1);
        if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
        return this.tagName === selector.toUpperCase();
    }
    get isConnected() { return this.tagName === 'BODY' || this.parentElement?.isConnected === true; }
    get firstChild() { return this.childNodes[0] || null; }
    set innerHTML(html) {
        this.replaceChildren();
        const stack = [this];
        for (const match of html.matchAll(/<(\/?)([\w-]+)([^>]*)>/g)) {
            if (match[1]) { stack.pop(); continue; }
            const element = new Element(match[2]);
            for (const attr of match[3].matchAll(/([\w-]+)="([^"]*)"/g)) {
                if (attr[1] === 'id') element.id = attr[2];
                else if (attr[1] === 'class') element.className = attr[2];
                else element.setAttribute(attr[1], attr[2]);
            }
            stack.at(-1).appendChild(element);
            if (!['input', 'br'].includes(match[2])) stack.push(element);
        }
    }
    focus() { this.focused = true; }
}
function fixture({ saved = {}, url = 'https://www.twitch.tv/creator', response = { live: true, viewers: 120 }, readHook = null, followed = true } = {}) {
    const body = new Element('body'), main = new Element('main'), sidebar = new Element('nav'), nativeChat = new Element('aside');
    sidebar.id = 'side-nav'; nativeChat.id = 'live-page-chat'; body.append(main, sidebar, nativeChat);
    const nativeSection = new Element('section'), nativeList = new Element('div'), twitchLink = new Element('a');
    nativeSection.className = 'side-nav-section'; nativeSection.setAttribute('aria-label', 'Followed Channels');
    nativeList.className = 'tw-transition-group'; twitchLink.setAttribute('data-test-selector', 'followed-channel');
    twitchLink.textContent = 'Twitch creator'; nativeList.appendChild(twitchLink); nativeSection.appendChild(nativeList);
    if (followed) sidebar.appendChild(nativeSection);
    const stored = { ...saved }, changes = [], requests = [], calls = [];
    let now = 1000000;
    let location = new URL(url);
    location.assign = href => calls.push({ navigate: href });
    const document = { body, visibilityState: 'visible', createElement: tag => new Element(tag),
        getElementById: id => body.querySelector(`#${id}`), querySelector: selector => body.querySelector(selector) };
    const playback = { container: () => main, snapshot: () => ({ paused: false, muted: false, volume: 0.35 }),
        own(wrapper, restored, provider, target) { calls.push({ own: wrapper, restored, provider, target }); }, release(options) { calls.push({ release: options }); } };
    const context = vm.createContext({ window: { __ypftPlayback: playback }, document, URL, location, Date: class extends Date { static now() { return now; } },
        history: { replaceState(state, title, href) { const next = new URL(href); location.pathname = next.pathname; location.search = next.search; } },
        chrome: { storage: { local: {
            async get(key) { if (readHook) { const result = readHook(key); if (result) return result; } return { [key]: stored[key] }; },
            async set(values) { Object.assign(stored, values); for (const [key, value] of Object.entries(values)) for (const listener of changes) listener({ [key]: { newValue: value } }, 'local'); }
        }, onChanged: { addListener(fn) { changes.push(fn); } } }, runtime: {
            async sendMessage(message) { requests.push(message); return typeof response === 'function' ? response(message) : response; }
        } } });
    vm.runInContext(source, context);
    const api = context.window.__ypftKick;
    api.connect({ beforePlay() { calls.push('before'); }, changed() {} });
    const settings = () => {
        for (const id of ['ytot-kick-enabled', 'ytot-kick-options', 'ytot-kick-chat-enabled', 'ytot-kick-pins', 'ytot-kick-pin-form', 'ytot-kick-channel', 'ytot-kick-status', 'ytot-kick-pin']) {
            const control = new Element('div'); control.id = id; body.appendChild(control);
        }
        api.setupSettings();
    };
    return { api, document, body, main, sidebar, nativeSection, nativeList, twitchLink, nativeChat, stored, requests, calls, playback, location, settings,
        advance(ms) { now += ms; },
        external(value) { stored.ytot_kick_settings = value; changes.forEach(fn => fn({ ytot_kick_settings: { newValue: value } }, 'local')); },
        navigate(href) { const next = new URL(href, location); location.pathname = next.pathname; location.search = next.search; api.sync(); } };
}
test('Kick is off by default and strict channel parsing rejects lookalike hosts, paths and reserved routes', async () => {
    const f = fixture(); await flush(); f.api.sync();
    assert.equal(f.api.enabled(), false); assert.equal(f.api.play('creator'), false); assert.equal(f.requests.length, 0);
    assert.equal(f.body.querySelectorAll('iframe').length, 0);
    for (const value of ['Creator_1', 'https://kick.com/creator_1/', 'kick.com/creator_1?source=share', 'https://www.kick.com/creator_1'])
        assert.equal(f.api.parseChannel(value), 'creator_1');
    for (const value of [null, '', 'http://kick.com/creator', 'https://kick.com.evil.test/creator', 'https://evil.test',
        'https://kick.com@evil.test/creator', 'https://kick.com:444/creator', 'https://kick.com/creator/videos', 'https://kick.com/%22evil',
        'directory', 'popout', 'a'.repeat(26)]) assert.equal(f.api.parseChannel(value), null, String(value));
    assert.equal(f.api.normalize({ channels: Array.from({ length: 50 }, (_, i) => `user${i}`) }).channels.length, 30);
    assert.deepEqual(Array.from(f.api.normalize({ channels: ['Creator', 'creator', null, 'search'] }).channels), ['creator']);
});
test('settings enable Kick, pin channels, reject duplicates, unpin and preserve pins when disabled', async () => {
    const f = fixture(); await flush(); f.settings();
    const get = id => f.document.getElementById(id);
    get('ytot-kick-enabled').onchange({ target: { checked: true } }); await flush();
    assert.equal(f.api.enabled(), true); assert.equal(f.stored.ytot_kick_settings.enabled, true);
    get('ytot-kick-channel').value = 'https://kick.com/creator';
    get('ytot-kick-pin-form').onsubmit({ preventDefault() {} }); await flush();
    assert.deepEqual(Array.from(f.stored.ytot_kick_settings.channels), ['creator']);
    assert.match(get('ytot-kick-sidebar').querySelector('a').getAttribute('aria-label'), /Live · 120 viewers/);
    get('ytot-kick-channel').value = 'creator'; get('ytot-kick-pin-form').onsubmit({ preventDefault() {} }); await flush();
    assert.match(get('ytot-kick-status').textContent, /already pinned/);
    get('ytot-kick-enabled').onchange({ target: { checked: false } }); await flush();
    assert.equal(f.document.getElementById('ytot-kick-sidebar'), null);
    assert.deepEqual(Array.from(f.stored.ytot_kick_settings.channels), ['creator']);
    get('ytot-kick-enabled').onchange({ target: { checked: true } }); await flush();
    get('ytot-kick-pins').querySelector('button').onclick(); await flush();
    assert.equal(f.stored.ytot_kick_settings.channels.length, 0);
});
test('substituted Kick owns playback, persists the original intent, switches chats and cleans up', async () => {
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true } } }); await flush();
    assert.equal(f.api.play('creator'), true);
    const frame = f.document.getElementById('ytot-kick-player');
    assert.equal(frame.src, 'https://player.kick.com/creator?autoplay=true');
    assert.equal(f.calls.find(call => call.own).provider, 'kick');
    assert.equal(f.stored.ytot_kick_active_creator.channel, 'creator');
    assert.equal(f.stored.ytot_kick_active_creator.playback.volume, 0.35);
    const chat = f.document.getElementById('ytot-kick-chat');
    assert.equal(chat.querySelector('iframe').src, 'https://kick.com/popout/creator/chat');
    chat.querySelector('button').onclick(); assert.equal(f.nativeChat.getAttribute('data-ypft-kick-chat'), 'twitch');
    chat.querySelector('button').onclick(); assert.equal(f.nativeChat.getAttribute('data-ypft-kick-chat'), 'kick');
    f.api.restore(); assert.equal(f.api.active(), null); assert.equal(f.stored.ytot_kick_active_creator, null);
    assert.equal(f.document.getElementById('ytot-youtube-wrapper'), null);
    assert.equal(f.document.getElementById('ytot-kick-chat'), null);
    assert.equal(f.nativeChat.getAttribute('data-ypft-kick-chat'), null);
});
test('Kick reload restoration and navigation preserve saved state without leaking the old stream', async () => {
    const saved = { ytot_kick_settings: { enabled: true }, ytot_kick_active_creator: { channel: 'other', playback: { paused: true, muted: true, volume: 0.2 } } };
    const f = fixture({ saved }); await flush();
    assert.equal(f.api.active(), 'other'); assert.equal(f.calls.find(call => call.own).restored.volume, 0.2);
    f.navigate('/directory'); await flush();
    assert.equal(f.api.active(), null); assert.equal(f.document.getElementById('ytot-kick-chat'), null);
    assert.equal(f.stored.ytot_kick_active_creator.channel, 'other');
    assert.ok(f.calls.some(call => call.release?.navigation));
});
test('pseudo channels mount without a Twitch channel, stay stable, honor chat setting and release on disable', async () => {
    const f = fixture({ url: 'https://www.twitch.tv/directory?ypft-kick=creator', saved: { ytot_kick_settings: { enabled: true, channels: ['creator'] } } });
    await flush(); assert.equal(f.api.active(), 'creator');
    const page = f.document.getElementById('ytot-kick-page'), frame = f.document.getElementById('ytot-kick-player');
    assert.equal(page.querySelector('h1').textContent, 'creator');
    assert.ok(f.calls.find(call => call.own).target.classList.contains('ytot-kick-video-slot'));
    for (let i = 0; i < 20; i++) f.api.sync();
    assert.equal(f.document.getElementById('ytot-kick-player'), frame); assert.equal(f.requests.length, 1);
    f.external({ enabled: true, showChat: false, channels: ['creator'] });
    assert.equal(f.document.getElementById('ytot-kick-chat'), null); assert.ok(page.classList.contains('ytot-kick-no-chat'));
    f.api.restore(); f.api.sync();
    assert.equal(f.location.search.includes('ypft-kick'), false); assert.equal(f.api.active(), null);
    f.navigate('/directory?ypft-kick=creator');
    assert.equal(f.api.active(), 'creator');
    f.external({ enabled: false, channels: ['creator'] });
    assert.equal(f.api.active(), null); assert.equal(f.document.getElementById('ytot-kick-page'), null);
    assert.equal(f.main.classList.contains('ytot-kick-page-host'), false);
});
test('unknown Kick status is never presented as live and hidden tabs do not fetch', async () => {
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true, channels: ['creator'] } }, response: { error: 'blocked' } });
    f.document.visibilityState = 'hidden'; await flush(); assert.equal(f.requests.length, 0);
    f.document.visibilityState = 'visible'; f.api.sync(); await flush();
    assert.equal(f.document.getElementById('ytot-kick-sidebar'), null);
    assert.equal(f.document.getElementById('ytot-kick-followed'), null);
    assert.equal(f.twitchLink.parentElement, f.nativeList);
});
test('only confirmed live Kick pins join Twitch followed channels without adding another heading', async () => {
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true, channels: ['live', 'offline', 'unknown'] } },
        response: ({ channel }) => channel === 'unknown' ? { error: 'unavailable' } : { live: channel === 'live', viewers: 56 } });
    await flush();
    const rows = f.document.getElementById('ytot-kick-sidebar');
    assert.equal(rows.parentElement, f.nativeList);
    assert.equal(f.nativeList.children[0], rows);
    assert.equal(rows.querySelectorAll('a').length, 1);
    assert.match(rows.querySelector('a').getAttribute('aria-label'), /live · Kick · Live · 56 viewers/);
    assert.equal(rows.querySelector('h3'), null);
    assert.equal(rows.querySelector('a').href, '/directory?ypft-kick=live');
    assert.equal(f.twitchLink.parentElement, f.nativeList);
    assert.deepEqual(Array.from(f.stored.ytot_kick_settings.channels), ['live', 'offline', 'unknown']);
    // The stable card marker also locates a translated followed-channel group.
    f.nativeSection.setAttribute('aria-label', 'Gefolgte Kanäle');
    f.api.sync(); assert.equal(rows.parentElement, f.nativeList);
});
test('live status refreshes after ten minutes and removes offline or failed pins until confirmed live again', async () => {
    let response = { live: true, viewers: 120 };
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true, channels: ['creator'] } }, response: () => response });
    await flush(); assert.equal(f.requests.length, 1);
    const row = f.document.getElementById('ytot-kick-sidebar');
    f.advance(10 * 60 * 1000 - 1); f.api.sync(); await flush();
    assert.equal(f.requests.length, 1); assert.equal(f.document.getElementById('ytot-kick-sidebar'), row);
    response = { live: false }; f.advance(1); f.api.sync(); await flush();
    assert.equal(f.requests.length, 2); assert.equal(f.document.getElementById('ytot-kick-sidebar'), null);
    response = { error: 'blocked' }; f.advance(10 * 60 * 1000); f.api.sync(); await flush();
    assert.equal(f.requests.length, 3); assert.equal(f.document.getElementById('ytot-kick-sidebar'), null);
    f.advance(9 * 60 * 1000); f.api.sync(); await flush(); assert.equal(f.requests.length, 3);
    response = { live: true, viewers: 34 }; f.advance(60 * 1000); f.api.sync(); await flush();
    assert.equal(f.requests.length, 4); assert.match(f.document.getElementById('ytot-kick-sidebar').querySelector('a').getAttribute('aria-label'), /34 viewers/);
});
test('Kick avatars load from the channel metadata, fall back after failure and refresh without extra status checks', async () => {
    let avatar = 'https://files.kick.com/images/user/123/avatar.webp';
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true, channels: ['creator'] } }, response: () => ({ live: true, viewers: 3387, avatar }) });
    await flush();
    let row = f.document.getElementById('ytot-kick-sidebar');
    const image = row.querySelector('img');
    assert.equal(image.src, avatar); assert.equal(image.referrerPolicy, 'no-referrer'); assert.equal(image.alt, '');
    assert.equal(row.querySelector('.ytot-kick-viewers').textContent, '3.4K');
    assert.match(row.querySelector('a').getAttribute('aria-label'), /3,387 viewers/);
    image.onerror(); assert.equal(row.querySelector('img'), null);
    assert.equal(row.querySelector('.ytot-kick-avatar').textContent, 'CR');
    f.api.sync(); assert.equal(f.requests.length, 1);
    avatar = 'https://files.kick.com/images/user/123/new.webp'; f.advance(600000); f.api.sync(); await flush();
    row = f.document.getElementById('ytot-kick-sidebar'); assert.equal(row.querySelector('img').src, avatar);
    avatar = 'https://example.test/tracker.png'; f.advance(600000); f.api.sync(); await flush();
    assert.equal(f.document.getElementById('ytot-kick-sidebar').querySelector('img'), null);
});
test('new pins get an initial check without rechecking existing pins before their ten-minute interval', async () => {
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true, channels: ['creator'] } } });
    await flush(); f.advance(60000);
    f.external({ enabled: true, channels: ['creator', 'new'] }); await flush();
    assert.deepEqual(f.requests.map(message => message.channel), ['creator', 'new']);
    f.document.visibilityState = 'hidden'; f.advance(10 * 60 * 1000); f.api.sync(); await flush();
    assert.equal(f.requests.length, 2);
    f.document.visibilityState = 'visible'; f.api.sync(); await flush(); assert.equal(f.requests.length, 4);
});
test('Kick rows follow native list replacement and disabling removes only extension rows', async () => {
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true, channels: ['creator'] } } }); await flush();
    const replacement = new Element('div'); replacement.className = 'tw-transition-group';
    f.nativeList.remove(); f.nativeSection.appendChild(replacement); f.api.sync();
    assert.equal(f.document.getElementById('ytot-kick-sidebar').parentElement, replacement);
    assert.equal(f.requests.length, 1);
    f.external({ enabled: false, channels: ['creator'] });
    assert.equal(f.nativeSection.parentElement, f.sidebar); assert.equal(replacement.parentElement, f.nativeSection);
    assert.equal(f.document.getElementById('ytot-kick-sidebar'), null);
});
test('without a native followed group, live pins occupy its slot and merge when Twitch mounts it', async () => {
    let live = true;
    const f = fixture({ followed: false, saved: { ytot_kick_settings: { enabled: true, channels: ['creator'] } }, response: () => ({ live }) });
    const recommended = new Element('section'); recommended.className = 'side-nav-section';
    recommended.setAttribute('aria-label', 'Recommended Channels'); f.sidebar.appendChild(recommended);
    await flush();
    const fallback = f.document.getElementById('ytot-kick-followed');
    assert.equal(fallback.querySelector('h3').textContent, 'Followed Channels');
    assert.equal(fallback.children[0].tagName, 'H3');
    assert.equal(f.document.getElementById('ytot-kick-sidebar').parentElement, fallback.querySelector('.tw-transition-group'));
    assert.equal(f.sidebar.children[0], fallback); assert.equal(f.sidebar.children[1], recommended);
    f.sidebar.insertBefore(f.nativeSection, fallback); f.api.sync();
    assert.equal(f.document.getElementById('ytot-kick-followed'), null);
    assert.equal(f.document.getElementById('ytot-kick-sidebar').parentElement, f.nativeList);
    live = false; f.advance(10 * 60 * 1000); f.api.sync(); await flush();
    assert.equal(f.document.getElementById('ytot-kick-sidebar'), null);
    assert.equal(recommended.parentElement, f.sidebar);
});
test('late saved-stream reads cannot overwrite a newer manual selection or restart after disabling', async () => {
    let resolve;
    const delayed = new Promise(done => { resolve = done; });
    const f = fixture({ saved: { ytot_kick_settings: { enabled: true } }, readHook: key => key.startsWith('ytot_kick_active_') ? delayed : null });
    await flush(); f.api.play('new');
    resolve({ ytot_kick_active_creator: { channel: 'old' } }); await flush();
    assert.equal(f.api.active(), 'new');
    f.external({ enabled: false }); await flush(); assert.equal(f.api.active(), null);
});
