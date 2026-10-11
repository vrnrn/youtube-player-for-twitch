const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const backgroundScript = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function makeVideo(videoId, { title = 'Stream title', channel = 'Creator', badge = null, overlay = null } = {}) {
    return {
        videoRenderer: {
            videoId,
            title: { simpleText: title },
            ownerText: { runs: [{ text: channel }] },
            ...(badge ? { badges: [{ metadataBadgeRenderer: badge }] } : {}),
            ...(overlay ? { thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: overlay }] } : {})
        }
    };
}

function makePage(contents, assignment = 'var ytInitialData') {
    const data = {
        contents: {
            twoColumnBrowseResultsRenderer: {
                tabs: [{
                    tabRenderer: {
                        content: {
                            richGridRenderer: {
                                contents: contents.map(content => ({ richItemRenderer: { content } }))
                            }
                        }
                    }
                }]
            }
        }
    };
    const lhs = assignment === 'var ytInitialData' ? assignment : `window["ytInitialData"]`;
    return `<script>${lhs} = ${JSON.stringify(data)};</script>`;
}

function createBackground(fetchImpl, stored = {}) {
    const messageListeners = [];
    vm.runInNewContext(backgroundScript, {
        chrome: {
            storage: { local: {
                async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in stored).map(key => [key, stored[key]])); },
                async set(values) { Object.assign(stored, values); },
                async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key]; }
            } },
            runtime: {
                onMessage: {
                    addListener(listener) { messageListeners.push(listener); }
                }
            }
        },
        fetch: fetchImpl,
        URL, AbortController, setTimeout, clearTimeout,
        console: { error() {}, log() {}, warn() {} }
    }, { filename: 'background.js' });

    assert.ok(messageListeners.length, 'background script should register its message listeners');
    return request => new Promise((resolve, reject) => {
        try {
            const keepsChannelOpen = messageListeners.some(listener => listener(request, {}, resolve) === true);
            assert.equal(keepsChannelOpen, true, 'async message should keep the response channel open');
        } catch (error) {
            reject(error);
        }
    });
}

const globalCatalogs = {
    'https://api.betterttv.net/3/cached/emotes/global': [
        { id: '56e9f494fff3cc5c35e5287e', code: 'monkaS' },
        { id: '6468f7acaee1f7f47567708e', code: 'c!', modifier: true },
        { id: '../bad', code: 'unsafe' }
    ],
    'https://api.frankerfacez.com/v1/set/global': { default_sets: [3], sets: {
        3: { emoticons: [{ name: 'OMEGALUL', urls: { 2: '//cdn.frankerfacez.com/emote/128054/2' } },
            { name: 'bad', urls: { 2: 'https://evil.test/emote' } }] },
        4: { emoticons: [{ name: 'PrivateEmote', urls: { 2: '//cdn.frankerfacez.com/emote/1/2' } }] }
    } },
    'https://7tv.io/v3/emote-sets/global': { emotes: [{ name: 'reckH', data: {
        host: { url: '//cdn.7tv.app/emote/test', files: [{ name: '../bad' }, { name: '2x.webp' }] }
    } }] }
};
test('global catalogs normalize provider formats, exclude private sets and unsafe URLs, and cache across tabs and worker restarts', async () => {
    const stored = {}, calls = [];
    const fetch = async (url, options) => {
        calls.push(url); assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer');
        return { ok: true, json: async () => globalCatalogs[url] };
    };
    const send = createBackground(fetch, stored);
    const [first, second] = await Promise.all([send({ type: 'GET_GLOBAL_EMOTES' }), send({ type: 'GET_GLOBAL_EMOTES' })]);
    assert.deepEqual(Array.from(first.emotes, e => e.code), ['monkaS', 'OMEGALUL', 'reckH']);
    assert.deepEqual(first, second); assert.equal(calls.length, 3);
    assert.equal(first.emotes[1].url, 'https://cdn.frankerfacez.com/emote/128054/2');
    await createBackground(fetch, stored)({ type: 'GET_GLOBAL_EMOTES' });
    assert.equal(calls.length, 3);
});
test('one provider outage leaves the others available and retains a previous catalog until a later retry', async () => {
    const stored = { ypft_global_emotes_v1: { BetterTTV: {
        emotes: [{ code: 'cached', provider: 'BetterTTV', url: 'https://cdn.betterttv.net/emote/test/2x' }], refreshAt: 0
    } } };
    let calls = 0;
    const send = createBackground(async url => {
        calls++;
        if (url.includes('betterttv')) throw new Error('offline');
        return { ok: true, json: async () => globalCatalogs[url] };
    }, stored);
    const result = await send({ type: 'GET_GLOBAL_EMOTES' });
    assert.deepEqual(Array.from(result.emotes, e => e.code), ['cached', 'OMEGALUL', 'reckH']);
    assert.ok(stored.ypft_global_emotes_v1.BetterTTV.refreshAt > Date.now());
    await send({ type: 'GET_GLOBAL_EMOTES' }); assert.equal(calls, 3);
});

