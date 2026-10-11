const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../twitch-directory.js`, 'utf8');

function fixture(href) {
    const timers = [], clicks = [];
    const location = { href };
    let expanded = false;
    const control = { isConnected: true, getAttribute: () => String(expanded), click() { expanded = !expanded; clicks.push('control'); } };
    const option = { getAttribute: () => 'option', click() {
        const url = new URL(location.href); url.searchParams.set('sort', 'VIEWER_COUNT');
        location.href = url.href; expanded = false; clicks.push('option');
    } };
    const window = { location, addEventListener() {} };
    const document = { getElementById: id => id === 'browse-sort-drop-down' ? control : expanded ? option : null };
    vm.runInNewContext(source, { window, document, URL, setTimeout: fn => timers.push(fn) });
    return { api: window.__ypftDirectory, location, control, clicks, document, flush() { timers.splice(0).forEach(fn => fn()); } };
}

test('channels, categories and category stream listings default to descending viewers through Twitch controls', () => {
    for (const path of ['/directory', '/directory/all', '/directory/category/just-chatting', '/directory/game/VALORANT', '/directory/gaming']) {
        const f = fixture(`https://www.twitch.tv${path}?lang=en#list`);
        assert.equal(f.location.href.includes('sort='), false);
        f.api.sync(); f.flush(); f.api.sync();
        assert.deepEqual(f.clicks, ['control', 'option']);
        const url = new URL(f.location.href);
        assert.equal(url.searchParams.get('sort'), 'VIEWER_COUNT');
        assert.equal(url.searchParams.get('lang'), 'en');
        assert.equal(url.hash, '#list');
    }
});
test('explicit sort selections and unrelated Twitch routes are preserved', () => {
    for (const path of ['/directory?sort=RECOMMENDED', '/directory/all?sort=VIEWER_COUNT_ASC', '/directory/category/music?sort=RELEVANCE', '/channel', '/directory/following', '/directory/event/example']) {
        const f = fixture(`https://www.twitch.tv${path}`);
        f.flush(); assert.deepEqual(f.clicks, []);
    }
});
test('late mounting, navigation and user-opened sort menus do not select a stale option', () => {
    const f = fixture('https://www.twitch.tv/channel');
    f.document.getElementById = () => null;
    f.location.href = 'https://www.twitch.tv/directory'; f.api.sync();
    assert.deepEqual(f.clicks, []);
    f.document.getElementById = id => id === 'browse-sort-drop-down' ? f.control : { getAttribute: () => 'option', click() { assert.fail('stale selection'); } };
    f.control.click(); f.api.sync();
    assert.deepEqual(f.clicks, ['control']);
    f.control.click(); f.api.sync();
    f.location.href = 'https://www.twitch.tv/directory?sort=RECOMMENDED'; f.flush();
    assert.equal(f.clicks.filter(c => c === 'option').length, 0);
});
