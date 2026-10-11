// Global and channel emotes in Twitch's existing chat feed; no second chat connection.
(function () {
    'use strict';
    if (window.__ypftEmotes) return;
    const KEY = 'ypft_global_emotes';
    const FEED = '[data-test-selector="chat-scrollable-area__message-container"], .chat-scrollable-area__message-container';
    const LINE = '[data-a-target="chat-line-message"], .chat-line__message';
    const BODY = '[data-a-target="chat-line-message-body"]';
    const CDN = new Set(['cdn.betterttv.net', 'cdn.frankerfacez.com', 'cdn.7tv.app']);
    const PROVIDERS = new Set(['BetterTTV', 'FrankerFaceZ', '7TV']);
    const MAX_LINES = 150;
    let enabled = true, ready = false, revision = 0, feed = null, observer = null, timer = null;
    let loading = null, refreshAt = 0, catalogGeneration = 0;
    let globalCatalog = new Map(), channelCatalog = new Map(), currentChannel = null;
    let channelLoading = null, channelRefreshAt = 0, channelGeneration = 0;
    const dirty = new Set();
    const failedImages = new WeakSet();
    const lookup = code => channelCatalog.get(code) || globalCatalog.get(code);

    function image(emote) {
        const node = document.createElement('img');
        node.className = 'ypft-global-emote';
        node.setAttribute('data-ypft-emote', '');
        node.src = emote.url;
        node.alt = emote.code;
        node.title = `${emote.code} (${emote.provider})`;
        node.decoding = 'async';
        node.loading = 'lazy';
        node.referrerPolicy = 'no-referrer';
        // A CDN outage must leave the original message readable.
        node.onerror = () => {
            failedImages.add(emote);
            node.replaceWith(document.createTextNode(emote.code));
        };
        return node;
    }

    function appendText(destination, text, budget = { images: 0 }) {
        let plain = '';
        const flushText = () => {
            if (plain) destination.appendChild(document.createTextNode(plain));
            plain = '';
        };
        for (const token of text.split(/(\s+)/)) {
            if (!token) continue;
            const emote = enabled && lookup(token);
            if (emote && !failedImages.has(emote) && budget.images < 32) {
                flushText(); budget.images++;
                destination.appendChild(image(emote));
            } else plain += token;
        }
        flushText();
    }

    function renderLine(line) {
        const bodies = Array.from(line.querySelectorAll(BODY));
        // Current Twitch also uses individual text fragments without a body wrapper.
        if (!bodies.length) bodies.push(...line.querySelectorAll('[data-a-target="chat-message-text"], .text-fragment'));
        const texts = [];
        let nodes = 0;
        function visit(node, depth = 0) {
            if (depth > 16 || nodes++ >= 200) return;
            if (node.nodeType === 3) { texts.push(node); return; }
            if (node.nodeType !== 1 || ['A', 'BUTTON', 'IMG', 'SVG', 'SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'CODE', 'PRE'].includes(node.tagName) ||
                node.classList.contains('bttv-emote') || node.classList.contains('ffz-emote') || node.classList.contains('seventv-emote')) return;
            for (const child of node.childNodes) visit(child, depth + 1);
        }
        bodies.forEach(body => visit(body));
        const budget = { images: line.querySelectorAll('img').length };
        for (const node of texts) {
            if (budget.images >= 32 || node.textContent.length > 4000 || !node.textContent.split(/\s+/).some(token => {
                const emote = lookup(token);
                return emote && !failedImages.has(emote);
            })) continue;
            const fragment = document.createDocumentFragment();
            appendText(fragment, node.textContent, budget);
            node.replaceWith(fragment);
        }
    }

    function flush() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        if (enabled && feed?.isConnected) {
            for (const line of dirty) if (feed.contains(line)) renderLine(line);
        }
        dirty.clear();
    }
    function markDirty(line) {
        if (!line || !feed?.contains(line)) return;
        dirty.delete(line); dirty.add(line);
        if (dirty.size > MAX_LINES) dirty.delete(dirty.values().next().value);
    }
    function queue(records) {
        for (const record of records) {
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            const line = target?.closest(LINE);
            markDirty(line);
            for (const node of record.addedNodes || []) {
                if (node.nodeType !== 1) continue;
                if (node.matches(LINE)) markDirty(node);
                const lines = node.querySelectorAll(LINE);
                for (let i = Math.max(0, lines.length - MAX_LINES); i < lines.length; i++) markDirty(lines[i]);
            }
        }
        if (dirty.size && timer === null) timer = setTimeout(flush, 125);
    }
    function renderFeed() {
        if (!feed || (!globalCatalog.size && !channelCatalog.size)) return;
        const lines = feed.querySelectorAll(LINE);
        for (let i = Math.max(0, lines.length - MAX_LINES); i < lines.length; i++) markDirty(lines[i]);
        flush();
    }
    function detach() {
        observer?.disconnect(); observer = null;
        if (timer !== null) clearTimeout(timer);
        timer = null; dirty.clear(); feed = null;
    }

    function readCatalog(response) {
        const next = new Map();
        for (const emote of Array.isArray(response?.emotes) ? response.emotes : []) {
            if (typeof emote?.code !== 'string' || !emote.code || emote.code.length > 100 || /\s/.test(emote.code) ||
                !PROVIDERS.has(emote.provider)) continue;
            try {
                const url = new URL(emote.url);
                if (url.protocol === 'https:' && CDN.has(url.hostname) && !url.username && !url.password && !url.port && !next.has(emote.code)) {
                    next.set(emote.code, { code: emote.code, provider: emote.provider, url: url.href });
                }
            } catch {}
        }
        return next;
    }
    function restoreImages() {
        for (const node of document.querySelectorAll('img[data-ypft-emote]')) node.replaceWith(document.createTextNode(node.alt));
    }
    function updateCatalog() {
        // Lookup checks channel aliases first without retaining a third merged map.
        restoreImages();
        if (enabled) renderFeed();
    }
    function nextRefresh(response, maxAge) {
        const now = Date.now();
        return Number.isFinite(response?.refreshAt) && response.refreshAt > now
            ? Math.min(response.refreshAt, now + maxAge) : now + 5 * 60 * 1000;
    }
    function loadCatalog() {
        if (loading || Date.now() < refreshAt) return;
        const generation = catalogGeneration;
        loading = (async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'GET_GLOBAL_EMOTES' });
                if (generation !== catalogGeneration) return;
                globalCatalog = readCatalog(response);
                refreshAt = nextRefresh(response, 6 * 60 * 60 * 1000);
                updateCatalog();
            } catch {
                if (generation === catalogGeneration) refreshAt = Date.now() + 5 * 60 * 1000;
            } finally { if (generation === catalogGeneration) loading = null; }
        })();
    }

    function channelFromPath() {
        const parts = location.pathname.split('/').filter(Boolean);
        const popout = /^(popout|embed)$/i.test(parts[0]) && parts[2] === 'chat';
        const name = popout ? parts[1] : parts[0];
        const reserved = /^(directory|downloads|drops|friends|jobs|moderator|p|popout|embed|prime|search|settings|store|subscriptions|team|turbo|u|videos|wallet)$/i;
        return (popout || parts.length === 1) && /^[a-z0-9_]{1,25}$/i.test(name || '') && !reserved.test(name)
            ? name.toLowerCase() : null;
    }
    function loadChannelCatalog() {
        if (!currentChannel || channelLoading || Date.now() < channelRefreshAt) return;
        const generation = channelGeneration, channel = currentChannel;
        channelLoading = (async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'GET_CHANNEL_EMOTES', channel });
                if (generation !== channelGeneration) return;
                channelCatalog = readCatalog(response);
                channelRefreshAt = nextRefresh(response, 30 * 60 * 1000);
                updateCatalog();
            } catch {
                if (generation === channelGeneration) channelRefreshAt = Date.now() + 5 * 60 * 1000;
            } finally {
                if (generation === channelGeneration) channelLoading = null;
            }
        })();
    }

    function releaseCatalogs() {
        catalogGeneration++; channelGeneration++;
        globalCatalog.clear(); channelCatalog.clear();
        loading = null; channelLoading = null;
        refreshAt = 0; channelRefreshAt = 0; currentChannel = null;
    }

    function sync() {
        if (!ready || !enabled || document.visibilityState === 'hidden') {
            detach();
            if (globalCatalog.size || channelCatalog.size || loading || channelLoading) {
                releaseCatalogs(); restoreImages();
            }
            return;
        }
        const channel = channelFromPath();
        if (channel !== currentChannel) {
            channelGeneration++; currentChannel = channel; channelLoading = null; channelRefreshAt = 0;
            channelCatalog.clear();
            detach(); updateCatalog();
        }
        const next = document.querySelector(FEED);
        if (next !== feed) {
            detach(); feed = next;
            if (feed) {
                observer = new MutationObserver(queue);
                observer.observe(feed, { childList: true, subtree: true, characterData: true });
                renderFeed();
            }
        }
        if (feed) { loadCatalog(); loadChannelCatalog(); }
    }
    function configure(value, save = false) {
        enabled = value !== false; ready = true; revision++;
        if (!enabled) {
            detach();
            releaseCatalogs();
            restoreImages();
        }
        if (save) {
            try { chrome.storage.local.set({ [KEY]: enabled })?.catch(() => {}); } catch {}
        }
        sync();
        document.dispatchEvent(new CustomEvent('ypft-emote-setting'));
    }

    window.__ypftEmotes = Object.freeze({ sync, configure, appendText, enabled: () => enabled });
    document.addEventListener('visibilitychange', sync);
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) configure(changes[KEY].newValue);
    });
    try {
        const initialRevision = revision;
        chrome.storage.local.get([KEY], stored => {
            if (revision === initialRevision) configure(stored?.[KEY]);
        });
    } catch { configure(true); }
})();
