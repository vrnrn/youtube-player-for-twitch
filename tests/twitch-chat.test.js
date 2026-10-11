const assert = require('node:assert/strict');
const test = require('node:test');
const { Node, fixture } = require('./helpers/chat-fixture.cjs');
test('floating chat is idle by default, settings are validated, and enablement has no new network client', () => {
    const f = fixture();
    assert.equal(f.observers.length, 0); assert.equal(f.resizeObservers.length, 0);
    assert.equal(f.events.size, 0); assert.equal(f.timers.size, 0);
    const s = f.api.normalize({ enabled: 'yes', opacity: -10, width: Infinity, height: 5, color: 'url(evil)', x: NaN });
    assert.equal(s.enabled, false); assert.equal(s.opacity, 0); assert.equal(s.height, 0.9); assert.equal(s.color, '#18151f');
    assert.equal(f.api.normalize(null).enabled, false);
    // The test environment has no fetch or WebSocket; both rendering and enablement must work without them.
    f.api.configure({ enabled: true, fullscreenOnly: false }, true);
    assert.equal(f.writes.length, 1);
    assert.ok(f.getClass('ytot-chat-panel')); assert.equal(f.getClass('ytot-chat-panel').hidden, false);
});
test('native messages are bounded, sanitized, reused and updated for moderation', () => {
    const f = fixture();
    for (let i = 0; i < 500; i++) f.addLine('message ' + i);
    const last = f.addLine('<img onerror=evil>');
    const good = new Node('IMG'); good.setAttribute('src', 'https://static-cdn.jtvnw.net/emotes/test/1'); good.alt = 'Kappa';
    const bad = new Node('IMG'); bad.setAttribute('src', 'javascript:alert(1)');
    const script = new Node('SCRIPT'); script.appendChild(new Node('#text', 'evil script'));
    last.message.append(good, bad, script);
    f.api.configure({ enabled: true, fullscreenOnly: false });
    const list = f.getClass('ytot-chat-messages');
    assert.equal(list.children.length, 60);
    const row = list.children.at(-1);
    assert.equal(row.children.filter(n => n.tagName === 'IMG').length, 1);
    assert.ok(row.childNodes.some(n => n.textContent === '<img onerror=evil>'));
    assert.ok(!row.childNodes.some(n => n.textContent === 'evil script'));
    const first = list.children[0];
    const retained = list.children[1];
    f.addLine('new');
    f.flush();
    assert.equal(list.children.length, 60);
    assert.equal(list.children[0], retained);
    assert.ok(!list.children.includes(first));
    last.message.replaceChildren(new Node('#text', 'Message deleted'));
    f.flush([{ target: last.message }]);
    assert.ok(list.children.at(-2).childNodes.some(n => n.textContent === 'Message deleted'));
});
test('fullscreen and background visibility gate observation; disabling cleans timers and permissions', () => {
    const f = fixture({ youtube: true });
    f.addLine();
    f.api.configure({ enabled: true });
    assert.equal(f.observers.filter(o => o.active).length, 0);
    assert.ok(!f.iframe.getAttribute('allow').includes('fullscreen'));
    assert.equal(f.iframe.getAttribute('allowfullscreen'), null);
    const sameIframe = f.iframe;
    f.document.fullscreenElement = f.host; f.api.sync();
    assert.equal(f.observers.filter(o => o.active).length, 1);
    assert.equal(f.getClass('ytot-chat-panel').hidden, false);
    assert.equal(f.iframe, sameIframe); assert.ok(f.host.contains(f.iframe));
    f.flush([{ target: f.feed }]);
    f.document.visibilityState = 'hidden'; f.api.sync();
    assert.equal(f.observers.filter(o => o.active).length, 0);
    assert.equal(f.timers.size, 0);
    f.document.visibilityState = 'visible'; f.api.sync();
    assert.equal(f.observers.filter(o => o.active).length, 1);
    f.api.configure({ enabled: false });
    assert.equal(f.observers.filter(o => o.active).length, 0);
    assert.equal(f.resizeObservers.filter(o => o.active).length, 0);
    assert.equal(f.events.size, 0);
    assert.equal(f.iframe.getAttribute('allow'), 'autoplay; fullscreen; encrypted-media');
    assert.equal(f.iframe.getAttribute('allowfullscreen'), 'true');
});
test('SPA, feed replacement and player replacement detach stale sources and reacquire without cloning the player', () => {
    const f = fixture({ saved: { enabled: true, fullscreenOnly: false } });
    f.addLine('old'); f.flush();
    f.replaceFeed(); f.addLine('new'); f.replaceHost(); f.api.sync();
    assert.equal(f.getClass('ytot-chat-messages').children.length, 1);
    assert.equal(f.observers.filter(o => o.active).length, 1);
    assert.equal(f.resizeObservers.filter(o => o.active).length, 1);
    f.changePath('/directory'); f.api.sync();
    assert.equal(f.getClass('ytot-chat-panel'), undefined);
    assert.equal(f.observers.filter(o => o.active).length, 0);
    f.changePath('/another_channel'); f.api.sync();
    assert.ok(f.getClass('ytot-chat-panel'));
    f.external({ enabled: false });
    assert.equal(f.getClass('ytot-chat-panel'), undefined);
});
test('geometry remains within the player and keyboard movement persists normalized position', () => {
    const f = fixture({ saved: { enabled: true, fullscreenOnly: false, width: 600 } });
    f.host.rect = { left: 10, top: 20, width: 250, height: 140 }; f.api.sync();
    const panel = f.getClass('ytot-chat-panel');
    assert.equal(parseFloat(panel.style.width), 234); assert.equal(parseFloat(panel.style.height), 120);
    const grip = f.getClass('ytot-chat-grip');
    grip.onkeydown({ key: 'ArrowLeft', preventDefault() {} });
    assert.ok(f.api.settings().x < 1); assert.equal(f.writes.length, 1);
    assert.ok(parseFloat(panel.style.left) >= 8);
    f.getClass('ytot-chat-tool').onclick();
    assert.equal(f.api.settings().enabled, false);
});

