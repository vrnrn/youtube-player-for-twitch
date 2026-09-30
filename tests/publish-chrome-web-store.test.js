const assert = require('node:assert/strict');
const test = require('node:test');

async function loadPublisher() {
    return import('../scripts/publish-chrome-web-store.mjs');
}

test('Chrome Web Store version comparisons use numeric components', async () => {
    const { compareVersions } = await loadPublisher();
    assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
    assert.equal(compareVersions('1.4.0', '1.4'), 0);
    assert.equal(compareVersions('1.3.9', '1.4.0'), -1);
    assert.throws(() => compareVersions('1.4.0-beta', '1.4.0'), /Invalid Chrome extension version/);
});

test('release guard skips versions already published or submitted', async () => {
    const { getKnownStoreVersions, shouldSkipVersion } = await loadPublisher();
    const status = {
        publishedItemRevisionStatus: {
            distributionChannels: [{ crxVersion: '1.3.0' }]
        },
        submittedItemRevisionStatus: {
            distributionChannels: [{ crxVersion: '1.4.0' }]
        }
    };

    assert.deepEqual(getKnownStoreVersions(status), ['1.3.0', '1.4.0']);
    assert.equal(shouldSkipVersion(status, '1.4.0'), true);
    assert.equal(shouldSkipVersion(status, '1.3.1'), true);
    assert.equal(shouldSkipVersion(status, '1.4.1'), false);
});
