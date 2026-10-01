const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const script = fs.readFileSync(`${__dirname}/../background.js`, 'utf8');
const key = 'ytot_vaft_enabled';
const sender = { id: 'ypft', frameId: 0, url: 'https://www.twitch.tv/channel', tab: { id: 1 } };
function fixture({ enabled, registered = false } = {}) {
    let registration = registered ? { id: 'ypft-vaft', js: ['old.js'] } : null;
    const listeners = [], events = {}, calls = [], data = { [key]: enabled };
    const failures = {};
    const hook = name => ({ addListener(fn) { events[name] = fn; } });
    const api = {
        async getRegisteredContentScripts() { if (failures.read) throw new Error('read failed'); return registration ? [registration] : []; },
        async registerContentScripts([value]) { calls.push('register'); if (failures.register) throw new Error('register failed'); registration = value; },
        async updateContentScripts([value]) { calls.push('update'); if (failures.update) throw new Error('update failed'); registration = value; },
        async unregisterContentScripts() { calls.push('unregister'); if (failures.unregister) throw new Error('unregister failed'); registration = null; }
    };
    const context = vm.createContext({
        chrome: {
            runtime: { id: 'ypft', onMessage: { addListener(fn) { listeners.push(fn); } }, onStartup: hook('startup'), onInstalled: hook('install') },
            storage: { local: {
                async get() { return { ...data }; },
                async set(value) { calls.push('persist'); if (failures.persist) throw new Error('storage failed'); Object.assign(data, value); }
            }, onChanged: hook('change') },
            scripting: api
        }, console: { error() {} }, URL
    });
    vm.runInContext(script, context);
    const send = (request, from = sender) => new Promise((resolve, reject) => {
        try { for (const fn of listeners) if (fn(request, from, resolve) === true) return; }
        catch (error) { reject(error); }
    });
    return { send, events, calls, data, failures, get registration() { return registration; } };
}
const get = f => f.send({ type: 'GET_VAFT_SETTINGS' });
const set = (f, enabled) => f.send({ type: 'SET_VAFT_SETTINGS', enabled });
test('fresh install defaults off and removes stale registration', async () => {
    const f = fixture({ registered: true });
    assert.equal((await get(f)).enabled, false);
    assert.equal(f.registration, null);
    assert.deepEqual(f.calls, ['unregister']);
});
test('on toggle registration completes before persistence and only targets Twitch MAIN document_start', async () => {
    const f = fixture();
    await get(f);
    const response = await set(f, true);
    assert.equal(response.reloadRequired, true);
    assert.equal(f.data[key], true);
    assert.deepEqual(f.calls, ['register', 'persist']);
    assert.deepEqual([...f.registration.matches], ['https://www.twitch.tv/*']);
    assert.deepEqual([...f.registration.js], ['vaft-main.js', 'vendor/vaft/vaft.js']);
    assert.equal(f.registration.runAt, 'document_start');
    assert.equal(f.registration.world, 'MAIN');
    assert.equal(f.registration.allFrames, false);
    assert.equal(f.registration.persistAcrossSessions, true);
});
test('startup and upgrade refresh enabled registration and survive service worker restarts', async () => {
    const f = fixture({ enabled: true, registered: true });
    await f.events.startup();
    await f.events.install();
    assert.equal((await get(f)).registered, true);
    assert.ok(f.calls.every(value => value === 'update'));
    const restart = fixture({ enabled: f.data[key], registered: true });
    await get(restart);
    assert.equal(restart.registration.world, 'MAIN');
});
test('repeat and concurrent toggles are serialized and end with no registration', async () => {
    const f = fixture();
    await get(f);
    await Promise.all([set(f, true), set(f, true), set(f, false), set(f, true), set(f, false)]);
    assert.equal(f.registration, null);
    assert.equal(f.data[key], false);
    assert.deepEqual(f.calls, ['register', 'persist', 'update', 'persist', 'unregister', 'persist', 'register', 'persist', 'unregister', 'persist']);
});
test('registration failure does not change preference or acknowledge reload', async () => {
    const f = fixture();
    await get(f);
    f.failures.register = true;
    const response = await set(f, true);
    assert.match(response.error, /register failed/);
    assert.equal(response.reloadRequired, undefined);
    assert.notEqual(f.data[key], true);
    assert.equal(f.registration, null);
});
test('persistence failure rolls registration back in both directions', async () => {
    for (const enabled of [false, true]) {
        const f = fixture({ enabled });
        await get(f);
        f.failures.persist = true;
        assert.match((await set(f, !enabled)).error, /storage failed/);
        assert.equal(!!f.registration, enabled);
        assert.equal(f.data[key], enabled);
    }
});
test('unregister failure keeps enabled registration/preference and retry succeeds', async () => {
    const f = fixture({ enabled: true });
    await get(f);
    f.failures.unregister = true;
    assert.match((await set(f, false)).error, /unregister failed/);
    assert.equal(f.data[key], true);
    f.failures.unregister = false;
    assert.equal((await set(f, false)).enabled, false);
});
test('storage changes reconcile and nonboolean stored values stay off', async () => {
    const f = fixture();
    await get(f);
    f.data[key] = true;
    await f.events.change({ [key]: { newValue: true } }, 'local');
    assert.ok(f.registration);
    f.data[key] = 'true';
    await f.events.change({ [key]: { newValue: 'true' } }, 'local');
    assert.equal(f.registration, null);
});
test('settings commands reject page/extension/iframe senders and malformed values', async () => {
    const f = fixture();
    await get(f);
    for (const from of [{}, { ...sender, id: 'other' }, { ...sender, frameId: 1 }, { ...sender, url: 'https://www.youtube.com/watch' }, { ...sender, url: 'https://www.twitch.tv.attacker.test/' }]) {
        assert.match((await f.send({ type: 'SET_VAFT_SETTINGS', enabled: true }, from)).error, /only available/);
    }
    assert.match((await set(f, 'true')).error, /Invalid/);
    assert.equal(f.registration, null);
});