test('interrupted chat gestures release handlers, persist once and detach the blur listener when disabled', () => {
    for (const interruption of ['blur', 'hidden', 'cancel', 'lost']) {
        const f = fixture({ saved: { enabled: true, fullscreenOnly: false } });
        const grip = f.getClass('ytot-chat-grip');
        grip.onpointerdown({ button: 0, pointerId: 7, isPrimary: true, clientX: 900, clientY: 100, preventDefault() {} });
        grip.onpointermove({ pointerId: 7, clientX: 820, clientY: 150 }); f.resize();
        if (interruption === 'blur') f.events.get('blur')?.();
        else if (interruption === 'hidden') { f.document.visibilityState = 'hidden'; f.api.sync(); }
        else if (interruption === 'cancel') grip.onpointercancel({ pointerId: 7 });
        else grip.onlostpointercapture({ pointerId: 7 });
        assert.equal(grip.onpointermove, null, interruption);
        assert.equal(grip.onpointerup, null, interruption);
        assert.equal(f.writes.length, 1, interruption);
        assert.ok(f.api.settings().x < 1);
        f.api.configure({ enabled: false });
        assert.equal(f.events.size, 0);
    }
});

test('a second pointer cannot replace or finish the active chat gesture', () => {
    const f = fixture({ saved: { enabled: true, fullscreenOnly: false } });
    const grip = f.getClass('ytot-chat-grip');
    const down = (pointerId, isPrimary) => grip.onpointerdown({ button: 0, pointerId, isPrimary, clientX: 900, clientY: 100, preventDefault() {} });
    down(7, true); down(8, false);
    grip.onpointermove({ pointerId: 7, clientX: 800, clientY: 100 }); f.resize();
    assert.ok(f.api.settings().x < 1);
    grip.onpointerup({ pointerId: 8 });
    assert.equal(typeof grip.onpointermove, 'function'); assert.equal(f.writes.length, 0);
    grip.onpointerup({ pointerId: 7 });
    assert.equal(grip.onpointermove, null); assert.equal(f.writes.length, 1);
});
test('busy-channel mutations batch once and a partially rendered message retains source order', () => {
    const f = fixture();
    const pending = f.addLine('pending'), later = f.addLine('later');
    pending.line.childNodes = [pending.author]; pending.message.parentNode = null;
    f.api.configure({ enabled: true, fullscreenOnly: false });
    const list = f.getClass('ytot-chat-messages'), retained = list.children[0];
    pending.line.appendChild(pending.message);
    for (let i = 0; i < 100; i++) f.observers.find(o => o.active).fn([{ target: pending.line }]);
    assert.equal(f.timers.size, 1);
    f.flush();
    assert.equal(list.children.length, 2);
    assert.equal(list.children[1], retained);
    assert.ok(list.children[0].childNodes.some(n => n.textContent === 'pending'));
    f.api.configure({ enabled: false });
    assert.equal(f.timers.size, 0);
});

