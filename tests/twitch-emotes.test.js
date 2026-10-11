const assert = require('node:assert/strict');
const test = require('node:test');
const { Node, fixture } = require('./helpers/chat-fixture.cjs');
const emotes = [
    { code: 'monkaS', url: 'https://cdn.betterttv.net/emote/56e9f494fff3cc5c35e5287e/2x', provider: 'BetterTTV' },
    { code: 'OMEGALUL', url: 'https://cdn.frankerfacez.com/emote/128054/2', provider: 'FrankerFaceZ' },
    { code: 'reckH', url: 'https://cdn.7tv.app/emote/test/2x.webp', provider: '7TV' }
];
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('global emotes render exact, case-sensitive tokens in native and floating chat while preserving whitespace', async () => {
    const f = fixture({ emotes });
    const { message } = f.addLine('hello  monkaS\nOMEGALUL reckH monkas monkaS!');
    await settle();
    assert.deepEqual(message.querySelectorAll('img').map(n => n.alt), ['monkaS', 'OMEGALUL', 'reckH']);
    assert.equal(message.childNodes[0].textContent, 'hello  ');
    assert.equal(message.childNodes[2].textContent, '\n');
    assert.equal(message.querySelectorAll('img')[0].title, 'monkaS (BetterTTV)');
    f.api.configure({ enabled: true, fullscreenOnly: false });
    const mirrored = f.getClass('ytot-chat-messages').children[0];
    assert.equal(mirrored.querySelectorAll('img').length, 3);
    assert.match(mirrored.textContent, /monkas monkaS!/);
    const fragment = new Node();
    f.emoteApi.appendText(fragment, 'monkaS', { images: 32 });
    assert.equal(fragment.children.length, 0); assert.equal(fragment.textContent, 'monkaS');
});
test('links, badges, usernames and emotes rendered by other extensions stay intact; Twitch text fragments are supported', async () => {
    const f = fixture({ emotes });
    const { message, author } = f.addLine('monkaS', 'monkaS');
    const link = new Node('A'); link.appendChild(new Node('#text', 'monkaS'));
    const existing = new Node('IMG'); existing.src = 'https://static-cdn.jtvnw.net/test'; existing.alt = 'Kappa';
    const provider = new Node('SPAN'); provider.className = 'bttv-emote'; provider.appendChild(new Node('#text', 'monkaS'));
    message.append(link, existing, provider);
    message.kind = ''; message.className = 'text-fragment';
    await settle();
    assert.equal(author.textContent, 'monkaS'); assert.equal(link.textContent, 'monkaS');
    assert.equal(provider.children.length, 0);
    assert.equal(message.querySelectorAll('img')[1], existing);
    f.flush([{ target: message }]);
    assert.equal(message.querySelectorAll('img').length, 2);
});
test('new and moderated messages update in bounded batches; feed replacement is reacquired', async () => {
    const f = fixture({ emotes }); await settle();
    const { line, message } = f.addLine('monkaS');
    f.flush([{ target: f.feed, addedNodes: [line] }]);
    assert.equal(message.querySelectorAll('img').length, 1);
    message.replaceChildren(new Node('#text', 'Message deleted'));
    f.flush([{ target: message }]);
    assert.equal(message.querySelectorAll('img').length, 0);
    assert.equal(message.textContent, 'Message deleted');
    f.replaceFeed(); const next = f.addLine('reckH'); f.emoteApi.sync();
    assert.equal(next.message.querySelectorAll('img').length, 1);
    assert.equal(f.observers.filter(o => o.active).length, 1);
});
test('off preference makes no requests; disabling restores codes and a late catalog cannot re-enable rendering', async () => {
    let calls = 0, resolve;
    const f = fixture({ emotesEnabled: false, sendMessage: message => {
        if (message.type === 'GET_CHANNEL_EMOTES') return Promise.resolve({ emotes: [] });
        calls++; return new Promise(done => { resolve = done; });
    } });
    const { message } = f.addLine('monkaS');
    assert.equal(calls, 0); assert.equal(f.observers.length, 0);
    f.emoteApi.configure(true, true); assert.equal(calls, 1);
    f.emoteApi.configure(false, true); resolve({ emotes }); await settle();
    assert.equal(message.querySelectorAll('img').length, 0);
    f.emoteApi.configure(true); assert.equal(calls, 2);
    resolve({ emotes }); await settle();
    assert.equal(message.querySelectorAll('img').length, 1);
    f.externalEmotes(false);
    assert.equal(message.textContent, 'monkaS'); assert.equal(message.children.length, 0);
    assert.equal(f.observers.filter(o => o.active).length, 0); assert.equal(f.timers.size, 0);
});
test('unsafe catalog URLs are ignored and a failed image falls back to text without a retry loop', async () => {
    const f = fixture({ emotes: [...emotes,
        { code: 'evil', provider: '7TV', url: 'https://cdn.7tv.app.evil.test/emote/x' },
        { code: 'bad', provider: '7TV', url: 'javascript:alert(1)' }
    ] });
    const { message } = f.addLine('monkaS evil bad'); await settle();
    const img = message.querySelectorAll('img')[0]; img.onerror();
    const retained = message.childNodes[0];
    f.flush([{ target: message }]); f.flush([{ target: message }]);
    assert.equal(message.childNodes[0], retained);
    assert.equal(message.querySelectorAll('img').length, 0);
    assert.equal(message.textContent, 'monkaS evil bad');
});
test('provider failure keeps chat usable and background visibility disconnects rendering', async () => {
    const f = fixture({ sendMessage: async () => { throw new Error('offline'); } });
    const { message } = f.addLine('monkaS'); await settle();
    assert.equal(message.textContent, 'monkaS');
    f.document.visibilityState = 'hidden'; f.emoteApi.sync();
    assert.equal(f.observers.filter(o => o.active).length, 0);
    f.document.visibilityState = 'visible'; f.emoteApi.sync();
    assert.equal(f.observers.filter(o => o.active).length, 1);
});

