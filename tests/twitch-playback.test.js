const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../twitch-playback.js`, 'utf8');
function fixture(initial = {}) {
    const attrs = new Map(), events = new Map(), intervals = new Map(), observers = [];
    const element = { style: {} };
    const video = (data = {}) => ({ paused: false, muted: false, volume: 0.7, plays: 0, pauses: 0,
        pause() { this.paused = true; this.pauses++; },
        play() { this.paused = false; this.plays++; return Promise.resolve(); }, ...data });
    let current = video(initial), player = null;
    const replace = (data = {}) => {
        current = video(data);
        player = { querySelector: () => current, getBoundingClientRect: () => ({ left: 20, top: 70, width: 900, height: 500 }) };
        return current;
    };
    replace(initial);
    const document = {
        body: {}, documentElement: { setAttribute(k, v) { attrs.set(k, v); }, removeAttribute(k) { attrs.delete(k); } },
        querySelector: () => player,
        addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); }
    };
    const context = vm.createContext({ document, window: { addEventListener() {}, removeEventListener() {} },
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
        setInterval(fn) { const id = intervals.size + 1; intervals.set(id, fn); return id; }, clearInterval(id) { intervals.delete(id); },
        requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {}
    });
    vm.runInContext(source, context);
    return { owner: context.window.__ypftPlayback, element, attrs, events, intervals, observers, replace,
        get video() { return current; },
        sync() { for (const fn of intervals.values()) fn(); }, disappear() { player = null; }
    };
}
test('YouTube owns only Twitch media and restores prior pause, mute and volume', () => {
    for (const paused of [true, false]) for (const muted of [true, false]) {
        const f = fixture({ paused, muted, volume: 0.23 });
        f.owner.own(f.element);
        assert.equal(f.attrs.get('data-ypft-playback'), 'youtube');
        assert.equal(f.video.paused, true);
        assert.equal(f.video.muted, true);
        f.video.volume = 0.8;
        f.owner.release();
        assert.equal(f.video.paused, paused);
        assert.equal(f.video.muted, muted);
        assert.equal(f.video.volume, 0.23);
        assert.equal(f.attrs.has('data-ypft-playback'), false);
        assert.equal(f.intervals.size, 0);
        assert.ok(f.observers.every(o => o.disconnected));
        assert.equal(f.events.size, 0);
    }
});
test('replacement video is held and restored from the original intent, with stable overlay', () => {
    const f = fixture({ paused: true, muted: true, volume: 0.12 });
    const original = f.video;
    f.owner.own(f.element);
    const replacement = f.replace();
    f.sync();
    assert.equal(replacement.paused, true);
    assert.equal(replacement.muted, true);
    assert.equal(f.element.style.width, '900px');
    assert.equal(f.element.style.left, '20px');
    f.owner.release();
    assert.equal(replacement.paused, true);
    assert.equal(replacement.muted, true);
    assert.equal(replacement.volume, 0.12);
    assert.equal(original.plays, 0);
});
test('play/unmute attempts from focus or recovery are suppressed while YouTube is active', () => {
    const f = fixture();
    f.owner.own(f.element);
    f.video.paused = false;
    f.video.muted = false;
    f.events.get('play')({ target: f.video });
    assert.equal(f.video.paused, true);
    assert.equal(f.video.muted, true);
    const unrelated = { muted: false, paused: false };
    f.events.get('play')({ target: unrelated });
    assert.equal(unrelated.muted, false);
    assert.equal(unrelated.paused, false);
});
test('missing/replaced container hides and realigns the portal without removing its iframe', () => {
    const f = fixture();
    f.element.iframe = { identity: 'youtube-player' };
    const iframe = f.element.iframe;
    f.owner.own(f.element);
    f.disappear();
    f.sync();
    assert.equal(f.element.style.visibility, 'hidden');
    f.replace();
    f.sync();
    assert.equal(f.element.style.visibility, 'visible');
    assert.equal(f.element.iframe, iframe);
});
test('SPA navigation does not resume or unmute the new channel using old intent', () => {
    const f = fixture({ volume: 0.2 });
    f.owner.own(f.element);
    const next = f.replace({ paused: true, muted: true, volume: 0.9 });
    f.owner.release({ navigation: true });
    assert.equal(next.plays, 0);
    assert.equal(next.muted, true);
    assert.equal(next.volume, 0.9);
});
test('switching YouTube streams retains original state and a restored session survives a forced reload', () => {
    const f = fixture({ paused: true, muted: false, volume: 0.15 });
    f.owner.own(f.element);
    const saved = f.owner.snapshot();
    f.owner.own({ style: {} });
    assert.deepEqual(f.owner.snapshot(), saved);
    const reloaded = fixture({ muted: true });
    reloaded.owner.own(reloaded.element, saved);
    reloaded.owner.release();
    assert.equal(reloaded.video.paused, true);
    assert.equal(reloaded.video.muted, false);
    assert.equal(reloaded.video.volume, 0.15);
});
test('invalid persisted state is ignored and reacquired state is safe to restore', () => {
    const f = fixture({ paused: false, muted: true, volume: 0.4 });
    f.owner.own(f.element, { paused: false, muted: false, volume: Infinity });
    f.owner.release();
    assert.equal(f.video.volume, 0.4);
    assert.equal(f.video.muted, true);
});