test('cold collapsed native chat is initialized once, restored, and continues feeding the bounded overlay', () => {
    const f = fixture({ chatCollapsed: true, saved: { enabled: true, fullscreenOnly: false } });
    assert.equal(f.nativeClicks, 1);
    assert.equal(f.nativeColumn.getAttribute('data-ypft-chat-priming'), '');
    assert.equal(f.host.getAttribute('data-ypft-chat-priming-player'), '');
    assert.equal(f.host.style.getPropertyValue('--ypft-chat-player-width'), '1000px');
    f.tick(600);
    const first = f.addLine('arrived while initializing'); f.mutate([{ target: first.line }]); f.tick(125);
    assert.equal(f.getClass('ytot-chat-messages').children.length, 1);
    assert.equal(f.nativeColumn.classList.contains('right-column--collapsed'), true);
    f.tick(100);
    assert.equal(f.nativeColumn.getAttribute('data-ypft-chat-priming'), null);
    assert.equal(f.host.getAttribute('data-ypft-chat-priming-player'), null);
    assert.equal(f.host.style.getPropertyValue('--ypft-chat-player-width'), '');
    assert.equal(f.events.has('click'), false); assert.equal(f.timers.size, 0);
    for (let i = 0; i < 200; i++) f.addLine('after collapse ' + i);
    f.mutate(); f.tick(125); f.api.sync(); f.api.sync();
    assert.equal(f.getClass('ytot-chat-messages').children.length, 60);
    assert.equal(f.nativeClicks, 2);
    f.api.configure({ enabled: false });
    assert.equal(f.observers.filter(o => o.active).length, 0); assert.equal(f.events.size, 0);
});

test('native chat startup never opens warm, already expanded, disabled, or inactive fullscreen-only chat', () => {
    for (const mode of ['warm', 'expanded', 'disabled', 'fullscreen']) {
        const f = fixture({ chatCollapsed: mode !== 'expanded' });
        if (mode === 'warm') f.addLine('already connected');
        f.api.configure({ enabled: mode !== 'disabled', fullscreenOnly: mode === 'fullscreen' });
        assert.equal(f.nativeClicks, 0, mode); assert.equal(f.timers.size, 0, mode);
    }
    const hidden = fixture({ chatCollapsed: true }); hidden.document.visibilityState = 'hidden';
    hidden.api.configure({ enabled: true, fullscreenOnly: false });
    assert.equal(hidden.nativeClicks, 0);
});

