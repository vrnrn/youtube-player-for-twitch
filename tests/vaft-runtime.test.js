const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const adapter = fs.readFileSync(`${__dirname}/../vendor/vaft/vaft.js`, 'utf8');
const guard = fs.readFileSync(`${__dirname}/../vaft-main.js`, 'utf8');
function runtime({ owned = false, paused = false, conflict = false, fetchImpl } = {}) {
    const attrs = new Map(), listeners = new Map(), blobs = new Map(), revoked = [], calls = [], timers = new Map();
    let nextTimer = 1;
    const video = { paused, ended: false };
    const player = { core: { state: { path: null, paused, volume: 0.4, muted: true, quality: { group: 'chunked' } } },
        isPaused: () => video.paused, getHTMLVideoElement: () => video,
        pause() { calls.push('pause'); }, play() { calls.push('play'); }, getState: () => 'Playing', getBufferDuration: () => 1 };
    const playerState = { props: { content: { type: 'live' } }, setSrc() { calls.push('reload'); }, setInitialPlaybackSettings() {} };
    const root = { _reactRootContainer: { _internalRoot: { current: { child: {
        stateNode: { setPlayerActive() {}, props: { mediaPlayerInstance: player } },
        sibling: { stateNode: playerState }
    } } } } };
    class FakeWorker {
        constructor(url, options) { this.url = url; this.options = options; this.events = new Map(); this.messages = []; }
        addEventListener(name, fn) { const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list); }
        emit(name, data) { for (const fn of this.events.get(name) || []) fn({ data }); }
        postMessage(data) { this.messages.push(data); }
        terminate() { this.terminated = true; }
    }
    const store = new Map([['video-quality', '{"default":"chunked"}'], ['video-muted', '{"default":true}'], ['volume', '0.4']]);
    const URLMock = class extends URL {
        static createObjectURL(blob) { const id = `blob:https://www.twitch.tv/adapter-${blobs.size}`; blobs.set(id, blob); return id; }
        static revokeObjectURL(id) { revoked.push(id); }
    };
    const context = vm.createContext({
        document: {
            readyState: 'complete', documentElement: { setAttribute(k, v) { attrs.set(k, v); }, getAttribute(k) { return attrs.get(k); } },
            querySelector: selector => selector === '#root' ? root : null,
            addEventListener(name, fn) { listeners.set(name, fn); }
        }, location: { origin: 'https://www.twitch.tv', href: 'https://www.twitch.tv/test' },
        Worker: FakeWorker, URL: URLMock, Blob, Headers, Response, Request, AbortController,
        localStorage: { getItem(k) { return store.get(k) ?? null; }, setItem(k, v) { store.set(k, String(v)); } },
        fetch: fetchImpl || ((url, init) => { calls.push({ url, init }); return Promise.resolve(new Response('pass')); }),
        console: { log() {}, error() {} },
        setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
        addEventListener(name, fn) { listeners.set(name, fn); },
        Function: { prototype: { toString: { call() { return 'function Worker() { [native code] }'; } } } }
    });
    context.window = context;
    context.top = context;
    if (conflict) context.twitchAdSolutionsVersion = 1;
    if (owned) attrs.set('data-ypft-playback', 'youtube');
    vm.runInContext(guard, context);
    // Expose internal tasks solely for deterministic extension unit tests.
    const instrumented = adapter.replace('    declareOptions(window);', '    window.testTasks = { doTwitchPlayerTask, hookWorkerFetch, processM3U8, parseAttributes, handleWorkerFetchRequest };\n    declareOptions(window);');
    vm.runInContext(instrumented, context);
    return { context, attrs, listeners, calls, blobs, revoked, timers, store, player, playerState, video, FakeWorker };
}
test('installed hooks are idempotent and an existing VAFT of any version is skipped', () => {
    const f = runtime();
    const worker = f.context.Worker, fetch = f.context.fetch;
    vm.runInContext(guard, f.context);
    vm.runInContext(adapter, f.context);
    assert.equal(f.context.Worker, worker);
    assert.equal(f.context.fetch, fetch);
    assert.equal(f.attrs.get('data-ypft-vaft'), 'hooks-ready');
    const conflict = runtime({ conflict: true });
    assert.equal(conflict.context.Worker, conflict.FakeWorker);
    assert.equal(conflict.attrs.get('data-ypft-vaft'), 'conflict');
    assert.equal(conflict.context.twitchAdSolutionsVersion, 1);
});
test('MAIN guard skips unrelated Worker wrappers and has no Chrome API bridge', () => {
    const f = runtime();
    assert.equal(f.context.chrome, undefined);
    assert.equal(f.listeners.has('message'), false);
    const isolated = { document: f.context.document, location: f.context.location, Worker: class CustomWorker {}, fetch() {} };
    isolated.window = isolated; isolated.top = isolated;
    const before = isolated.Worker;
    vm.runInNewContext(guard, isolated);
    assert.equal(isolated.Worker, before);
    assert.equal(f.attrs.get('data-ypft-vaft'), 'conflict');
});
test('YouTube URLs, init objects, Request inputs and unrelated workers pass through untouched', async () => {
    const f = runtime();
    const init = { headers: { Authorization: 'youtube-token' }, body: 'PlaybackAccessToken' };
    const url = 'https://www.youtube.com/gql?m3u8=1';
    await f.context.fetch(url, init);
    assert.equal(f.calls.at(-1).url, url);
    assert.equal(f.calls.at(-1).init, init);
    assert.equal(init.body, 'PlaybackAccessToken');
    const request = new Request('https://www.youtube.com/api');
    await f.context.fetch(request);
    assert.equal(f.calls.at(-1).url, request);
    const options = { type: 'module' };
    const worker = new f.context.Worker('https://www.youtube.com/worker.js', options);
    assert.equal(worker.url, 'https://www.youtube.com/worker.js');
    assert.equal(worker.options, options);
    assert.equal(f.blobs.size, 0);
    const spoof = new f.context.Worker('https://www.twitch.tv.attacker.test/worker.js');
    assert.equal(spoof.url, 'https://www.twitch.tv.attacker.test/worker.js');
});
test('Twitch token hook preserves callers, accepts Headers, and safely ignores missing/malformed bodies', async () => {
    const f = runtime();
    const headers = new Headers({ 'Client-Version': "version'quoted" });
    const init = { headers, body: JSON.stringify({ operationName: 'PlaybackAccessToken', variables: { playerType: 'site' } }) };
    await f.context.fetch('https://gql.twitch.tv/gql', init);
    assert.equal(JSON.parse(f.calls.at(-1).init.body).variables.playerType, 'popout');
    assert.equal(JSON.parse(init.body).variables.playerType, 'site');
    assert.equal(f.context.ClientVersion, "version'quoted");
    await f.context.fetch('https://gql.twitch.tv/gql');
    assert.equal(f.calls.at(-1).init, undefined);
    const invalid = { body: 'PlaybackAccessToken invalid JSON' };
    await f.context.fetch('https://gql.twitch.tv/gql', invalid);
    assert.equal(f.calls.at(-1).init, invalid);
});
test('YouTube ownership suppresses ad/focus/buffering reload and resume paths; manual Twitch pause stays paused', () => {
    const f = runtime({ owned: true });
    f.context.testTasks.doTwitchPlayerTask(true, false);
    f.context.testTasks.doTwitchPlayerTask(false, true);
    const worker = new f.context.Worker('blob:https://www.twitch.tv/original');
    worker.emit('message', { key: 'ReloadPlayer' });
    worker.emit('message', { key: 'PauseResumePlayer' });
    for (const timer of [...f.timers.values()]) timer();
    assert.deepEqual(f.calls, []);
    assert.equal(f.listeners.has('visibilitychange'), false);
    assert.equal(Object.getOwnPropertyDescriptor(f.context.document, 'hidden'), undefined);
    const paused = runtime({ paused: true });
    paused.context.testTasks.doTwitchPlayerTask(false, true);
    assert.deepEqual(paused.calls, []);
    const playing = runtime();
    playing.context.testTasks.doTwitchPlayerTask(false, true);
    assert.deepEqual(playing.calls, ['reload', 'play']);
    assert.equal(playing.store.get('video-quality'), '{"default":"chunked"}');
    assert.equal(playing.store.get('volume'), '0.4');
    assert.equal(playing.store.get('video-muted'), '{"default":true}');
});
test('worker payload is valid with quoted headers, signals success/error, and releases Blob URLs', async () => {
    const f = runtime();
    await f.context.fetch('https://gql.twitch.tv/gql', { headers: { Authorization: "Bearer ' quote\\slash" } });
    const worker = new f.context.Worker('blob:https://www.twitch.tv/original');
    const payload = await f.blobs.get(worker.url).text();
    new vm.Script(payload); // Headers and source URL cannot break generated JavaScript.
    assert.match(payload, /eval\(workerString\)/);
    worker.emit('message', { key: 'YPFTVaftWorkerReady' });
    assert.equal(f.attrs.get('data-ypft-vaft'), 'worker-ready');
    assert.ok(f.revoked.includes(worker.url));
    worker.emit('error');
    worker.emit('message', { key: 'YPFTVaftWorkerReady' });
    assert.equal(f.attrs.get('data-ypft-vaft'), 'error');
    worker.terminate();
    const count = worker.messages.length;
    await f.context.fetch('https://gql.twitch.tv/gql', { headers: { Authorization: 'changed' } });
    assert.equal(worker.messages.length, count);
});
test('worker page fetch relay rejects arbitrary destinations and never exposes a privileged proxy', async () => {
    const f = runtime();
    const result = await f.context.testTasks.handleWorkerFetchRequest({ id: '1', url: 'https://www.youtube.com/', options: { method: 'POST' } });
    assert.match(result.error, /Unsupported/);
    assert.deepEqual(f.calls, []);
    const valid = await f.context.testTasks.handleWorkerFetchRequest({ id: '2', url: 'https://gql.twitch.tv/gql', options: { method: 'POST', body: '{}' } });
    assert.equal(valid.status, 200);
    assert.equal(valid.body, 'pass');
    assert.equal(f.context.realFetch, undefined);
});