const channelCatalogs = {
    'https://api.frankerfacez.com/v1/room/valkyrae': { room: { twitch_id: 79615025, set: 99 }, sets: {
        99: { emoticons: [{ name: 'FFZanim', animated: { 2: '//cdn.frankerfacez.com/emote/7/animated/2' }, urls: { 2: '//cdn.frankerfacez.com/emote/7/2' } }] },
        100: { emoticons: [{ name: 'Unassigned', urls: { 2: '//cdn.frankerfacez.com/emote/8/2' } }] }
    } },
    'https://api.betterttv.net/3/cached/users/twitch/79615025': {
        channelEmotes: [{ id: '56e9f494fff3cc5c35e5287e', code: 'Own' }],
        sharedEmotes: [{ id: '6468f7acaee1f7f47567708e', code: 'Shared' }]
    },
    'https://7tv.io/v3/users/twitch/79615025': { emote_set: { emotes: [{ name: 'om', data: {
        name: 'original-name', animated: true, owner: { username: 'do-not-store' },
        host: { url: '//cdn.7tv.app/emote/01GEB3PA5R00067J91VAZ57B7F', files: [
            { name: '2x_static.webp', frame_count: 1 }, { name: '2x.webp', frame_count: 8 }
        ] }
    } }] } }
};
test('channel sets include owned/shared BTTV, assigned FFZ and animated 7TV aliases; requests and persistent cache are shared', async () => {
    const stored = {}, calls = [];
    const fetch = async (url, options) => {
        calls.push(url); assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer');
        return { ok: true, json: async () => channelCatalogs[url] };
    };
    const send = createBackground(fetch, stored);
    const [first, second] = await Promise.all([
        send({ type: 'GET_CHANNEL_EMOTES', channel: 'Valkyrae' }), send({ type: 'GET_CHANNEL_EMOTES', channel: 'valkyrae' })
    ]);
    assert.deepEqual(first, second); assert.equal(calls.length, 3);
    assert.deepEqual(Array.from(first.emotes, e => e.code), ['Own', 'Shared', 'FFZanim', 'om']);
    assert.equal(first.emotes[2].url, 'https://cdn.frankerfacez.com/emote/7/animated/2');
    assert.equal(first.emotes[3].url, 'https://cdn.7tv.app/emote/01GEB3PA5R00067J91VAZ57B7F/2x.webp');
    assert.ok(!JSON.stringify(stored).includes('do-not-store'));
    assert.ok(!JSON.stringify(stored).includes('Unassigned'));
    await createBackground(fetch, stored)({ type: 'GET_CHANNEL_EMOTES', channel: 'valkyrae' });
    assert.equal(calls.length, 3);
});
test('a channel without FFZ resolves its public Twitch ID and still loads 7TV; missing provider accounts are empty sets', async () => {
    const calls = [];
    const send = createBackground(async (url, options) => {
        calls.push(url);
        assert.equal(options.credentials, 'omit');
        if (url === 'https://gql.twitch.tv/gql') {
            assert.equal(options.method, 'POST');
            const body = JSON.parse(options.body);
            assert.deepEqual(body.variables, { login: 'valkyrae' });
            assert.match(body.query, /user\(login: \$login\) \{ id \}/);
            return { ok: true, json: async () => ({ data: { user: { id: '79615025' } } }) };
        }
        if (url.includes('7tv.io')) return { ok: true, json: async () => channelCatalogs[url] };
        return { ok: false, status: 404 };
    });
    const result = await send({ type: 'GET_CHANNEL_EMOTES', channel: 'valkyrae' });
    assert.deepEqual(Array.from(result.emotes, e => e.code), ['om']);
    assert.equal(calls.length, 4);
});
test('invalid channel input never fetches and one channel provider outage retains its previous emotes for retry', async () => {
    const stored = { ypft_channel_emotes_v2_valkyrae: { twitchId: '79615025', providers: {
        '7TV': { emotes: [['om', 'https://cdn.7tv.app/emote/test/2x.webp']], refreshAt: 0 }
    } } };
    const calls = [];
    const send = createBackground(async url => {
        calls.push(url);
        if (url.includes('7tv.io')) throw new Error('offline');
        return { ok: true, json: async () => channelCatalogs[url] };
    }, stored);
    for (const channel of [null, '', '../valkyrae', 'a/b', 'x'.repeat(26), 'https://evil.test']) {
        assert.ok((await send({ type: 'GET_CHANNEL_EMOTES', channel })).error);
    }
    assert.equal(calls.length, 0);
    const result = await send({ type: 'GET_CHANNEL_EMOTES', channel: 'valkyrae' });
    assert.deepEqual(Array.from(result.emotes, e => e.code), ['Own', 'Shared', 'FFZanim', 'om']);
    await send({ type: 'GET_CHANNEL_EMOTES', channel: 'valkyrae' });
    assert.equal(calls.length, 3);
    assert.ok(result.refreshAt <= Date.now() + 5 * 60 * 1000);
});
test('channel caches stay isolated and only ten recent channels are retained', async () => {
    const stored = {};
    const send = createBackground(async url => ({ ok: true, json: async () => {
        if (url.includes('/room/')) return { room: { twitch_id: 79615025, set: 99 }, sets: {
            99: { emoticons: [{ name: url.split('/').pop(), urls: { 2: '//cdn.frankerfacez.com/emote/7/2' } }] }
        } };
        if (url.includes('betterttv')) return { channelEmotes: [], sharedEmotes: [] };
        return { emote_set: { emotes: [] } };
    } }), stored);
    for (let i = 0; i < 12; i++) {
        const channel = `channel${i}`;
        const result = await send({ type: 'GET_CHANNEL_EMOTES', channel });
        assert.deepEqual(Array.from(result.emotes, e => e.code), [channel]);
    }
    assert.equal(Object.keys(stored.ypft_channel_emotes_index_v2).length, 10);
    assert.equal(Object.keys(stored).filter(key => key.startsWith('ypft_channel_emotes_v2_')).length, 10);
    assert.ok(stored.ypft_channel_emotes_v2_channel11);
    assert.ok(!stored.ypft_channel_emotes_v2_channel0);
});

