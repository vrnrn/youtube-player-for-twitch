// Synthetic retention checks; Twitch/YouTube player and browser image memory are excluded.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { fixture } = require('../tests/helpers/chat-fixture.cjs');
if (!global.gc) throw new Error('Run with node --expose-gc scripts/profile-memory.mjs');
const transform = (source, name) => name === 'emotes'
    ? source.replace('window.__ypftEmotes = Object.freeze', `window.memoryEmotes = () => ({ pendingLines: dirty.size,
        lookupEntries: globalCatalog.size + channelCatalog.size + (typeof catalog === 'undefined' ? 0 : catalog.size) });
        window.__ypftEmotes = Object.freeze`)
    : source.replace('window.__ypftChat = Object.freeze', `window.memoryChat = () => ({ rows: rows.size,
        retainedUi: [root, panel, messages, empty, latest, fullscreenButton, compactButton].filter(Boolean).length });
        window.__ypftChat = Object.freeze`);
const emotes = Array.from({ length: 1200 }, (_, i) => ({ code: `emote${i}`, provider: '7TV', url: `https://cdn.7tv.app/emote/${i}/2x.webp` }));
const f = fixture({ emotes: [], channelEmotes: emotes, transform });
await new Promise(resolve => setImmediate(resolve));
global.gc();
const baseline = process.memoryUsage().heapUsed;
const observer = f.observers.find(observer => observer.active);
for (let i = 0; i < 10000; i++) {
    const { line } = f.addLine('emote1');
    observer.fn([{ target: f.feed, addedNodes: [line] }]);
    line.remove();
}
global.gc();
const burst = { ...f.context.window.memoryEmotes(), heapDeltaBytes: process.memoryUsage().heapUsed - baseline };
f.flush();
for (let i = 0; i < 200; i++) f.addLine('emote1');
f.api.configure({ enabled: true, fullscreenOnly: false });
const active = { ...f.context.window.memoryChat(), ...f.context.window.memoryEmotes() };
f.api.configure({ enabled: false }); f.emoteApi.configure(false);
global.gc();
const disabled = { ...f.context.window.memoryChat(), ...f.context.window.memoryEmotes(),
    activeObservers: f.observers.filter(observer => observer.active).length,
    timers: f.timers.size };
console.log(JSON.stringify({ scenario: '10000 removed messages before flush, then 200 live messages and disablement', burst, active, disabled }, null, 2));