test('native startup restores collapse on interruption and ignores stale startup callbacks', () => {
    for (const reason of ['disable', 'hidden', 'fullscreen', 'navigation']) {
        const f = fixture({ chatCollapsed: true, deferNativeToggle: true });
        if (reason === 'fullscreen') f.document.fullscreenElement = f.host;
        f.api.configure({ enabled: true, fullscreenOnly: reason === 'fullscreen' });
        assert.equal(f.nativeClicks, 1, reason);
        const stale = [...f.timers.values()][0];
        if (reason === 'disable') f.api.configure({ enabled: false });
        else if (reason === 'hidden') { f.document.visibilityState = 'hidden'; f.api.sync(); }
        else if (reason === 'fullscreen') { f.document.fullscreenElement = null; f.api.sync(); }
        else { f.changePath('/directory'); f.api.sync(); }
        f.commitNative(); f.tick(0); f.commitNative(); f.tick(100); stale();
        assert.equal(f.nativeColumn.classList.contains('right-column--collapsed'), true, reason);
        assert.equal(f.nativeColumn.getAttribute('data-ypft-chat-priming'), null, reason);
        assert.equal(f.host.getAttribute('data-ypft-chat-priming-player'), null, reason);
        assert.equal(f.nativeClicks, 2, reason); assert.equal(f.events.has('click'), false, reason);
        assert.equal(f.timers.size, 0, reason);
    }
});

test('quiet or disconnected native startup has a bounded timeout and does not repeatedly toggle the sidebar', () => {
    const f = fixture({ chatCollapsed: true, saved: { enabled: true, fullscreenOnly: false } });
    f.tick(600); assert.equal(f.nativeClicks, 1);
    f.tick(4400); f.tick(100);
    for (let i = 0; i < 10; i++) f.api.sync();
    assert.equal(f.nativeClicks, 2); assert.equal(f.timers.size, 0); assert.equal(f.events.has('click'), false);
    assert.equal(f.nativeColumn.classList.contains('right-column--collapsed'), true);
});

test('explicit native chat interaction wins over automatic startup restoration', () => {
    const f = fixture({ chatCollapsed: true, saved: { enabled: true, fullscreenOnly: false } });
    f.userToggleNative(); f.userToggleNative();
    f.tick(5000); f.api.sync();
    assert.equal(f.nativeColumn.classList.contains('right-column--collapsed'), false);
    assert.equal(f.nativeColumn.getAttribute('data-ypft-chat-priming'), null);
    assert.equal(f.nativeClicks, 3); assert.equal(f.timers.size, 0); assert.equal(f.events.has('click'), false);
});

test('native startup restores the current sidebar after Twitch replaces its column and message container', () => {
    const f = fixture({ chatCollapsed: true, saved: { enabled: true, fullscreenOnly: false } });
    const original = f.nativeColumn;
    f.replaceFeed(); f.replaceNativeColumn(); const next = f.addLine('new native feed');
    f.api.sync(); f.mutate([{ target: next.line }]); f.tick(125); f.tick(475); f.tick(100);
    assert.equal(f.nativeColumn.classList.contains('right-column--collapsed'), true);
    assert.equal(original.getAttribute('data-ypft-chat-priming'), null);
    assert.equal(f.getClass('ytot-chat-messages').children.length, 1);
    assert.equal(f.nativeClicks, 2); assert.equal(f.timers.size, 0);
});

test('temporary native player sizing preserves an existing custom property and its priority', () => {
    const f = fixture({ chatCollapsed: true });
    f.host.style.setProperty('--ypft-chat-player-width', '123px', 'important');
    f.addLine('welcome'); f.api.configure({ enabled: true, fullscreenOnly: false });
    // Warm feeds need no temporary sizing. Clear it to exercise cold startup.
    f.feed.replaceChildren(); f.api.sync();
    assert.equal(f.host.style.getPropertyValue('--ypft-chat-player-width'), '1000px');
    f.tick(600); f.tick(4400); f.tick(100);
    assert.equal(f.host.style.getPropertyValue('--ypft-chat-player-width'), '123px');
    assert.equal(f.host.style.getPropertyPriority('--ypft-chat-player-width'), 'important');
});