test('cached channel reads load only the requested catalog and preserve compact storage without rewriting it', async () => {
    const providers = Object.fromEntries(['BetterTTV', 'FrankerFaceZ', '7TV'].map(provider => [provider, {
        refreshAt: Date.now() + 20 * 60 * 1000,
        emotes: provider === '7TV' ? [['om', 'https://cdn.7tv.app/emote/test/2x.webp']] : []
    }]));
    const cached = { twitchId: '79615025', providers }, reads = [], writes = [];
    const stored = new Proxy({ ypft_channel_emotes_v2_valkyrae: cached,
        ypft_channel_emotes_v2_other: cached, ypft_channel_emotes_index_v2: { valkyrae: 1, other: 2 } }, {
        get(target, key) { reads.push(key); return target[key]; },
        set(target, key, value) { writes.push(key); target[key] = value; return true; }
    });
    const send = createBackground(async () => { throw new Error('Fresh cache must not fetch'); }, stored);
    const result = await send({ type: 'GET_CHANNEL_EMOTES', channel: 'valkyrae' });
    assert.deepEqual(Array.from(result.emotes, emote => emote.code), ['om']);
    assert.ok(reads.includes('ypft_channel_emotes_v2_valkyrae'));
    assert.ok(!reads.includes('ypft_channel_emotes_v2_other'));
    assert.deepEqual(writes, ['ypft_channel_emotes_index_v2']);
    assert.equal(stored.ypft_channel_emotes_v2_valkyrae, cached);
});

