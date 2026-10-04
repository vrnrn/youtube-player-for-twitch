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

function createBackground(fetchImpl) {
    const messageListeners = [];
    vm.runInNewContext(backgroundScript, {
        chrome: {
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
