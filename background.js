/**
 * YouTube on Twitch - Background Script
 * Handles cross-origin requests and logic
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.type === 'GET_KICK_CHANNEL') {
        const url = sender.url || sender.tab?.url;
        if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !/^https:\/\/www\.twitch\.tv\//.test(url || '')) {
            sendResponse({ error: 'Kick channels are only available on Twitch.' });
            return;
        }
        getKickChannel(request.channel).then(sendResponse).catch(error => sendResponse({ error: error.message }));
        return true;
    }
    if (request?.type === 'GET_GLOBAL_EMOTES') {
        getGlobalEmotes().then(sendResponse).catch(() => sendResponse({ emotes: [] }));
        return true;
    }

    if (request?.type === 'GET_CHANNEL_EMOTES') {
        getChannelEmotes(request.channel).then(sendResponse).catch(() => sendResponse({ emotes: [] }));
        return true;
    }

    if (request?.type === 'SEARCH_YOUTUBE') {
        handleSearch(request.query)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true; // Keep channel open for async response
    }

    if (request?.type === 'SEARCH_YOUTUBE_CHANNEL') {
        handleChannelSearch(request.channelUrl)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (request?.type === 'GET_VIDEO_DETAILS') {
        handleVideoDetails(request.videoId)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
});

async function getKickChannel(channel) {
    if (typeof channel !== 'string' || !/^[a-z0-9_][a-z0-9_-]{0,24}$/.test(channel)) throw new Error('Invalid Kick channel.');
    const stored = await chrome.storage.local.get('ytot_kick_settings');
    if (stored.ytot_kick_settings?.enabled !== true) throw new Error('Enable experimental Kick support in Settings first.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`https://kick.com/api/v2/channels/${channel}`, {
            credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal
        });
        if (!response.ok) throw new Error('Kick channel status is unavailable.');
        const data = await response.json();
        if (typeof data?.slug !== 'string' || data.slug.toLowerCase() !== channel ||
            !Object.hasOwn(data, 'livestream') || (data.livestream !== null && typeof data.livestream?.is_live !== 'boolean')) {
            throw new Error('Kick channel status is unavailable.');
        }
        return { channel, live: data.livestream?.is_live === true,
            avatar: emoteImageUrl(data.user?.profile_pic, 'files.kick.com'),
            viewers: Number.isFinite(data.livestream?.viewer_count) && data.livestream.viewer_count >= 0 ? data.livestream.viewer_count : null };
    } finally { clearTimeout(timer); }
}

const EMOTE_CACHE_KEY = 'ypft_global_emotes_v1';
const EMOTE_CACHE_TTL = 6 * 60 * 60 * 1000;
const EMOTE_RETRY_DELAY = 5 * 60 * 1000;
const CHANNEL_EMOTE_CACHE_PREFIX = 'ypft_channel_emotes_v2_';
const CHANNEL_EMOTE_CACHE_INDEX = 'ypft_channel_emotes_index_v2';
const CHANNEL_EMOTE_CACHE_TTL = 30 * 60 * 1000;
const EMOTE_PROVIDERS = {
    BetterTTV: 'https://api.betterttv.net/3/cached/emotes/global',
    FrankerFaceZ: 'https://api.frankerfacez.com/v1/set/global',
    '7TV': 'https://7tv.io/v3/emote-sets/global'
};
let globalEmotesRequest = null;
const channelEmoteRequests = new Map();
let channelEmoteWrites = Promise.resolve();

function emoteImageUrl(value, hostname) {
    try {
        const url = new URL(value?.startsWith('//') ? `https:${value}` : value);
        return url.protocol === 'https:' && url.hostname === hostname && !url.username && !url.password && !url.port
            ? url.href : null;
    } catch { return null; }
}

function parseEmoteCatalog(provider, data) {
    let entries;
    if (provider === 'BetterTTV' && Array.isArray(data)) {
        entries = data.filter(emote => !emote.modifier && /^[a-f0-9]{24}$/i.test(emote.id)).map(emote => ({
            code: emote.code, url: `https://cdn.betterttv.net/emote/${emote.id}/2x`
        }));
    } else if (provider === 'FrankerFaceZ' && Array.isArray(data?.default_sets) && data?.sets) {
        // Other sets in this response belong to specific users, not everyone.
        entries = data.default_sets.flatMap(id => data.sets[id]?.emoticons || [])
            .filter(emote => !emote.modifier && !emote.hidden).map(emote => ({
                code: emote.name,
                url: emoteImageUrl(emote.animated?.['2'] || emote.urls?.['2'] || emote.urls?.['1'], 'cdn.frankerfacez.com')
            }));
    } else if (provider === '7TV' && Array.isArray(data?.emotes)) {
        entries = data.emotes.map(emote => {
            const host = emote.data?.host;
            const file = host?.files?.find(file => file.name === '2x.webp') ||
                host?.files?.find(file => /^(?:1|2)x\.(?:webp|png|gif)$/.test(file.name));
            const base = emoteImageUrl(host?.url, 'cdn.7tv.app');
            return { code: emote.name, url: base && file ? `${base.replace(/\/$/, '')}/${file.name}` : null };
        });
    } else {
        throw new Error('Invalid emote catalog');
    }
    return entries.filter(emote => typeof emote.code === 'string' && emote.code.length <= 100 &&
        emote.code.length > 0 && !/\s/.test(emote.code) && emote.url)
        .slice(0, 2000).map(emote => ({ ...emote, provider }));
}

async function fetchEmoteData(endpoint, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(endpoint, { ...options, credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Emote provider unavailable');
        return await response.json();
    } finally { clearTimeout(timer); }
}

function getGlobalEmotes() {
    // Share in-flight work across tabs, and persist the public catalog across worker restarts.
    if (globalEmotesRequest) return globalEmotesRequest;
    globalEmotesRequest = (async () => {
        let cache = {};
        try {
            const stored = await chrome.storage.local.get(EMOTE_CACHE_KEY);
            if (stored?.[EMOTE_CACHE_KEY] && typeof stored[EMOTE_CACHE_KEY] === 'object') cache = stored[EMOTE_CACHE_KEY];
        } catch {}
        let changed = false;
        await Promise.all(Object.entries(EMOTE_PROVIDERS).map(async ([provider, endpoint]) => {
            const previous = cache[provider];
            const now = Date.now();
            if (Array.isArray(previous?.emotes) && previous.refreshAt > now && previous.refreshAt <= now + EMOTE_CACHE_TTL) return;
            changed = true;
            try {
                cache[provider] = { emotes: parseEmoteCatalog(provider, await fetchEmoteData(endpoint)), refreshAt: Date.now() + EMOTE_CACHE_TTL };
            } catch {
                cache[provider] = { emotes: Array.isArray(previous?.emotes) ? previous.emotes : [], refreshAt: Date.now() + EMOTE_RETRY_DELAY };
            }
        }));
        if (changed) { try { await chrome.storage.local.set({ [EMOTE_CACHE_KEY]: cache }); } catch {} }
        return { emotes: Object.keys(EMOTE_PROVIDERS).flatMap(provider => cache[provider].emotes),
            refreshAt: Math.min(...Object.keys(EMOTE_PROVIDERS).map(provider => cache[provider].refreshAt)) };
    })().finally(() => { globalEmotesRequest = null; });
    return globalEmotesRequest;
}

async function readEmoteCache(key) {
    try { return (await chrome.storage.local.get(key))?.[key]; }
    catch { return null; }
}

function saveChannelEmoteCache(channel, providers, twitchId, writeCatalog) {
    // Keep only in-flight catalogs in worker memory; read one channel from storage on demand.
    channelEmoteWrites = channelEmoteWrites.catch(() => {}).then(async () => {
        const index = Object.assign(Object.create(null), await readEmoteCache(CHANNEL_EMOTE_CACHE_INDEX));
        delete index[channel]; index[channel] = Date.now();
        const expired = Object.keys(index).reverse().sort((a, b) => index[b] - index[a]).slice(10);
        for (const name of expired) delete index[name];
        const values = { [CHANNEL_EMOTE_CACHE_INDEX]: index };
        if (writeCatalog) {
            const packed = Object.fromEntries(Object.entries(providers).map(([provider, value]) => [provider, {
                refreshAt: value.refreshAt, emotes: value.emotes.map(emote => [emote.code, emote.url])
            }]));
            values[CHANNEL_EMOTE_CACHE_PREFIX + channel] = { providers: packed, twitchId };
        }
        await chrome.storage.local.set(values);
        await chrome.storage.local.remove([...expired.map(name => CHANNEL_EMOTE_CACHE_PREFIX + name), 'ypft_channel_emotes_v1']);
    });
    return channelEmoteWrites;
}

async function resolveTwitchId(channel) {
    // Only needed when FFZ has no room record. Query public identity, without login credentials.
    const data = await fetchEmoteData('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: { 'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query YPFTChannel($login: String!) { user(login: $login) { id } }', variables: { login: channel } })
    });
    const id = data?.data?.user?.id;
    if (!/^\d+$/.test(String(id || ''))) throw new Error('Twitch channel unavailable');
    return String(id);
}

function getChannelEmotes(value) {
    if (typeof value !== 'string' || !/^[a-z0-9_]{1,25}$/i.test(value)) {
        return Promise.resolve({ emotes: [], error: 'Invalid Twitch channel.' });
    }
    const channel = value.toLowerCase();
    if (channelEmoteRequests.has(channel)) return channelEmoteRequests.get(channel);
    const request = (async () => {
        const previous = await readEmoteCache(CHANNEL_EMOTE_CACHE_PREFIX + channel) || {};
        const providers = Object.fromEntries(Object.keys(EMOTE_PROVIDERS).flatMap(provider => {
            const value = previous.providers?.[provider];
            return Array.isArray(value?.emotes) ? [[provider, { refreshAt: value.refreshAt,
                emotes: value.emotes.slice(0, 2000).filter(emote => Array.isArray(emote) && emote.length === 2)
                    .map(([code, url]) => ({ code, url, provider })) }]] : [];
        }));
        const fresh = provider => Array.isArray(providers[provider]?.emotes) &&
            providers[provider].refreshAt > Date.now() && providers[provider].refreshAt <= Date.now() + CHANNEL_EMOTE_CACHE_TTL;
        let twitchId = /^\d+$/.test(previous.twitchId || '') ? previous.twitchId : null;
        const changed = !twitchId || Object.keys(EMOTE_PROVIDERS).some(provider => !fresh(provider));
        let room, roomError;
        if (!fresh('FrankerFaceZ') || !twitchId) {
            try {
                room = await fetchEmoteData(`https://api.frankerfacez.com/v1/room/${channel}`);
                if (/^\d+$/.test(String(room?.room?.twitch_id || ''))) twitchId = String(room.room.twitch_id);
            } catch (error) { roomError = error; }
        }
        const identity = twitchId ? Promise.resolve(twitchId) : resolveTwitchId(channel);
        await Promise.all(Object.keys(EMOTE_PROVIDERS).map(async provider => {
            if (fresh(provider)) return;
            const old = providers[provider];
            try {
                let data;
                if (provider === 'FrankerFaceZ') {
                    if (roomError) throw roomError;
                    // Only the channel's assigned set; never unrelated or personal sets.
                    data = { default_sets: room?.room?.set ? [room.room.set] : [], sets: room?.sets || {} };
                } else {
                    const id = await identity;
                    if (provider === 'BetterTTV') {
                        const user = await fetchEmoteData(`https://api.betterttv.net/3/cached/users/twitch/${id}`);
                        data = [...(user?.channelEmotes || []), ...(user?.sharedEmotes || [])];
                    } else {
                        const user = await fetchEmoteData(`https://7tv.io/v3/users/twitch/${id}`);
                        data = user?.emote_set || { emotes: [] };
                    }
                }
                providers[provider] = { emotes: parseEmoteCatalog(provider, data), refreshAt: Date.now() + CHANNEL_EMOTE_CACHE_TTL };
            } catch {
                providers[provider] = { emotes: Array.isArray(old?.emotes) ? old.emotes : [], refreshAt: Date.now() + EMOTE_RETRY_DELAY };
            }
        }));
        // Consume identity failure even if all ID-based catalogs were already fresh.
        twitchId = await identity.catch(() => null);
        try { await saveChannelEmoteCache(channel, providers, twitchId, changed); } catch {}
        return { emotes: Object.keys(EMOTE_PROVIDERS).flatMap(provider => providers[provider].emotes),
            refreshAt: Math.min(...Object.keys(EMOTE_PROVIDERS).map(provider => providers[provider].refreshAt)) };
    })().finally(() => { channelEmoteRequests.delete(channel); });
    channelEmoteRequests.set(channel, request);
    return request;
}

function getStreamsPageUrl(channelUrl) {
    try {
        const url = new URL(channelUrl);
        const hostname = url.hostname.toLowerCase();
        if (url.protocol !== 'https:' || url.username || url.password || url.port ||
            !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(hostname)) {
            return null;
        }

        // Do not accidentally search YouTube's home page, a video, or a playlist.
        const path = url.pathname.replace(/\/(streams?|videos|shorts|playlists|community|about|live)\/?$/i, '').replace(/\/+$/, '');
        if (!path || /^\/(watch|shorts|embed|live|playlist)(\/|$)/i.test(path)) return null;

        url.hostname = 'www.youtube.com';
        url.pathname = `${path}/streams`;
        url.search = '';
        url.hash = '';
        return url.href;
    } catch (err) {
        return null;
    }
}

function parseInitialData(html, name = 'ytInitialData') {
    const assignments = new RegExp(`(?:\\b${name}|window\\[["']${name}["']\\])\\s*=\\s*`, 'g');
    let match;

    while ((match = assignments.exec(html))) {
        const start = html.indexOf('{', assignments.lastIndex);
        if (start < 0) continue;

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < html.length; i++) {
            const character = html[i];

            if (inString) {
                if (escaped) escaped = false;
                else if (character === '\\') escaped = true;
                else if (character === '"') inString = false;
                continue;
            }

            if (character === '"') inString = true;
            else if (character === '{') depth++;
            else if (character === '}' && --depth === 0) {
                try {
                    return JSON.parse(html.slice(start, i + 1));
                } catch (err) {
                    break;
                }
            }
        }
    }

    return null;
}

function collectVideoRenderers(value, results = []) {
    if (Array.isArray(value)) {
        for (const item of value) collectVideoRenderers(item, results);
    } else if (value && typeof value === 'object') {
        if (value.videoRenderer && typeof value.videoRenderer === 'object') {
            results.push(value.videoRenderer);
        } else {
            for (const item of Object.values(value)) collectVideoRenderers(item, results);
        }
    }
    return results;
}

function isLiveVideo(video) {
    const hasLiveBadge = (video.badges || []).some(badge => {
        const renderer = badge.metadataBadgeRenderer || {};
        return /\bLIVE(?:\s+NOW)?\b/i.test(renderer.label || '') ||
            String(renderer.style || '').includes('LIVE_NOW');
    });

    const hasLiveOverlay = (video.thumbnailOverlays || []).some(overlay => {
        const renderer = overlay.thumbnailOverlayTimeStatusRenderer || {};
        const text = renderer.text || {};
        const visibleText = text.simpleText || (text.runs || []).map(run => run.text || '').join('');
        const accessibilityLabel = renderer.accessibility?.accessibilityData?.label || '';
        return renderer.style === 'LIVE' ||
            /\bLIVE(?:\s+NOW)?\b/i.test(`${visibleText} ${accessibilityLabel}`);
    });

    return video.isLive === true || video.isLiveNow === true || hasLiveBadge || hasLiveOverlay;
}

function getText(value) {
    if (value?.simpleText) return value.simpleText;
    if (Array.isArray(value?.runs)) return value.runs.map(run => run.text || '').join('');
    return '';
}

async function fetchYouTubePage(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error(`YouTube returned HTTP ${response.status}`);
        return await response.text();
    } catch (error) {
        if (controller.signal.aborted) throw new Error('YouTube took too long to respond. Try again.');
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

const validVideoId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value);

function findLiveChannelStream(data) {
    const video = collectVideoRenderers(data).find(video => validVideoId(video.videoId) && isLiveVideo(video));
    if (!video) return null;

    const channel = getText(video.ownerText) || getText(video.shortBylineText) || 'YouTube Channel';
    return {
        videoId: video.videoId,
        title: getText(video.title) || video.videoId,
        channel,
        isLive: true
    };
}

async function handleChannelSearch(channelUrl) {
    const streamsUrl = getStreamsPageUrl(channelUrl);
    if (!streamsUrl) return { error: 'Invalid YouTube channel URL' };

    try {
        const data = parseInitialData(await fetchYouTubePage(streamsUrl));
        if (!data) return { error: 'Could not parse YouTube channel streams' };

        const stream = findLiveChannelStream(data);
        return { results: stream ? [stream] : [] };
    } catch (err) {
        console.error('Channel search error:', err);
        return { error: err.message };
    }
}

async function handleVideoDetails(videoId) {
    if (!validVideoId(videoId)) return { error: 'Invalid YouTube video ID' };
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const html = await fetchYouTubePage(url);

        const details = parseInitialData(html, 'ytInitialPlayerResponse')?.videoDetails;
        if (details) {
            return { title: details.title, channel: details.author, videoId };
        }

        // Fallback to title tag if JSON parsing fails
        const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/);
        if (titleMatch) {
            return {
                title: titleMatch[1],
                channel: 'YouTube Stream', // Best guess fallback
                videoId: videoId
            };
        }

        return { error: 'Could not parse video details' };
    } catch (err) {
        console.error('Details error:', err);
        return { error: err.message };
    }
}

async function handleSearch(query) {
    if (typeof query !== 'string' || !query.trim() || query.length > 200) return { error: 'Invalid search query' };
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgJAAQ%3D%3D`;
        const html = await fetchYouTubePage(searchUrl);

        const data = parseInitialData(html);
        if (!data) return { error: 'Could not parse YouTube results' };

        const seen = new Set();
        const results = collectVideoRenderers(data)
            .filter(video => {
                if (!validVideoId(video.videoId) || !isLiveVideo(video) || seen.has(video.videoId)) return false;
                seen.add(video.videoId);
                return true;
            })
            .map(video => ({
                videoId: video.videoId,
                title: getText(video.title),
                channel: getText(video.ownerText) || getText(video.shortBylineText),
                isLive: true
            }));

        return { results };

    } catch (err) {
        console.error('Search error:', err);
        return { error: err.message };
    }
}

// VAFT is registered before navigation, never injected late into a running player.
const VAFT_KEY = 'ytot_vaft_enabled';
const VAFT_SCRIPT = {
    id: 'ypft-vaft',
    matches: ['https://www.twitch.tv/*'],
    js: ['vaft-main.js', 'vendor/vaft/vaft.js'],
    runAt: 'document_start',
    world: 'MAIN',
    allFrames: false,
    persistAcrossSessions: true
};
let vaftQueue = Promise.resolve();
function queueVaft(operation) {
    const result = vaftQueue.then(operation);
    vaftQueue = result.catch(() => {});
    return result;
}
async function applyVaftRegistration(enabled) {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [VAFT_SCRIPT.id] });
    if (enabled) {
        if (scripts.length) await chrome.scripting.updateContentScripts([VAFT_SCRIPT]);
        else await chrome.scripting.registerContentScripts([VAFT_SCRIPT]);
    } else if (scripts.length) {
        await chrome.scripting.unregisterContentScripts({ ids: [VAFT_SCRIPT.id] });
    }
}
async function reconcileVaft() {
    const stored = await chrome.storage.local.get(VAFT_KEY);
    const enabled = stored[VAFT_KEY] === true;
    await applyVaftRegistration(enabled);
    return { enabled, registered: enabled };
}
async function setVaft(enabled) {
    const stored = await chrome.storage.local.get(VAFT_KEY);
    const previous = stored[VAFT_KEY] === true;
    try {
        await applyVaftRegistration(enabled);
        await chrome.storage.local.set({ [VAFT_KEY]: enabled });
    } catch (error) {
        // Do not acknowledge/reload a change that failed to persist.
        try { await applyVaftRegistration(previous); }
        catch (rollbackError) { console.error('VAFT registration rollback failed:', rollbackError); }
        throw error;
    }
    return { enabled, registered: enabled, reloadRequired: true };
}
function wakeVaft() {
    return queueVaft(reconcileVaft).catch(error => console.error('VAFT reconciliation failed:', error));
}
// Optional chaining only supports the old background test harness; real Chrome has these APIs.
chrome.runtime.onInstalled?.addListener(wakeVaft);
chrome.runtime.onStartup?.addListener(wakeVaft);
chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes[VAFT_KEY]) return wakeVaft();
});
if (chrome.scripting) wakeVaft();
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!['GET_VAFT_SETTINGS', 'SET_VAFT_SETTINGS'].includes(request?.type)) return;
    // No page-message bridge, fetch proxy, external messages, or iframe controls.
    const url = sender.url || sender.tab?.url;
    if (sender.id !== chrome.runtime.id || sender.frameId !== 0 ||
        !/^https:\/\/www\.twitch\.tv\//.test(url || '')) {
        sendResponse({ error: 'VAFT settings are only available on Twitch.' });
        return;
    }
    if (request.type === 'SET_VAFT_SETTINGS' && typeof request.enabled !== 'boolean') {
        sendResponse({ error: 'Invalid VAFT preference.' });
        return;
    }
    queueVaft(() => request.type === 'SET_VAFT_SETTINGS' ? setVaft(request.enabled) : reconcileVaft())
        .then(sendResponse, error => sendResponse({ error: error.message }));
    return true;
});