test('linked-channel lookup fetches the normalized /streams page and returns a live video', async () => {
    let requestedUrl;
    let requestOptions;
    const sendMessage = createBackground(async (url, options) => {
        requestedUrl = url;
        requestOptions = options;
        return {
            ok: true,
            text: async () => makePage([
                makeVideo('scheduled123', { overlay: { style: 'DEFAULT', text: { simpleText: 'Starting soon' } } }),
                makeVideo('live-video1', { title: 'Playing now', badge: { label: 'LIVE NOW', style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }),
                makeVideo('archive12345')
            ])
        };
    });

    const response = await sendMessage({
        type: 'SEARCH_YOUTUBE_CHANNEL',
        channelUrl: 'https://m.youtube.com/@somecreator/?si=tracking#about'
    });

    assert.equal(requestedUrl, 'https://www.youtube.com/@somecreator/streams');
    assert.equal(requestOptions.credentials, 'omit');
    assert.equal(response.results.length, 1);
    assert.deepEqual({ ...response.results[0] }, {
        videoId: 'live-video1',
        title: 'Playing now',
        channel: 'Creator',
        isLive: true
    });
});

test('linked-channel lookup recognizes YouTube LIVE badges in initial data assignments', async () => {
    const sendMessage = createBackground(async () => ({
        ok: true,
        text: async () => makePage([
            makeVideo('live-video2', { overlay: { style: 'LIVE', text: { simpleText: 'LIVE' } } })
        ], 'window["ytInitialData"]')
    }));

    const response = await sendMessage({
        type: 'SEARCH_YOUTUBE_CHANNEL',
        channelUrl: 'https://www.youtube.com/channel/UCexample'
    });

    assert.equal(response.results[0].videoId, 'live-video2');
});

test('linked-channel lookup ignores pages that show no active livestream', async () => {
    const sendMessage = createBackground(async () => ({
        ok: true,
        text: async () => makePage([
            makeVideo('replay-video1', { title: 'Yesterday’s stream' }),
            makeVideo('upcoming1234', { overlay: { style: 'DEFAULT', text: { simpleText: 'Starts in 2 hours' } } })
        ])
    }));

    const response = await sendMessage({
        type: 'SEARCH_YOUTUBE_CHANNEL',
        channelUrl: 'https://www.youtube.com/@somecreator'
    });

    assert.equal(response.results.length, 0);
});

test('linked-channel lookup rejects non-YouTube and non-HTTPS URLs before fetching', async () => {
    let fetchCount = 0;
    const sendMessage = createBackground(async () => {
        fetchCount++;
        return { ok: true, text: async () => '' };
    });

    const responses = await Promise.all([
        sendMessage({ type: 'SEARCH_YOUTUBE_CHANNEL', channelUrl: 'https://youtube.com.attacker.example/@creator' }),
        sendMessage({ type: 'SEARCH_YOUTUBE_CHANNEL', channelUrl: 'http://www.youtube.com/@creator' }),
        sendMessage({ type: 'SEARCH_YOUTUBE_CHANNEL', channelUrl: 'https://www.youtube.com/watch?v=123' })
    ]);

    assert.equal(fetchCount, 0);
    assert.ok(responses.every(response => Boolean(response.error)));
});

test('video details tolerate multiline JSON, escaped quotes and semicolons in titles', async () => {
    const title = 'A "quoted" stream }; and a new line\npart two';
    const html = `<script>window['ytInitialPlayerResponse'] = ${JSON.stringify({ videoDetails: { title, author: 'Creator' } }, null, 2)};</script>`;
    const send = createBackground(async () => ({ ok: true, text: async () => html }));
    const result = await send({ type: 'GET_VIDEO_DETAILS', videoId: 'abcdefghijk' });
    assert.equal(result.title, title);
    assert.equal(result.channel, 'Creator');
});

test('search validates inputs and deduplicates live results', async () => {
    let requests = 0;
    const send = createBackground(async () => {
        requests++;
        return { ok: true, text: async () => makePage([
            makeVideo('abcdefghijk', { badge: { label: 'LIVE' } }),
            makeVideo('abcdefghijk', { badge: { label: 'LIVE' } }),
            makeVideo('bad" id', { badge: { label: 'LIVE' } }),
            makeVideo('archived123')
        ]) };
    });
    for (const videoId of ['', null, 'abcdefghijk&extra=1', 'abcdefghijkz'])
        assert.ok((await send({ type: 'GET_VIDEO_DETAILS', videoId })).error);
    for (const query of [null, '', ' ', 'x'.repeat(201)])
        assert.ok((await send({ type: 'SEARCH_YOUTUBE', query })).error);
    assert.equal(requests, 0);
    const result = await send({ type: 'SEARCH_YOUTUBE', query: 'creator' });
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].videoId, 'abcdefghijk');
});

test('YouTube timeout aborts the body read and releases the timer', async () => {
    const listeners = [], timers = new Map();
    vm.runInNewContext(backgroundScript, {
        chrome: { runtime: { onMessage: { addListener: fn => listeners.push(fn) } } },
        URL, AbortController, console: { error() {} },
        setTimeout(fn) { timers.set(1, fn); return 1; }, clearTimeout(id) { timers.delete(id); },
        fetch: async (url, { signal }) => ({ ok: true, text: () => new Promise((resolve, reject) => {
            if (signal.aborted) reject(new Error('Aborted'));
            else signal.addEventListener('abort', () => reject(new Error('Aborted')));
        }) })
    });
    const response = new Promise(resolve => listeners[0]({ type: 'GET_VIDEO_DETAILS', videoId: 'abcdefghijk' }, {}, resolve));
    await Promise.resolve();
    timers.get(1)();
    assert.match((await response).error, /too long/);
    assert.equal(timers.size, 0);
});
