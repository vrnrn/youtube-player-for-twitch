const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../twitch-playback.js`, 'utf8');
function fixture(initial = {}) {
    const attrs = new Map(), events = new Map(), intervals = new Map(), observers = [], resizeObservers = [], frames = new Map();
    let nextFrame = 0;
    const rect = { left: 20, top: 70, width: 900, height: 500 };
    const element = { style: {} };
    const video = (data = {}) => ({ paused: false, muted: false, volume: 0.7, plays: 0, pauses: 0,
        pause() { this.paused = true; this.pauses++; },
        play() { this.paused = false; this.plays++; return Promise.resolve(); }, ...data });
    let current = video(initial), player = null;
    const replace = (data = {}) => {
        current = video(data);
        player = { querySelector: () => current, getBoundingClientRect: () => ({ ...rect }) };
        return current;
    };
    replace(initial);
    const document = {
        body: {}, documentElement: { getAttribute(k) { return attrs.get(k) ?? null; }, setAttribute(k, v) { attrs.set(k, v); }, removeAttribute(k) { attrs.delete(k); } },
        querySelector: () => player,
        addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); }
    };
    const context = vm.createContext({ document, window: { addEventListener() {}, removeEventListener() {} },
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
        ResizeObserver: class { constructor(fn) { this.fn = fn; resizeObservers.push(this); } observe(target) { this.target = target; } disconnect() { this.target = null; } },
        setInterval(fn) { const id = intervals.size + 1; intervals.set(id, fn); return id; }, clearInterval(id) { intervals.delete(id); },
        requestAnimationFrame: fn => { const id = ++nextFrame; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id)
    });
    vm.runInContext(source, context);
    return { owner: context.window.__ypftPlayback, document, element, attrs, events, intervals, observers, resizeObservers, frames, rect, replace,
        get player() { return player; },
        get video() { return current; },
        flushFrame() { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(); },
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
        assert.ok(f.resizeObservers.every(o => o.target === null));
        assert.equal(f.events.size, 0);
    }
});
test('YouTube wrapper fullscreen keeps media ownership without overwriting fullscreen geometry', () => {
    const f = fixture();
    f.owner.own(f.element);
    f.document.fullscreenElement = f.element;
    f.element.style.width = 'fullscreen-width';
    f.replace({ paused: false, muted: false });
    f.sync();
    assert.equal(f.element.style.width, 'fullscreen-width');
    assert.equal(f.video.paused, true);
    assert.equal(f.video.muted, true);
    f.document.fullscreenElement = null;
    f.sync();
    assert.equal(f.element.style.width, '900px');
    f.owner.release();
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

test('theatre resizing follows the native player immediately without replacing the YouTube iframe', () => {
    const f = fixture();
    f.element.iframe = {};
    const iframe = f.element.iframe;
    f.owner.own(f.element);
    const resize = f.resizeObservers[0];
    assert.equal(resize.target, f.player);
    Object.assign(f.rect, { left: 0, top: 0, width: 1200, height: 800 });
    resize.fn();
    resize.fn();
    assert.equal(f.frames.size, 1);
    f.flushFrame();
    assert.equal(f.element.style.width, '1200px');
    assert.equal(f.element.style.height, '800px');
    assert.equal(f.element.style.left, '0px');
    assert.equal(f.element.iframe, iframe);
    assert.equal(f.video.paused, true);
    assert.equal(f.video.muted, true);
    Object.assign(f.rect, { left: 20, top: 70, width: 900, height: 500 });
    resize.fn();
    f.flushFrame();
    assert.equal(f.element.style.width, '900px');
    assert.equal(f.element.style.top, '70px');
    f.owner.release();
});

test('resize observation follows replacement players and pending layout work is cancelled on release', () => {
    const f = fixture();
    f.owner.own(f.element);
    const resize = f.resizeObservers[0];
    f.disappear();
    f.sync();
    assert.equal(resize.target, null);
    f.replace();
    f.sync();
    assert.equal(resize.target, f.player);
    resize.fn();
    assert.equal(f.frames.size, 1);
    f.owner.release();
    assert.equal(f.frames.size, 0);
    assert.equal(resize.target, null);
    f.owner.own(f.element);
    assert.equal(f.resizeObservers[1].target, f.player);
    f.document.fullscreenElement = f.element;
    f.element.style.width = 'fullscreen-width';
    f.events.get('fullscreenchange')();
    f.flushFrame();
    assert.equal(f.element.style.width, 'fullscreen-width');
    f.document.fullscreenElement = null;
    f.events.get('fullscreenchange')();
    f.flushFrame();
    assert.equal(f.element.style.width, '900px');
    f.owner.release();
});

test('busy chat and extension menu mutations do not schedule player layout', () => {
    const f = fixture();
    f.owner.own(f.element);
    const observer = f.observers[0];
    observer.fn([{ target: { closest: () => ({}) } }]);
    assert.equal(f.frames.size, 0);
    observer.fn([{ target: { closest: () => null } }]);
    assert.equal(f.frames.size, 1);
    f.owner.release();
    assert.equal(f.frames.size, 0);
});
