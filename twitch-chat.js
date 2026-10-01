// Read-only floating chat. Reuses Twitch's rendered feed; no client, network or framework.
(() => {
    'use strict';
    if (window.__ypftChat) return;
    const KEY = 'ytot_chat';
    const FEED = '[data-test-selector="chat-scrollable-area__message-container"], .chat-scrollable-area__message-container';
    const LINE = '[data-a-target="chat-line-message"], .chat-line__message';
    const PLAYER = '[data-a-target="video-player-layout"], .video-player__container, .video-player';
    const MAX_LINES = 60;
    const defaults = Object.freeze({ enabled: false, fullscreenOnly: true, opacity: 70,
        fontSize: 14, color: '#18151f', compact: false, clickThrough: false,
        x: 1, y: 0.15, width: 320, height: 0.55 });
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    function normalize(value = {}) {
        if (!value || typeof value !== 'object') value = {};
        const next = { ...defaults };
        for (const key of ['enabled', 'fullscreenOnly', 'compact', 'clickThrough'])
            if (typeof value[key] === 'boolean') next[key] = value[key];
        for (const [key, min, max] of [['opacity', 0, 100], ['fontSize', 11, 24],
            ['x', 0, 1], ['y', 0, 1], ['width', 160, 600], ['height', 0.15, 0.9]])
            if (Number.isFinite(value[key])) next[key] = clamp(value[key], min, max);
        if (/^#[0-9a-f]{6}$/i.test(value.color)) next.color = value.color;
        return next;
    }
    let settings = normalize(), revision = 0, root = null, panel, messages, empty, latest, fullscreenButton, compactButton;
    let feed = null, feedObserver = null, resizeObserver = null, observedHost = null;
    let host = null, rows = new Map(), dirty = new Set(), frame = null, flushTimer = null;
    let gesture = null, bounds = null, suspended = false, listening = false;
    let managedIframe = null, originalAllow = null, originalFullscreen = null;
    const channel = () => {
        const path = location.pathname.split('/').filter(Boolean);
        const reserved = /^(directory|downloads|drops|friends|jobs|moderator|p|popout|prime|search|settings|store|subscriptions|team|turbo|u|videos|wallet)$/i;
        return path.length === 1 && /^[a-z0-9_]+$/i.test(path[0]) && !reserved.test(path[0]) ? path[0].toLowerCase() : null;
    };
    let lastChannel = null;
    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }
    const icons = {
        compact: 'M4 5h16M4 9h16M4 13h16M4 17h16',
        close: 'm6 6 12 12M18 6 6 18',
        fullscreen: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',
        resize: 'm7 17 10-10m-5 5 5-5m0 5h.01',
        drag: 'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01'
    };
    function button(label, text, className, icon = null) {
        const node = element('button', className);
        node.type = 'button';
        node.setAttribute('aria-label', label);
        node.title = label;
        if (icon) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', icons[icon]); svg.appendChild(path); node.appendChild(svg);
        }
        if (text) node.appendChild(document.createTextNode(text));
        return node;
    }
    function persist() {
        try { chrome.storage.local.set({ [KEY]: { ...settings } })?.catch(() => {}); }
        catch { /* Keep working for the current page if extension context was replaced. */ }
    }
    function configure(value, save = false) {
        revision++;
        settings = normalize(value);
        if (save) persist();
        sync();
        document.dispatchEvent(new CustomEvent('ypft-chat-setting'));
    }
    function build() {
        root = element('div');
        root.id = 'ytot-chat-root';
        panel = element('section', 'ytot-chat-panel');
        panel.setAttribute('aria-label', 'Floating Twitch chat');
        const header = element('div', 'ytot-chat-header');
        const grip = button('Move chat — drag or use arrow keys', 'Twitch chat', 'ytot-chat-grip', 'drag');
        compactButton = button('Toggle compact chat', '', 'ytot-chat-tool', 'compact');
        const close = button('Turn off floating chat', '', 'ytot-chat-tool', 'close');
        compactButton.onclick = () => configure({ ...settings, compact: !settings.compact }, true);
        close.onclick = () => configure({ ...settings, enabled: false }, true);
        grip.onpointerdown = event => startGesture(event, grip, 'move');
        grip.onkeydown = event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const step = event.shiftKey ? 0.1 : 0.02;
            settings.x = clamp(settings.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), 0, 1);
            settings.y = clamp(settings.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0), 0, 1);
            layout(); persist();
        };
        header.append(grip, compactButton, close);
        messages = element('div', 'ytot-chat-messages');
        messages.setAttribute('role', 'log');
        messages.setAttribute('aria-live', 'off');
        messages.setAttribute('aria-label', 'Recent Twitch messages');
        messages.tabIndex = 0;
        messages.onscroll = () => { latest.hidden = isAtBottom(); };
        empty = element('div', 'ytot-chat-empty', 'Waiting for chat…');
        latest = button('Jump to latest chat', '↓ Latest', 'ytot-chat-latest');
        latest.hidden = true;
        latest.onclick = () => { messages.scrollTop = messages.scrollHeight; latest.hidden = true; };
        const resize = button('Resize chat — drag or use arrow keys', '', 'ytot-chat-resize', 'resize');
        resize.onpointerdown = event => startGesture(event, resize, 'resize');
        resize.onkeydown = event => {
            if (!bounds || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            settings.width = clamp(settings.width + (event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0), 160, 600);
            settings.height = clamp(settings.height + (event.key === 'ArrowUp' ? -0.05 : event.key === 'ArrowDown' ? 0.05 : 0), 0.15, 0.9);
            layout(); persist();
        };
        fullscreenButton = button('Fullscreen with chat', '', 'ytot-chat-fullscreen', 'fullscreen');
        fullscreenButton.onclick = async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await host?.requestFullscreen();
            } catch {
                empty.textContent = 'Fullscreen unavailable.';
                empty.hidden = false;
            }
        };
        panel.append(header, messages, empty, latest, resize);
        root.append(panel, fullscreenButton);
    }
    function startGesture(event, control, type) {
        if (event.button !== 0 || !bounds) return;
        event.preventDefault();
        control.setPointerCapture(event.pointerId);
        gesture = { type, id: event.pointerId, control, clientX: event.clientX, clientY: event.clientY,
            left: parseFloat(panel.style.left), top: parseFloat(panel.style.top),
            width: parseFloat(panel.style.width), height: parseFloat(panel.style.height) };
        control.onpointermove = moveGesture;
        control.onpointerup = endGesture;
        control.onpointercancel = endGesture;
        control.onlostpointercapture = endGesture;
    }
    function moveGesture(event) {
        if (!gesture || event.pointerId !== gesture.id || !bounds) return;
        const dx = event.clientX - gesture.clientX, dy = event.clientY - gesture.clientY;
        if (gesture.type === 'move') {
            settings.x = clamp((gesture.left + dx - 8) / Math.max(1, bounds.width - gesture.width - 16), 0, 1);
            settings.y = clamp((gesture.top + dy - 8) / Math.max(1, bounds.height - gesture.height - 16), 0, 1);
        } else {
            settings.width = clamp(gesture.width + dx, 160, Math.max(160, Math.min(600, bounds.width - gesture.left - 8)));
            settings.height = clamp(Math.min(gesture.height + dy, bounds.height - gesture.top - 8) / Math.max(1, bounds.height), 0.15, 0.9);
            const width = Math.min(settings.width, Math.max(0, bounds.width - 16));
            const height = Math.min(Math.max(120, bounds.height * settings.height), Math.max(0, bounds.height - 16));
            settings.x = clamp((gesture.left - 8) / Math.max(1, bounds.width - width - 16), 0, 1);
            settings.y = clamp((gesture.top - 8) / Math.max(1, bounds.height - height - 16), 0, 1);
        }
        scheduleLayout();
    }
    function endGesture() {
        if (!gesture) return;
        const { control, id } = gesture;
        gesture = null;
        control.onpointermove = control.onpointerup = control.onpointercancel = control.onlostpointercapture = null;
        if (control.hasPointerCapture(id)) control.releasePointerCapture(id);
        persist();
    }
    function scheduleLayout() {
        if (frame === null) frame = requestAnimationFrame(() => { frame = null; layout(); });
    }
    function layout() {
        if (!root || !host) return;
        const fullscreen = document.fullscreenElement;
        const rect = host.getBoundingClientRect();
        const parent = fullscreen && fullscreen !== managedIframe && (fullscreen === host || fullscreen.contains(host)) ? fullscreen : document.body;
        if (root.parentElement !== parent) parent.appendChild(root);
        const inFullscreen = parent === fullscreen;
        root.classList.toggle('ytot-chat-in-fullscreen', inFullscreen);
        root.style.left = inFullscreen ? '0px' : rect.left + 'px';
        root.style.top = inFullscreen ? '0px' : rect.top + 'px';
        root.style.width = rect.width + 'px';
        root.style.height = rect.height + 'px';
        bounds = { width: rect.width, height: rect.height };
        const width = Math.min(settings.width, Math.max(0, rect.width - 16));
        const height = Math.min(Math.max(120, rect.height * settings.height), Math.max(0, rect.height - 16));
        panel.style.width = width + 'px';
        panel.style.height = height + 'px';
        panel.style.left = (8 + Math.max(0, rect.width - width - 16) * settings.x) + 'px';
        panel.style.top = (8 + Math.max(0, rect.height - height - 16) * settings.y) + 'px';
        panel.style.fontSize = settings.fontSize + 'px';
        const rgb = [1, 3, 5].map(index => parseInt(settings.color.slice(index, index + 2), 16));
        panel.style.backgroundColor = 'rgba(' + rgb.join(',') + ',' + settings.opacity / 100 + ')';
        panel.classList.toggle('ytot-chat-compact', settings.compact);
        compactButton.setAttribute('aria-pressed', String(settings.compact));
        panel.classList.toggle('ytot-chat-through', settings.clickThrough);
        panel.hidden = suspended || (settings.fullscreenOnly && !inFullscreen) || rect.width < 100 || rect.height < 100;
        root.hidden = suspended || rect.width === 0 || rect.height === 0 || (!!fullscreen && fullscreen === managedIframe);
        fullscreenButton.hidden = suspended;
        fullscreenButton.setAttribute('aria-label', inFullscreen ? 'Exit fullscreen' : 'Fullscreen with chat');
        fullscreenButton.title = inFullscreen ? 'Exit fullscreen' : 'Fullscreen with chat';
        const visible = !panel.hidden && !root.hidden;
        attachFeed(visible ? document.querySelector(FEED) : null);
    }
    // Preserve the original iframe permissions exactly when the feature is off.
    // Fullscreen with chat uses the stable parent, so the cross-origin iframe is never moved.
    function restoreIframe() {
        if (!managedIframe) return;
        if (originalAllow === null) managedIframe.removeAttribute('allow');
        else managedIframe.setAttribute('allow', originalAllow);
        if (originalFullscreen === null) managedIframe.removeAttribute('allowfullscreen');
        else managedIframe.setAttribute('allowfullscreen', originalFullscreen);
        managedIframe = null;
    }
    function manageIframe() {
        const iframe = document.getElementById('ytot-youtube-player');
        if (iframe === managedIframe) return;
        restoreIframe();
        if (!iframe) return;
        managedIframe = iframe;
        originalAllow = iframe.getAttribute('allow');
        originalFullscreen = iframe.getAttribute('allowfullscreen');
        iframe.removeAttribute('allowfullscreen');
        iframe.setAttribute('allow', (originalAllow || '').split(';').filter(part => !/^\s*fullscreen\b/i.test(part)).join(';'));
    }
    function isAtBottom() { return messages.scrollHeight - messages.scrollTop - messages.clientHeight < 28; }
    function image(source) {
        // Only mirror an HTTPS resource already used by Twitch. Never copy markup, scripts or handlers.
        let url;
        try { url = new URL(source.currentSrc || source.getAttribute('src')); } catch { return null; }
        if (url.protocol !== 'https:' || source.closest('button')?.getAttribute('data-a-target') === 'chat-badge') return null;
        const node = element('img', 'ytot-chat-emote');
        node.src = url.href;
        node.alt = source.alt || '';
        node.title = source.alt || '';
        node.decoding = 'async';
        node.referrerPolicy = 'no-referrer';
        return node;
    }
    function content(source, destination, budget = { nodes: 0, chars: 0, images: 0 }, depth = 0) {
        if (!source || depth > 16 || budget.nodes++ > 180) return;
        if (source.nodeType === 3) {
            const text = source.textContent.slice(0, Math.max(0, 4000 - budget.chars));
            budget.chars += text.length;
            if (text) destination.appendChild(document.createTextNode(text));
            return;
        }
        if (source.nodeType !== 1 || ['SCRIPT', 'STYLE', 'SVG', 'IFRAME', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(source.tagName)) return;
        if (source.tagName === 'IMG') {
            if (budget.images++ >= 32) return;
            const node = image(source);
            if (node) destination.appendChild(node);
            return;
        }
        for (const child of source.childNodes) content(child, destination, budget, depth + 1);
    }
    function renderLine(source) {
        const name = source.querySelector('[data-a-target="chat-message-username"], .chat-author__display-name');
        const body = source.querySelector('[data-a-target="chat-line-message-body"]');
        if (!name || !body) return null;
        const row = element('div', 'ytot-chat-line');
        for (const badge of Array.from(source.querySelectorAll('img.chat-badge')).slice(0, 6)) {
            const node = element('img', 'ytot-chat-badge');
            try {
                const url = new URL(badge.currentSrc || badge.getAttribute('src'));
                if (url.protocol !== 'https:') continue;
                node.src = url.href; node.alt = badge.alt || ''; node.decoding = 'async';
                node.referrerPolicy = 'no-referrer'; row.appendChild(node);
            } catch {}
        }
        const author = element('span', 'ytot-chat-author', name.textContent.slice(0, 100));
        author.style.color = name.style.color || '#cdb4ff';
        row.append(author, document.createTextNode(': '));
        content(body, row);
        return row;
    }
    function queueFlush(records) {
        for (const record of records) {
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            const line = target?.closest(LINE);
            if (line) dirty.add(line);
        }
        // At most eight DOM batches/second even in busy channels.
        if (flushTimer === null) flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 125);
    }
    function flush() {
        if (!feed?.isConnected || !messages) return;
        const atBottom = isAtBottom(), previousTop = messages.scrollTop;
        const anchor = atBottom ? null : Array.from(messages.children).find(row => row.offsetTop + row.offsetHeight > previousTop);
        const anchorOffset = anchor ? anchor.offsetTop - previousTop : 0;
        const sources = Array.from(feed.querySelectorAll(LINE)).slice(-MAX_LINES);
        const keep = new Set(sources);
        for (const [source, row] of rows) if (!keep.has(source)) { row.remove(); rows.delete(source); }
        const fragment = document.createDocumentFragment(), ordered = [];
        for (const source of sources) {
            let row = rows.get(source);
            if (row && dirty.has(source)) {
                const updated = renderLine(source);
                if (updated) { row.replaceWith(updated); rows.set(source, updated); row = updated; }
                else { row.remove(); rows.delete(source); row = null; }
            }
            if (!row) {
                row = renderLine(source);
                if (row) { rows.set(source, row); fragment.appendChild(row); }
            }
            if (row) ordered.push(row);
        }
        messages.appendChild(fragment);
        // A partially-rendered Twitch line can become readable after later lines.
        for (let i = 0; i < ordered.length; i++)
            if (messages.children[i] !== ordered[i]) messages.insertBefore(ordered[i], messages.children[i] || null);
        dirty.clear();
        empty.hidden = rows.size > 0;
        empty.textContent = 'Waiting for chat…';
        if (atBottom) messages.scrollTop = messages.scrollHeight;
        else messages.scrollTop = anchor?.parentElement === messages ? Math.max(0, anchor.offsetTop - anchorOffset) : previousTop;
        latest.hidden = atBottom;
    }
    function attachFeed(next) {
        if (feed === next) return;
        feedObserver?.disconnect(); feedObserver = null;
        if (flushTimer !== null) clearTimeout(flushTimer);
        flushTimer = null;
        dirty.clear(); rows.clear();
        messages?.replaceChildren();
        feed = next;
        if (!feed) {
            if (empty) { empty.hidden = false; empty.textContent = 'Open Twitch chat to show messages.'; }
            return;
        }
        feedObserver = new MutationObserver(queueFlush);
        feedObserver.observe(feed, { childList: true, subtree: true, characterData: true, attributes: true,
            attributeFilter: ['src', 'srcset', 'alt', 'style'] });
        flush();
    }
    function teardown() {
        attachFeed(null);
        endGesture();
        resizeObserver?.disconnect(); resizeObserver = null; observedHost = null;
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        root?.remove(); root = null; host = null; rows.clear(); dirty.clear();
        restoreIframe();
        if (listening) {
            document.removeEventListener('fullscreenchange', sync);
            document.removeEventListener('visibilitychange', sync);
            document.removeEventListener('scroll', scheduleLayout, true);
            window.removeEventListener('resize', scheduleLayout);
            listening = false;
        }
    }
    function sync() {
        const current = channel();
        if (!settings.enabled || !current) { teardown(); lastChannel = current; return; }
        if (lastChannel !== current) attachFeed(null);
        lastChannel = current;
        suspended = document.visibilityState === 'hidden';
        if (!root) build();
        manageIframe();
        host = document.getElementById('ytot-youtube-wrapper') || document.querySelector(PLAYER);
        if (!host) {
            root.remove(); attachFeed(null);
            resizeObserver?.disconnect(); resizeObserver = null; observedHost = null;
            return;
        }
        if (!listening) {
            document.addEventListener('fullscreenchange', sync);
            document.addEventListener('visibilitychange', sync);
            document.addEventListener('scroll', scheduleLayout, true);
            window.addEventListener('resize', scheduleLayout);
            listening = true;
        }
        if (observedHost !== host) {
            resizeObserver?.disconnect();
            resizeObserver = new ResizeObserver(scheduleLayout);
            resizeObserver.observe(host); observedHost = host;
        }
        layout();
    }
    window.__ypftChat = Object.freeze({ configure, sync, normalize, settings: () => ({ ...settings }) });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) configure(changes[KEY].newValue);
    });
    try {
        const initialRevision = revision;
        chrome.storage.local.get([KEY], stored => {
            if (revision === initialRevision) configure(stored?.[KEY]);
        });
    } catch { configure(defaults); }
})();
