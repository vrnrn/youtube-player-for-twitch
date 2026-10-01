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
        URL,
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
                makeVideo('live-video-1', { title: 'Playing now', badge: { label: 'LIVE NOW', style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }),
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
        videoId: 'live-video-1',
        title: 'Playing now',
        channel: 'Creator',
        isLive: true
    });
});

test('linked-channel lookup recognizes YouTube LIVE badges in initial data assignments', async () => {
    const sendMessage = createBackground(async () => ({
        ok: true,
        text: async () => makePage([
            makeVideo('live-video-2', { overlay: { style: 'LIVE', text: { simpleText: 'LIVE' } } })
        ], 'window["ytInitialData"]')
    }));

    const response = await sendMessage({
        type: 'SEARCH_YOUTUBE_CHANNEL',
        channelUrl: 'https://www.youtube.com/channel/UCexample'
    });

    assert.equal(response.results[0].videoId, 'live-video-2');
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
