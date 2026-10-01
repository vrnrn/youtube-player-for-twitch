const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../twitch-chat.js', 'utf8');
class Node {
    constructor(tag = 'DIV', text = '') {
        this.tagName = tag.toUpperCase(); this.nodeType = tag === '#text' ? 3 : 1;
        this.textContent = text; this.childNodes = []; this.style = {}; this.attrs = new Map();
        this.classes = new Set(); this.classList = { toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
        this.scrollTop = 0; this.clientHeight = 200; this.connected = true;
    }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get parentElement() { return this.parentNode || null; }
    get isConnected() { return this.connected && (!this.parentNode || this.parentNode.isConnected); }
    get scrollHeight() { return this.childNodes.length * 24; }
    append(...nodes) { nodes.forEach(n => this.appendChild(n)); }
    appendChild(node) {
        if (node.tagName === '#FRAGMENT') { [...node.childNodes].forEach(n => this.appendChild(n)); return; }
        node.remove(); node.parentNode = this; this.childNodes.push(node); return node;
    }
    insertBefore(node, before) { node.remove(); node.parentNode = this; const i = this.childNodes.indexOf(before); this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, node); }
    remove() { if (this.parentNode) { const p = this.parentNode; p.childNodes = p.childNodes.filter(n => n !== this); this.parentNode = null; } }
    replaceWith(node) { const p = this.parentNode; const i = p.childNodes.indexOf(this); this.parentNode = null; p.childNodes[i] = node; node.parentNode = p; }
    replaceChildren(...nodes) { this.childNodes.forEach(n => { n.parentNode = null; }); this.childNodes = []; this.append(...nodes); }
    contains(node) { return this === node || this.childNodes.some(n => n.contains(node)); }
    setAttribute(key, value) { this.attrs.set(key, String(value)); }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    removeAttribute(key) { this.attrs.delete(key); }
    querySelectorAll(selector) {
        const matches = n => selector.includes('chat-line-message') && !selector.includes('-body') ? n.kind === 'line' :
            selector.includes('chat-message-username') ? n.kind === 'name' :
            selector.includes('chat-line-message-body') ? n.kind === 'body' :
            selector === 'img.chat-badge' ? n.className === 'chat-badge' : false;
        const all = [];
        const visit = n => { for (const child of n.childNodes) { if (matches(child)) all.push(child); visit(child); } };
        visit(this); return all;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { for (let n = this; n; n = n.parentNode) if (selector === 'button' ? n.tagName === 'BUTTON' : n.kind === 'line') return n; return null; }
    getBoundingClientRect() { return this.rect || { left: 20, top: 60, width: 1000, height: 600 }; }
    async requestFullscreen() { this.doc.fullscreenElement = this; }
    setPointerCapture() {}
    hasPointerCapture() { return false; }
}
function fixture({ saved = {}, path = '/valkyrae', youtube = false } = {}) {
    const observers = [], resizeObservers = [], timers = new Map(), frames = new Map(), events = new Map(), writes = [];
    const body = new Node('BODY'), player = new Node(); player.doc = null;
    let feed = new Node(), host = player;
    const iframe = youtube ? new Node('IFRAME') : null;
    if (iframe) { iframe.id = 'ytot-youtube-player'; iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media'); iframe.setAttribute('allowfullscreen', 'true'); player.appendChild(iframe); }
    const document = { body, visibilityState: 'visible', fullscreenElement: null,
        createElement: tag => new Node(tag), createTextNode: text => new Node('#text', text),
        createElementNS: (namespace, tag) => new Node(tag),
        createDocumentFragment: () => new Node('#fragment'),
        querySelector: selector => selector.includes('message-container') ? feed : host,
        getElementById: id => id === 'ytot-youtube-player' ? iframe : id === 'ytot-youtube-wrapper' && youtube ? host : null,
        addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type),
        dispatchEvent() {}, async exitFullscreen() { document.fullscreenElement = null; }
    };
    player.doc = document; body.append(player, feed);
    let storageChange;
    const context = vm.createContext({ document, location: { pathname: path }, URL, CustomEvent: class {},
        window: { addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type) },
        chrome: { storage: { local: { get(keys, cb) { cb({ ytot_chat: saved }); }, set(data) { writes.push(data); return Promise.resolve(); } },
            onChanged: { addListener(fn) { storageChange = fn; } } } },
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(node) { this.node = node; this.active = true; } disconnect() { this.active = false; } },
        ResizeObserver: class { constructor(fn) { this.fn = fn; resizeObservers.push(this); } observe() { this.active = true; } disconnect() { this.active = false; } },
        setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
        requestAnimationFrame(fn) { const id = frames.size + 1; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); }
    });
    vm.runInContext(source, context);
    const getClass = name => {
        let result;
        const visit = node => { if (node.className === name) result = node; node.children.forEach(visit); };
        visit(body); return result;
    };
    return { api: context.window.__ypftChat, context, document, events, observers, resizeObservers, writes, timers, frames, iframe,
        get feed() { return feed; }, get host() { return host; }, getClass,
        addLine(text = 'hello', name = 'Viewer') {
            const line = new Node(); line.kind = 'line';
            const author = new Node('SPAN', name); author.kind = 'name'; author.style.color = 'rgb(100, 200, 255)';
            const message = new Node('SPAN'); message.kind = 'body'; message.appendChild(new Node('#text', text));
            line.append(author, message); feed.appendChild(line); return { line, message, author };
        },
        flush(records = []) {
            observers.filter(o => o.active).forEach(o => o.fn(records));
            const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn());
        },
        resize() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
        changePath(value) { context.location.pathname = value; },
        replaceFeed() { feed.connected = false; feed.remove(); feed = new Node(); body.appendChild(feed); },
        replaceHost() { host.remove(); host = new Node(); host.doc = document; body.appendChild(host); },
        external(value) { storageChange({ ytot_chat: { newValue: value } }, 'local'); }
    };
}
test('floating chat is idle by default, settings are validated, and enablement has no new network client', () => {
    const f = fixture();
    assert.equal(f.observers.length, 0); assert.equal(f.resizeObservers.length, 0);
    assert.equal(f.events.size, 0); assert.equal(f.timers.size, 0);
    const s = f.api.normalize({ enabled: 'yes', opacity: -10, width: Infinity, height: 5, color: 'url(evil)', x: NaN });
    assert.equal(s.enabled, false); assert.equal(s.opacity, 0); assert.equal(s.height, 0.9); assert.equal(s.color, '#18151f');
    assert.equal(f.api.normalize(null).enabled, false);
    // The test environment has no fetch or WebSocket; both rendering and enablement must work without them.
    f.api.configure({ enabled: true, fullscreenOnly: false }, true);
    assert.equal(f.writes.length, 1);
    assert.ok(f.getClass('ytot-chat-panel')); assert.equal(f.getClass('ytot-chat-panel').hidden, false);
});
test('native messages are bounded, sanitized, reused and updated for moderation', () => {
    const f = fixture();
    for (let i = 0; i < 500; i++) f.addLine('message ' + i);
    const last = f.addLine('<img onerror=evil>');
    const good = new Node('IMG'); good.setAttribute('src', 'https://static-cdn.jtvnw.net/emotes/test/1'); good.alt = 'Kappa';
    const bad = new Node('IMG'); bad.setAttribute('src', 'javascript:alert(1)');
    const script = new Node('SCRIPT'); script.appendChild(new Node('#text', 'evil script'));
    last.message.append(good, bad, script);
    f.api.configure({ enabled: true, fullscreenOnly: false });
    const list = f.getClass('ytot-chat-messages');
    assert.equal(list.children.length, 60);
    const row = list.children.at(-1);
    assert.equal(row.children.filter(n => n.tagName === 'IMG').length, 1);
    assert.ok(row.childNodes.some(n => n.textContent === '<img onerror=evil>'));
    assert.ok(!row.childNodes.some(n => n.textContent === 'evil script'));
    const first = list.children[0];
    const retained = list.children[1];
    f.addLine('new');
    f.flush();
    assert.equal(list.children.length, 60);
    assert.equal(list.children[0], retained);
    assert.ok(!list.children.includes(first));
    last.message.replaceChildren(new Node('#text', 'Message deleted'));
    f.flush([{ target: last.message }]);
    assert.ok(list.children.at(-2).childNodes.some(n => n.textContent === 'Message deleted'));
});
test('fullscreen and background visibility gate observation; disabling cleans timers and permissions', () => {
    const f = fixture({ youtube: true });
    f.addLine();
    f.api.configure({ enabled: true });
    assert.equal(f.observers.filter(o => o.active).length, 0);
    assert.ok(!f.iframe.getAttribute('allow').includes('fullscreen'));
    assert.equal(f.iframe.getAttribute('allowfullscreen'), null);
    const sameIframe = f.iframe;
    f.document.fullscreenElement = f.host; f.api.sync();
    assert.equal(f.observers.filter(o => o.active).length, 1);
    assert.equal(f.getClass('ytot-chat-panel').hidden, false);
    assert.equal(f.iframe, sameIframe); assert.ok(f.host.contains(f.iframe));
    f.flush([{ target: f.feed }]);
    f.document.visibilityState = 'hidden'; f.api.sync();
    assert.equal(f.observers.filter(o => o.active).length, 0);
    assert.equal(f.timers.size, 0);
    f.document.visibilityState = 'visible'; f.api.sync();
    assert.equal(f.observers.filter(o => o.active).length, 1);
    f.api.configure({ enabled: false });
    assert.equal(f.observers.filter(o => o.active).length, 0);
    assert.equal(f.resizeObservers.filter(o => o.active).length, 0);
    assert.equal(f.events.size, 0);
    assert.equal(f.iframe.getAttribute('allow'), 'autoplay; fullscreen; encrypted-media');
    assert.equal(f.iframe.getAttribute('allowfullscreen'), 'true');
});
test('SPA, feed replacement and player replacement detach stale sources and reacquire without cloning the player', () => {
    const f = fixture({ saved: { enabled: true, fullscreenOnly: false } });
    f.addLine('old'); f.flush();
    f.replaceFeed(); f.addLine('new'); f.replaceHost(); f.api.sync();
    assert.equal(f.getClass('ytot-chat-messages').children.length, 1);
    assert.equal(f.observers.filter(o => o.active).length, 1);
    assert.equal(f.resizeObservers.filter(o => o.active).length, 1);
    f.changePath('/directory'); f.api.sync();
    assert.equal(f.getClass('ytot-chat-panel'), undefined);
    assert.equal(f.observers.filter(o => o.active).length, 0);
    f.changePath('/another_channel'); f.api.sync();
    assert.ok(f.getClass('ytot-chat-panel'));
    f.external({ enabled: false });
    assert.equal(f.getClass('ytot-chat-panel'), undefined);
});
test('geometry remains within the player and keyboard movement persists normalized position', () => {
    const f = fixture({ saved: { enabled: true, fullscreenOnly: false, width: 600 } });
    f.host.rect = { left: 10, top: 20, width: 250, height: 140 }; f.api.sync();
    const panel = f.getClass('ytot-chat-panel');
    assert.equal(parseFloat(panel.style.width), 234); assert.equal(parseFloat(panel.style.height), 120);
    const grip = f.getClass('ytot-chat-grip');
    grip.onkeydown({ key: 'ArrowLeft', preventDefault() {} });
    assert.ok(f.api.settings().x < 1); assert.equal(f.writes.length, 1);
    assert.ok(parseFloat(panel.style.left) >= 8);
    f.getClass('ytot-chat-tool').onclick();
    assert.equal(f.api.settings().enabled, false);
});
test('busy-channel mutations batch once and a partially rendered message retains source order', () => {
    const f = fixture();
    const pending = f.addLine('pending'), later = f.addLine('later');
    pending.line.childNodes = [pending.author]; pending.message.parentNode = null;
    f.api.configure({ enabled: true, fullscreenOnly: false });
    const list = f.getClass('ytot-chat-messages'), retained = list.children[0];
    pending.line.appendChild(pending.message);
    for (let i = 0; i < 100; i++) f.observers.find(o => o.active).fn([{ target: pending.line }]);
    assert.equal(f.timers.size, 1);
    f.flush();
    assert.equal(list.children.length, 2);
    assert.equal(list.children[1], retained);
    assert.ok(list.children[0].childNodes.some(n => n.textContent === 'pending'));
    f.api.configure({ enabled: false });
    assert.equal(f.timers.size, 0);
});