const om = { code: 'om', provider: '7TV', url: 'https://cdn.7tv.app/emote/01GEB3PA5R00067J91VAZ57B7F/2x.webp' };
test('animated channel emotes render in native and floating chat, and channel aliases override global codes', async () => {
    const channelAlias = { ...om, code: 'monkaS' };
    const f = fixture({ emotes, channelEmotes: [om, channelAlias] });
    const { message } = f.addLine('om monkaS OM'); await settle();
    assert.deepEqual(message.querySelectorAll('img').map(n => n.src), [om.url, om.url]);
    assert.match(message.textContent, /OM/);
    f.api.configure({ enabled: true, fullscreenOnly: false });
    assert.deepEqual(f.getClass('ytot-chat-messages').children[0].querySelectorAll('img').map(n => n.src), [om.url, om.url]);
    f.externalEmotes(false);
    assert.equal(message.textContent, 'om monkaS OM');
});
test('channel switching clears old emotes and ignores an older channel response arriving after the new one', async () => {
    const pending = new Map(), requests = [];
    const f = fixture({ sendMessage: message => {
        requests.push(message);
        if (message.type === 'GET_GLOBAL_EMOTES') return Promise.resolve({ emotes });
        return new Promise(resolve => pending.set(message.channel, resolve));
    } });
    const { message } = f.addLine('monkaS om newEmote'); await settle();
    f.changePath('/another_channel'); f.emoteApi.sync();
    pending.get('another_channel')({ emotes: [{ ...om, code: 'newEmote' }] }); await settle();
    assert.deepEqual(message.querySelectorAll('img').map(n => n.alt), ['monkaS', 'newEmote']);
    pending.get('valkyrae')({ emotes: [om] }); await settle();
    assert.deepEqual(message.querySelectorAll('img').map(n => n.alt), ['monkaS', 'newEmote']);
    f.changePath('/directory'); f.emoteApi.sync();
    assert.deepEqual(message.querySelectorAll('img').map(n => n.alt), ['monkaS']);
    assert.match(message.textContent, /om newEmote/);
    assert.equal(requests.filter(r => r.type === 'GET_CHANNEL_EMOTES').length, 2);
});
test('an already rendered channel set is replaced on navigation even if Twitch reuses the same chat feed', async () => {
    const f = fixture({ sendMessage: message => Promise.resolve({ emotes: message.type === 'GET_GLOBAL_EMOTES' ? emotes :
        message.channel === 'valkyrae' ? [om] : [] }) });
    const { message } = f.addLine('om monkaS'); await settle();
    assert.deepEqual(message.querySelectorAll('img').map(n => n.alt), ['om', 'monkaS']);
    f.changePath('/another_channel'); f.emoteApi.sync(); await settle();
    assert.deepEqual(message.querySelectorAll('img').map(n => n.alt), ['monkaS']);
    assert.equal(message.childNodes[0].textContent, 'om');
});
test('disabling during a channel request restores text; delayed results do not re-enable emotes', async () => {
    let resolve;
    const f = fixture({ emotes: [], sendMessage: message => message.type === 'GET_GLOBAL_EMOTES'
        ? Promise.resolve({ emotes: [] }) : new Promise(done => { resolve = done; }) });
    const { message } = f.addLine('om');
    f.emoteApi.configure(false); resolve({ emotes: [om] }); await settle();
    assert.equal(message.textContent, 'om'); assert.equal(message.children.length, 0);
    f.emoteApi.configure(true);
    resolve({ emotes: [om] }); await settle();
    assert.equal(message.querySelectorAll('img')[0].src, om.url);
});
test('popout chat resolves its channel while directory routes request only global emotes', async () => {
    for (const [path, channel] of [['/popout/valkyrae/chat', 'valkyrae'], ['/embed/valkyrae/chat', 'valkyrae'], ['/directory', null]]) {
        const requests = [];
        fixture({ path, sendMessage: message => { requests.push(message); return Promise.resolve({ emotes: [] }); } });
        await settle();
        assert.deepEqual(requests.filter(r => r.type === 'GET_CHANNEL_EMOTES').map(r => r.channel), channel ? [channel] : []);
    }
});