async function workerRuntime(responseFor = () => new Response('#EXTM3U')) {
    const parent = runtime();
    const worker = new parent.context.Worker('blob:https://www.twitch.tv/original');
    const payload = await parent.blobs.get(worker.url).text();
    const messages = [], timers = new Map();
    const ctx = vm.createContext({ URL, Response, Headers, Request, Map, Set, console: { log() {}, error() {} },
        fetch: async (url, init) => responseFor(url, init), addEventListener() {}, postMessage: data => messages.push(data),
        setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
        XMLHttpRequest: class { open() {} overrideMimeType() {} send() { this.responseText = 'self.originalTwitchWorkerRan = true;'; this.status = 0; } }
    });
    ctx.self = ctx;
    vm.runInContext(payload, ctx);
    return { ctx, messages, timers };
}
test('bundled worker bootstraps and unrelated YouTube playlists are unchanged', async () => {
    const original = new Response('#EXTM3U\n#stitched\nyoutube-segment');
    const f = await workerRuntime(() => original);
    assert.equal(f.ctx.originalTwitchWorkerRan, true);
    assert.ok(f.messages.some(m => m.key === 'YPFTVaftWorkerReady'));
    assert.equal(await f.ctx.fetch('https://www.youtube.com/playlist.m3u8'), original);
});
test('worker playlist parse failures reject instead of leaving a hung fetch promise', async () => {
    const f = await workerRuntime(() => new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION="bad",CODECS="hvc1"\nhttps://media.ttvnw.net/bad.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1920x1080\nhttps://media.ttvnw.net/no-codecs.m3u8'));
    await assert.rejects(f.ctx.fetch('https://usher.ttvnw.net/api/channel/hls/test.m3u8?sig=original'), /startsWith/);
});
test('HEVC master and stitched media fixtures trigger reload requests while preserving Source preference', async () => {
    const hevc = 'https://media.ttvnw.net/hevc.m3u8', avc = 'https://media.ttvnw.net/avc.m3u8';
    const master = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=3840x2160,FRAME-RATE=60,CODECS="hvc1"\n${hevc}\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1920x1080,FRAME-RATE=60,CODECS="avc1"\n${avc}`;
    const f = await workerRuntime(url => new Response(url.includes('/channel/hls/') ? master : '#EXTM3U\n#stitched\n#EXTINF:2,live\nhttps://media.ttvnw.net/ad.ts'));
    await f.ctx.fetch('https://usher.ttvnw.net/api/channel/hls/test.m3u8?sig=original');
    const info = f.ctx.StreamInfos.test;
    assert.match(info.ModifiedM3U8, /CODECS="avc1"/);
    assert.equal(info.ResolutionList[0].Codecs, 'hvc1');
    // Use a cached clean alternate, avoiding any real network/token request.
    info.BackupEncodingsM3U8Cache.autoplay = master;
    const clean = '#EXTM3U\n#EXTINF:2,live\nhttps://media.ttvnw.net/live.ts';
    f.ctx.fetch = async () => new Response(clean);
    // processM3U8 is a function in the generated worker scope, not a mocked algorithm.
    await f.ctx.processM3U8(hevc, '#EXTM3U\n#stitched\n#EXTINF:2,live\nhttps://media.ttvnw.net/ad.ts', f.ctx.fetch);
    assert.ok(f.messages.some(m => m.key === 'ReloadPlayer'));
    assert.equal(info.IsUsingModifiedM3U8, true);
    await f.ctx.processM3U8(hevc, clean, f.ctx.fetch);
    assert.equal(info.IsShowingAd, false);
    assert.equal(info.IsUsingModifiedM3U8, false);
});

test('MAIN storage hooks see isolated-world quality updates rather than stale cached values', () => {
    const f = runtime();
    // A write from another world does not call the MAIN-world wrapper.
    f.store.set('video-quality', '{"default":"chunked","ypft":"isolated-write"}');
    f.store.set('volume', '0.25');
    assert.equal(f.context.localStorage.getItem('video-quality'), '{"default":"chunked","ypft":"isolated-write"}');
    assert.equal(f.context.localStorage.getItem('volume'), '0.25');
});
