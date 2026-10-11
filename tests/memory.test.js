const assert = require('node:assert/strict');
const test = require('node:test');
const { fixture } = require('./helpers/chat-fixture.cjs');
// Inspect retention roots only inside the test VM, never on production pages.
const transform = (source, name) => name === 'emotes'
    ? source.replace('window.__ypftEmotes = Object.freeze', `window.memoryEmotes = () => ({ dirty: dirty.size,
        catalogs: globalCatalog.size + channelCatalog.size }); window.__ypftEmotes = Object.freeze`)
    : source.replace('window.__ypftChat = Object.freeze', `window.memoryChat = () => ({ dirty: dirty.size, rows: rows.size,
        ui: [root, panel, messages, empty, latest, fullscreenButton, compactButton].filter(Boolean).length,
        startup: Boolean(nativeStartup) });
        window.__ypftChat = Object.freeze`);
const catalog = [{ code: 'om', provider: '7TV', url: 'https://cdn.7tv.app/emote/test/2x.webp' }];
const settle = () => new Promise(resolve => setImmediate(resolve));

test('removed-message bursts cannot retain an unbounded chat queue; newest connected messages still render', async () => {
    const f = fixture({ emotes: [], channelEmotes: catalog, transform }); await settle();
    f.api.configure({ enabled: true, fullscreenOnly: false });
    for (let i = 0; i < 1000; i++) {
        const { line, message } = f.addLine('om');
        for (const observer of f.observers.filter(o => o.active)) observer.fn([{ target: message, addedNodes: [line] }]);
        line.remove();
    }
    assert.ok(f.context.window.memoryEmotes().dirty <= 150);
    assert.ok(f.context.window.memoryChat().dirty <= 150);
    const newest = f.addLine('om'); f.flush([{ target: newest.message }]);
    assert.equal(f.context.window.memoryEmotes().dirty, 0);
    assert.equal(f.context.window.memoryChat().dirty, 0);
    assert.equal(newest.message.querySelectorAll('img').length, 1);
    assert.equal(f.getClass('ytot-chat-messages').children.length, 1);
});

test('background tabs discard catalogs and stale responses, then reload emotes when visible', async () => {
    const pending = [];
    const f = fixture({ transform, sendMessage: () => new Promise(resolve => pending.push(resolve)) });
    const { message } = f.addLine('om');
    f.document.visibilityState = 'hidden'; f.emoteApi.sync();
    for (const resolve of pending.splice(0)) resolve({ emotes: catalog }); await settle();
    assert.equal(f.context.window.memoryEmotes().catalogs, 0);
    assert.equal(f.observers.filter(o => o.active).length, 0);
    assert.equal(message.textContent, 'om');
    f.document.visibilityState = 'visible'; f.emoteApi.sync();
    for (const resolve of pending.splice(0)) resolve({ emotes: catalog }); await settle();
    assert.equal(message.querySelectorAll('img').length, 1);
    assert.equal(message.querySelectorAll('img')[0].loading, 'lazy');
    f.document.visibilityState = 'hidden'; f.emoteApi.sync();
    assert.equal(f.context.window.memoryEmotes().catalogs, 0);
    assert.equal(message.textContent, 'om');
});

test('repeated enable and disable cycles release floating UI, catalogs, rows, observers and timers', async () => {
    const f = fixture({ emotes: [], channelEmotes: catalog, transform });
    for (let i = 0; i < 200; i++) f.addLine('om');
    for (let cycle = 0; cycle < 5; cycle++) {
        f.emoteApi.configure(true); await settle();
        f.api.configure({ enabled: true, fullscreenOnly: false });
        assert.equal(f.context.window.memoryChat().rows, 60);
        f.api.configure({ enabled: false }); f.emoteApi.configure(false);
        assert.equal(f.context.window.memoryChat().ui, 0);
        assert.equal(f.context.window.memoryChat().rows, 0);
        assert.equal(f.context.window.memoryEmotes().catalogs, 0);
        assert.equal(f.observers.filter(o => o.active).length, 0);
        assert.equal(f.resizeObservers.filter(o => o.active).length, 0);
        assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0);
    }
});

test('cancelled cold-chat initialization releases its sidebar reference and bounded cleanup timer on every disable cycle', () => {
    const f = fixture({ chatCollapsed: true, transform });
    for (let cycle = 0; cycle < 5; cycle++) {
        f.api.configure({ enabled: true, fullscreenOnly: false });
        assert.equal(f.context.window.memoryChat().startup, true);
        assert.equal(f.timers.size, 1);
        f.api.configure({ enabled: false }); f.tick(0); f.tick(100);
        assert.equal(f.context.window.memoryChat().startup, false);
        assert.equal(f.context.window.memoryChat().ui, 0);
        assert.equal(f.context.window.memoryChat().rows, 0);
        assert.equal(f.nativeColumn.classList.contains('right-column--collapsed'), true);
        assert.equal(f.nativeColumn.getAttribute('data-ypft-chat-priming'), null);
        assert.equal(f.nativeClicks, (cycle + 1) * 2);
        assert.equal(f.observers.filter(o => o.active).length, 0);
        assert.equal(f.resizeObservers.filter(o => o.active).length, 0);
        assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0); assert.equal(f.events.size, 0);
    }
});
