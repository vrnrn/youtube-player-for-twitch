// Opt-in Kick embeds and local pseudo channels. No Kick account or API key is required.
(() => {
    'use strict';
    if (window.__ypftKick) return;
    const KEY = 'ytot_kick_settings';
    const MAX_PINS = 30;
    const STATUS_TTL = 10 * 60 * 1000;
    const RESERVED = /^(?:api|auth|browse|categories|category|chat|clips|dashboard|directory|downloads|following|forgot-password|help|jobs|login|logout|moderator|notifications|popout|privacy|register|search|settings|subscriptions|terms|videos)$/;
    function parseChannel(value) {
        if (typeof value !== 'string') return null;
        let slug = value.trim().toLowerCase();
        if (/^(?:https?:\/\/)?(?:www\.)?kick\.com\//.test(slug)) {
            try {
                const url = new URL(slug.startsWith('http') ? slug : `https://${slug}`);
                if (url.protocol !== 'https:' || !['kick.com', 'www.kick.com'].includes(url.hostname) ||
                    url.username || url.password || url.port) return null;
                slug = url.pathname.match(/^\/([^/]+)\/?$/)?.[1] || '';
            } catch { return null; }
        }
        return /^[a-z0-9_][a-z0-9_-]{0,24}$/.test(slug) && !RESERVED.test(slug) ? slug : null;
    }
    function normalize(value) {
        return { enabled: value?.enabled === true, showChat: value?.showChat !== false,
            channels: [...new Set((Array.isArray(value?.channels) ? value.channels : []).map(parseChannel).filter(Boolean))].slice(0, MAX_PINS) };
    }
    const read = key => chrome.storage.local.get(key).then(result => result[key]);
    let settings = normalize(null), ready = false, bindings = null, writing = Promise.resolve();
    let active = null, route = null, generation = 0, restoring = false;
    let page = null, chat = null, chatHost = null, chatMode = 'kick', sidebar = null;
    let chatColumn = null, chatHidden = null;
    let statusBusy = false, followedFallback = null;
    const statuses = new Map();
    const nativeChannel = () => {
        const slug = location.pathname.match(/^\/([a-z0-9_]+)\/?$/i)?.[1]?.toLowerCase();
        return slug && !/^(?:directory|downloads|drops|friends|jobs|moderator|p|popout|prime|search|settings|store|subscriptions|team|turbo|u|videos|wallet)$/.test(slug) ? slug : null;
    };
    const pseudoChannel = () => location.pathname === '/directory' ? parseChannel(new URL(location.href).searchParams.get('ypft-kick')) : null;
    const routeKey = () => `${location.pathname}?kick=${pseudoChannel() || ''}`;
    const channelHref = slug => `/directory?ypft-kick=${encodeURIComponent(slug)}`;
    const notify = () => { renderSettings(); bindings?.changed(); };
    function error(message) {
        const status = document.getElementById('ytot-kick-status');
        if (status) status.textContent = message;
    }
    function configure(update) {
        writing = writing.catch(() => {}).then(async () => {
            const latest = normalize(await read(KEY));
            const next = normalize(update(latest));
            await chrome.storage.local.set({ [KEY]: next });
            apply(next);
        });
        return writing;
    }
    function apply(value) {
        settings = normalize(value);
        for (const slug of statuses.keys()) if (!settings.channels.includes(slug)) statuses.delete(slug);
        if (!settings.enabled) { stop({ forget: true }); clearSidebar(); }
        notify();
        sync();
    }
    function renderSettings() {
        const toggle = document.getElementById('ytot-kick-enabled');
        if (!toggle) return;
        toggle.disabled = !ready;
        toggle.checked = settings.enabled;
        document.getElementById('ytot-kick-options').hidden = !settings.enabled;
        document.getElementById('ytot-kick-chat-enabled').checked = settings.showChat;
        const list = document.getElementById('ytot-kick-pins');
        list.replaceChildren();
        if (!settings.channels.length) {
            const empty = document.createElement('p');
            empty.className = 'ytot-settings-intro';
            empty.textContent = 'No pinned Kick channels yet.';
            list.appendChild(empty);
        }
        for (const slug of settings.channels) {
            const row = document.createElement('div'); row.className = 'ytot-kick-pin-row';
            const link = document.createElement('a'); link.href = channelHref(slug); link.textContent = slug;
            link.title = `Watch ${slug} with Kick chat`;
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Unpin';
            remove.setAttribute('aria-label', `Unpin ${slug}`);
            remove.onclick = () => configure(value => ({ ...value, channels: value.channels.filter(channel => channel !== slug) }))
                .then(() => document.getElementById('ytot-kick-channel')?.focus()).catch(() => error('Could not save. Try again.'));
            row.append(link, remove); list.appendChild(row);
        }
    }
    function setupSettings() {
        document.getElementById('ytot-kick-enabled').onchange = event => {
            const enabled = event.target.checked;
            event.target.disabled = true;
            configure(value => ({ ...value, enabled }))
                .catch(() => { renderSettings(); error('Could not save. Try again.'); });
        };
        document.getElementById('ytot-kick-chat-enabled').onchange = event => {
            const showChat = event.target.checked;
            configure(value => ({ ...value, showChat })).catch(() => { renderSettings(); error('Could not save. Try again.'); });
        };
        const form = document.getElementById('ytot-kick-pin-form');
        const input = document.getElementById('ytot-kick-channel');
        input.oninput = () => { input.setAttribute('aria-invalid', 'false'); error(''); };
        form.onsubmit = event => {
            event.preventDefault();
            const slug = parseChannel(input.value);
            if (!slug) { input.setAttribute('aria-invalid', 'true'); error('Enter a Kick channel name or https://kick.com/channel URL.'); input.focus(); return; }
            const button = document.getElementById('ytot-kick-pin'); button.disabled = true;
            configure(value => {
                if (value.channels.includes(slug)) throw new Error('That channel is already pinned.');
                if (value.channels.length >= MAX_PINS) throw new Error(`You can pin up to ${MAX_PINS} channels. Unpin one first.`);
                return { ...value, channels: [...value.channels, slug] };
            }).then(() => { input.value = ''; error(`Pinned ${slug}. It will appear in Followed Channels when live on Kick.`); sync(); })
                .catch(reason => error(reason.message || 'Could not save. Try again.'))
                .finally(() => { button.disabled = false; });
        };
        renderSettings();
    }
    function createPlayer(slug) {
        const wrapper = document.createElement('div'); wrapper.id = 'ytot-youtube-wrapper';
        const frame = document.createElement('iframe'); frame.id = 'ytot-kick-player'; frame.title = `${slug} · Kick stream`;
        frame.src = `https://player.kick.com/${slug}?autoplay=true`;
        frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        frame.setAttribute('allowfullscreen', 'true'); wrapper.appendChild(frame);
        return wrapper;
    }
    function stop({ navigation = false, forget = false } = {}) {
        generation++; restoring = false;
        const savedChannel = active?.native || nativeChannel();
        if (forget && savedChannel) chrome.storage.local.set({ [`ytot_kick_active_${savedChannel}`]: null }).catch(() => {});
        if (active) {
            document.getElementById('ytot-youtube-wrapper')?.remove();
            window.__ypftPlayback.release({ navigation });
        }
        active = null;
        removeChat();
        if (page) { page.parentElement?.classList.remove('ytot-kick-page-host'); page.remove(); page = null; }
        window.__ypftChat?.sync();
        bindings?.changed();
    }
    function restore() {
        const pseudo = active?.pseudo;
        stop({ forget: true });
        if (pseudo) {
            const url = new URL(location.href); url.searchParams.delete('ypft-kick');
            history.replaceState(history.state, '', url.href); route = routeKey();
        }
    }
    function play(value, restoredPlayback = null) {
        const slug = parseChannel(value);
        if (!settings.enabled || !slug) return false;
        const native = nativeChannel();
        if (!native || !window.__ypftPlayback.container()) { location.assign(channelHref(slug)); return true; }
        const snapshot = restoredPlayback || window.__ypftPlayback.snapshot();
        stop({ forget: true }); bindings?.beforePlay();
        active = { slug, native, pseudo: false };
        const wrapper = createPlayer(slug);
        window.__ypftPlayback.own(wrapper, snapshot, 'kick'); document.body.appendChild(wrapper);
        chrome.storage.local.set({ [`ytot_kick_active_${native}`]: { channel: slug, playback: window.__ypftPlayback.snapshot() } }).catch(() => {});
        syncChat(); notify(); window.__ypftChat?.sync();
        return true;
    }
    function mountPage(slug) {
        const host = document.querySelector('main');
        if (!host) return;
        bindings?.beforePlay();
        page = document.createElement('section'); page.id = 'ytot-kick-page'; page.setAttribute('aria-label', `${slug} · Kick channel`);
        page.innerHTML = '<div class="ytot-kick-watch"><header class="ytot-kick-channel-header"><div><h1></h1><p>Kick channel · Experimental</p></div><a target="_blank" rel="noopener noreferrer">Open on Kick</a></header><div class="ytot-kick-video-slot"></div><p class="ytot-kick-help">Stream unavailable? The channel may be offline. Use Open on Kick to check.</p></div><aside class="ytot-kick-page-chat" aria-label="Kick chat"></aside>';
        page.querySelector('h1').textContent = slug;
        const link = page.querySelector('a'); link.href = `https://kick.com/${slug}`;
        host.classList.add('ytot-kick-page-host'); host.appendChild(page);
        active = { slug, native: null, pseudo: true };
        const wrapper = createPlayer(slug);
        window.__ypftPlayback.own(wrapper, null, 'kick', page.querySelector('.ytot-kick-video-slot'));
        document.body.appendChild(wrapper); syncChat(); notify();
    }
    function removeChat() {
        chat?.remove(); chat = null;
        if (chatHost) {
            if (chatHidden !== null) chatHost.setAttribute('aria-hidden', chatHidden);
            else chatHost.removeAttribute('aria-hidden');
        }
        chatHidden = null;
        chatColumn?.removeAttribute('data-ypft-kick-column'); chatColumn = null;
        chatHost?.removeAttribute('data-ypft-kick-chat'); chatHost = null;
    }
    function syncChat() {
        const host = active?.pseudo ? page?.querySelector('.ytot-kick-page-chat') : document.getElementById('live-page-chat');
        if (!active || !settings.showChat || !host) { removeChat(); if (page) page.classList.add('ytot-kick-no-chat'); return; }
        page?.classList.remove('ytot-kick-no-chat');
        if (chat?.isConnected && host === chatHost) return;
        removeChat(); chatHost = host;
        if (!active.pseudo) {
            chatColumn = host.closest('.right-column');
            chatColumn?.setAttribute('data-ypft-kick-column', '');
            chatHidden = host.getAttribute('aria-hidden');
            host.setAttribute('aria-hidden', 'false');
        }
        chat = document.createElement('section'); chat.id = 'ytot-kick-chat'; chat.setAttribute('aria-label', 'Kick chat');
        const header = document.createElement('div'); header.className = 'ytot-kick-chat-header';
        const title = document.createElement('strong'); title.textContent = 'Kick chat';
        const link = document.createElement('a'); link.href = `https://kick.com/popout/${active.slug}/chat`;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open chat';
        link.title = 'Open Kick chat in a new tab if the embed or sign-in is unavailable';
        header.append(title, link);
        if (!active.pseudo) {
            const toggle = document.createElement('button'); toggle.type = 'button';
            const setMode = () => {
                chat.dataset.mode = chatMode; host.setAttribute('data-ypft-kick-chat', chatMode);
                toggle.textContent = chatMode === 'kick' ? 'Twitch chat' : 'Kick chat';
            };
            toggle.onclick = () => { chatMode = chatMode === 'kick' ? 'twitch' : 'kick'; setMode(); };
            header.appendChild(toggle); setMode();
        }
        const frame = document.createElement('iframe'); frame.title = `${active.slug} · Kick chat`;
        frame.src = link.href; chat.append(header, frame); host.appendChild(chat);
    }
    function clearSidebar() {
        sidebar?.remove(); sidebar = null;
        followedFallback?.remove(); followedFallback = null;
    }
    function followedList(nav) {
        // Prefer Twitch's followed-card marker so translated section headings work.
        const section = nav.querySelector('[data-test-selector="followed-channel"]')?.closest('.side-nav-section') ||
            Array.from(nav.querySelectorAll('.side-nav-section')).find(element => element !== followedFallback &&
                (element.getAttribute('aria-label') === 'Followed Channels' || element.querySelector('h3')?.textContent.trim() === 'Followed Channels'));
        if (section) {
            followedFallback?.remove(); followedFallback = null;
            return section.querySelector('.tw-transition-group') || section;
        }
        // Signed-out viewers have no native followed group. Use the same slot,
        // before recommended/live channels, and merge into Twitch's group if it mounts later.
        if (!followedFallback?.isConnected || !nav.contains(followedFallback)) {
            followedFallback?.remove();
            followedFallback = document.createElement('section'); followedFallback.id = 'ytot-kick-followed';
            followedFallback.className = 'side-nav-section'; followedFallback.setAttribute('aria-label', 'Followed Channels');
            const heading = document.createElement('h3'); heading.textContent = 'Followed Channels'; followedFallback.appendChild(heading);
            const list = document.createElement('div'); list.className = 'tw-transition-group'; followedFallback.appendChild(list);
            const first = nav.querySelector('.side-nav-section');
            if (first) first.parentElement.insertBefore(followedFallback, first);
            else nav.insertBefore(followedFallback, nav.firstChild);
        }
        return followedFallback.querySelector('.tw-transition-group');
    }
    function renderSidebar() {
        const nav = document.getElementById('side-nav');
        const live = settings.channels.filter(slug => statuses.get(slug)?.live === true);
        if (!nav || !settings.enabled || !live.length) { clearSidebar(); return; }
        const host = followedList(nav);
        const signature = JSON.stringify(live.map(slug => [slug, statuses.get(slug).viewers, statuses.get(slug).avatar]));
        if (sidebar?.isConnected && sidebar.parentElement === host && sidebar.dataset.signature === signature) return;
        sidebar?.remove(); sidebar = document.createElement('div'); sidebar.id = 'ytot-kick-sidebar';
        sidebar.dataset.signature = signature; sidebar.setAttribute('role', 'group');
        sidebar.setAttribute('aria-label', 'Live pinned Kick channels · Experimental');
        for (const slug of live) {
            const data = statuses.get(slug);
            const label = `Kick · Live${Number.isFinite(data.viewers) ? ` · ${data.viewers.toLocaleString()} viewers` : ''}`;
            const link = document.createElement('a'); link.href = channelHref(slug); link.title = `${slug} · ${label}`;
            link.setAttribute('aria-label', link.title);
            const avatar = document.createElement('span'); avatar.className = 'ytot-kick-avatar'; avatar.textContent = slug.slice(0, 2).toUpperCase();
            avatar.setAttribute('aria-hidden', 'true');
            if (typeof data.avatar === 'string' && data.avatar.startsWith('https://files.kick.com/')) {
                const image = document.createElement('img'); image.src = data.avatar; image.alt = '';
                image.width = image.height = 30; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
                image.onerror = () => image.remove();
                avatar.appendChild(image);
            }
            const name = document.createElement('span'); name.className = 'ytot-kick-channel-name'; name.textContent = slug;
            const status = document.createElement('span'); status.className = 'ytot-kick-channel-status'; status.textContent = 'Kick';
            const copy = document.createElement('span'); copy.className = 'ytot-kick-channel-copy'; copy.append(name, status);
            const viewers = document.createElement('span'); viewers.className = 'ytot-kick-viewers'; viewers.setAttribute('aria-hidden', 'true');
            viewers.textContent = Number.isFinite(data.viewers) ? data.viewers.toLocaleString('en', { notation: 'compact', maximumFractionDigits: 1 }) : '';
            link.append(avatar, copy, viewers); sidebar.appendChild(link);
        }
        host.insertBefore(sidebar, host.firstChild);
    }
    async function refreshStatuses() {
        if (statusBusy) return;
        const now = Date.now();
        const queue = settings.channels.filter(slug => !statuses.has(slug) || now - statuses.get(slug).checkedAt >= STATUS_TTL);
        if (!queue.length) return;
        statusBusy = true;
        try {
            await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
                while (queue.length && settings.enabled && document.visibilityState !== 'hidden') {
                    const slug = queue.shift();
                    const checkedAt = Date.now();
                    let data;
                    try { data = await chrome.runtime.sendMessage({ type: 'GET_KICK_CHANNEL', channel: slug }); } catch { data = null; }
                    if (settings.enabled && settings.channels.includes(slug)) statuses.set(slug,
                        !data?.error && typeof data?.live === 'boolean' ? { ...data, checkedAt } : { live: null, checkedAt });
                }
            }));
        } finally { statusBusy = false; renderSidebar(); }
    }
    function sync() {
        if (!ready || !bindings) return;
        const nextRoute = routeKey();
        if (route !== nextRoute) { stop({ navigation: true }); route = nextRoute; }
        if (!settings.enabled) return;
        const pseudo = pseudoChannel();
        if (active?.pseudo && (!page?.isConnected || page.parentElement !== document.querySelector('main'))) stop({ navigation: true });
        if (pseudo && !active) mountPage(pseudo);
        else if (!pseudo && !active && !restoring && nativeChannel()) {
            restoring = true;
            const native = nativeChannel(), token = generation;
            read(`ytot_kick_active_${native}`).then(saved => {
                if (token !== generation || route !== routeKey() || !settings.enabled) return;
                if (parseChannel(saved?.channel) && window.__ypftPlayback.container()) play(saved.channel, saved.playback);
                else if (parseChannel(saved?.channel)) restoring = false;
            }).catch(() => { if (token === generation) restoring = false; });
        }
        syncChat(); renderSidebar();
        if (document.visibilityState !== 'hidden') refreshStatuses();
    }
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) apply(changes[KEY].newValue);
    });
    read(KEY).then(value => { ready = true; apply(value); }).catch(() => { ready = true; notify(); });
    window.__ypftKick = Object.freeze({ parseChannel, normalize, setupSettings, sync, play, stop, restore,
        enabled: () => settings.enabled, active: () => active?.slug || null,
        connect(callbacks) { bindings = callbacks; sync(); } });
})();
