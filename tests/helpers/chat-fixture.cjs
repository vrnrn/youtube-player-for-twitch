const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../../twitch-chat.js', 'utf8');
class Style {
    setProperty(key, value, priority = '') { this[key] = String(value); (this.priorities ??= new Map()).set(key, priority); }
    getPropertyValue(key) { return this[key] || ''; }
    getPropertyPriority(key) { return this.priorities?.get(key) || ''; }
    removeProperty(key) { delete this[key]; this.priorities?.delete(key); }
}
class Node {
    constructor(tag = 'DIV', text = '') {
        this.tagName = tag.toUpperCase(); this.nodeType = tag === '#text' ? 3 : 1;
        this.textContent = text; this.childNodes = []; this.style = new Style(); this.attrs = new Map();
        this.classes = new Set(); this.classList = { contains: name => this.classes.has(name) || (this.className || '').split(' ').includes(name), toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
        this.scrollTop = 0; this.clientHeight = 200; this.connected = true;
    }
    get textContent() { return this.childNodes?.length ? this.childNodes.map(n => n.textContent).join('') : this._text || ''; }
    set textContent(value) { this._text = value; if (this.childNodes) this.replaceChildren(); }
    get src() { return this.getAttribute('src'); }
    set src(value) { this.setAttribute('src', value); }
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
    replaceWith(node) { const p = this.parentNode; if (!p) return; const before = p.childNodes[p.childNodes.indexOf(this) + 1]; this.remove(); if (node.tagName === '#FRAGMENT') { for (const child of [...node.childNodes]) p.insertBefore(child, before); } else p.insertBefore(node, before); }
    replaceChildren(...nodes) { this.childNodes.forEach(n => { n.parentNode = null; }); this.childNodes = []; this.append(...nodes); }
    contains(node) { return this === node || this.childNodes.some(n => n.contains(node)); }
    setAttribute(key, value) { this.attrs.set(key, String(value)); }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    removeAttribute(key) { this.attrs.delete(key); }
    matches(selector) {
        return selector.split(',').some(value => {
            value = value.trim();
            if (value === '.right-column') return this.className === 'right-column';
            if (value === '[data-a-target="right-column__toggle-collapse-btn"]') return this.kind === 'native-toggle';
            if (value === 'img[data-ypft-emote]') return this.tagName === 'IMG' && this.attrs.has('data-ypft-emote');
            if (value === 'img') return this.tagName === 'IMG';
            if (value.includes('chat-line-message-body') || value.includes('chat-message-text')) return this.kind === 'body';
            if (value.includes('chat-line-message') || value === '.chat-line__message') return this.kind === 'line';
            if (value.includes('chat-message-username') || value === '.chat-author__display-name') return this.kind === 'name';
            if (value === 'img.chat-badge') return this.className === 'chat-badge';
            if (value === '.text-fragment') return this.className === 'text-fragment';
            return false;
        });
    }
    querySelectorAll(selector) {
        const all = [];
        const visit = n => { for (const child of n.childNodes) { if (child.matches(selector)) all.push(child); visit(child); } };
        visit(this); return all;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { for (let n = this; n; n = n.parentNode) if (selector === 'button' ? n.tagName === 'BUTTON' : n.matches(selector)) return n; return null; }
    click() { this.onclick?.(); }
    getBoundingClientRect() { return this.rect || { left: 20, top: 60, width: 1000, height: 600 }; }
    async requestFullscreen() { this.doc.fullscreenElement = this; }
    setPointerCapture() {}
    hasPointerCapture() { return false; }
}
function fixture({ saved = {}, path = '/valkyrae', youtube = false, emotes = null, channelEmotes = [], emotesEnabled = true, sendMessage = null, chatCollapsed = null, deferNativeToggle = false, transform = source => source } = {}) {
    const observers = [], resizeObservers = [], timers = new Map(), frames = new Map(), events = new Map(), writes = [];
    const timerDue = new Map(), nativeCommits = []; let timerId = 0, now = 0, nativeClicks = 0, nativeCollapsed = chatCollapsed;
    const body = new Node('BODY'), player = new Node(); player.doc = null;
    let feed = new Node(), host = player, nativeColumn = null, nativeToggle = null;
    function buildNativeColumn() {
        nativeColumn = new Node(); nativeColumn.className = 'right-column';
        nativeColumn.classList.toggle('right-column--collapsed', nativeCollapsed);
        nativeToggle = new Node('BUTTON'); nativeToggle.kind = 'native-toggle';
        nativeToggle.setAttribute('data-a-target', 'right-column__toggle-collapse-btn');
        nativeToggle.onclick = () => {
            nativeClicks++; nativeCollapsed = !nativeCollapsed;
            const column = nativeColumn, collapsed = nativeCollapsed;
            const commit = () => column.classList.toggle('right-column--collapsed', collapsed);
            if (deferNativeToggle) nativeCommits.push(commit); else commit();
        };
        nativeColumn.append(nativeToggle, feed); body.appendChild(nativeColumn);
    }
    const iframe = youtube ? new Node('IFRAME') : null;
    if (iframe) { iframe.id = 'ytot-youtube-player'; iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media'); iframe.setAttribute('allowfullscreen', 'true'); player.appendChild(iframe); }
    const document = { body, visibilityState: 'visible', fullscreenElement: null,
        createElement: tag => new Node(tag), createTextNode: text => new Node('#text', text),
        createElementNS: (namespace, tag) => new Node(tag),
        createDocumentFragment: () => new Node('#fragment'),
        querySelector: selector => selector.includes('message-container') ? feed : selector === '.right-column' ? nativeColumn : selector === '.persistent-player' ? nativeColumn && player : host,
        querySelectorAll: selector => body.querySelectorAll(selector),
        getElementById: id => id === 'ytot-youtube-player' ? iframe : id === 'ytot-youtube-wrapper' && youtube ? host : null,
        addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type),
        dispatchEvent() {}, async exitFullscreen() { document.fullscreenElement = null; }
    };
    player.doc = document; body.append(player);
    if (chatCollapsed === null) body.append(feed); else buildNativeColumn();
    const storageChanges = [];
    const context = vm.createContext({ document, location: { pathname: path }, URL, CustomEvent: class {},
        window: { addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type) },
        chrome: { runtime: { sendMessage(message) { return sendMessage ? sendMessage(message) : Promise.resolve({ emotes: message.type === 'GET_CHANNEL_EMOTES' ? channelEmotes : emotes }); } }, storage: { local: { get(keys, cb) { cb({ ytot_chat: saved, ypft_global_emotes: emotesEnabled }); }, set(data) { writes.push(data); return Promise.resolve(); } },
            onChanged: { addListener(fn) { storageChanges.push(fn); } } } },
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(node) { this.node = node; this.active = true; } disconnect() { this.active = false; } },
        ResizeObserver: class { constructor(fn) { this.fn = fn; resizeObservers.push(this); } observe() { this.active = true; } disconnect() { this.active = false; } },
        setTimeout(fn, delay = 0) { const id = ++timerId; timers.set(id, fn); timerDue.set(id, now + delay); return id; }, clearTimeout(id) { timers.delete(id); timerDue.delete(id); },
        requestAnimationFrame(fn) { const id = frames.size + 1; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); }
    });
    if (emotes !== null || sendMessage) vm.runInContext(transform(fs.readFileSync(__dirname + '/../../twitch-emotes.js', 'utf8'), 'emotes'), context);
    vm.runInContext(transform(source, 'chat'), context);
    const getClass = name => {
        let result;
        const visit = node => { if (node.className === name) result = node; node.children.forEach(visit); };
        visit(body); return result;
    };
    return { api: context.window.__ypftChat, emoteApi: context.window.__ypftEmotes, context, document, events, observers, resizeObservers, writes, timers, frames, iframe,
        get feed() { return feed; }, get host() { return host; }, get nativeColumn() { return nativeColumn; }, get nativeClicks() { return nativeClicks; }, getClass,
        addLine(text = 'hello', name = 'Viewer') {
            const line = new Node(); line.kind = 'line';
            const author = new Node('SPAN', name); author.kind = 'name'; author.style.color = 'rgb(100, 200, 255)';
            const message = new Node('SPAN'); message.kind = 'body'; message.appendChild(new Node('#text', text));
            line.append(author, message); feed.appendChild(line); return { line, message, author };
        },
        flush(records = []) {
            observers.filter(o => o.active).forEach(o => o.fn(records));
            const pending = [...timers.values()]; timers.clear(); timerDue.clear(); pending.forEach(fn => fn());
        },
        mutate(records = []) { observers.filter(o => o.active).forEach(o => o.fn(records)); },
        tick(ms) {
            now += ms;
            for (const [id, due] of [...timerDue]) if (due <= now && timers.has(id)) {
                const fn = timers.get(id); timers.delete(id); timerDue.delete(id); fn();
            }
        },
        commitNative() { nativeCommits.splice(0).forEach(fn => fn()); },
        userToggleNative() { events.get('click')?.({ isTrusted: true, target: nativeToggle }); nativeToggle.click(); },
        replaceNativeColumn() { nativeColumn.connected = false; nativeColumn.remove(); buildNativeColumn(); },
        resize() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
        changePath(value) { context.location.pathname = value; },
        replaceFeed() { feed.connected = false; feed.remove(); feed = new Node(); body.appendChild(feed); },
        replaceHost() { host.remove(); host = new Node(); host.doc = document; body.appendChild(host); },
        external(value) { storageChanges.forEach(fn => fn({ ytot_chat: { newValue: value } }, 'local')); },
        externalEmotes(value) { storageChanges.forEach(fn => fn({ ypft_global_emotes: { newValue: value } }, 'local')); }
    };
}

module.exports = { Node, fixture };
