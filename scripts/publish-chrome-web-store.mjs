import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const EXTENSION_ID = 'pkhipedofkjfffichjllpmoajlfndpad';
const API_ROOT = 'https://chromewebstore.googleapis.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function compareVersions(left, right) {
    const parse = version => {
        if (typeof version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(version)) {
            throw new Error(`Invalid Chrome extension version: ${version}`);
        }
        return version.split('.').map(Number);
    };

    const a = parse(left);
    const b = parse(right);
    for (let index = 0; index < 4; index++) {
        const difference = (a[index] ?? 0) - (b[index] ?? 0);
        if (difference !== 0) return Math.sign(difference);
    }
    return 0;
}

export function getKnownStoreVersions(status) {
    const revisions = [status?.publishedItemRevisionStatus, status?.submittedItemRevisionStatus];
    return revisions.flatMap(revision => (revision?.distributionChannels ?? [])
        .map(channel => channel.crxVersion)
        .filter(version => typeof version === 'string'));
}

export function shouldSkipVersion(status, targetVersion) {
    return getKnownStoreVersions(status).some(version => compareVersions(version, targetVersion) >= 0);
}

async function requestJson(url, options, operation) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`${operation} failed with HTTP ${response.status}`);
    }
    return response.json();
}

async function fetchStatus(publisherId, accessToken) {
    const item = `publishers/${encodeURIComponent(publisherId)}/items/${EXTENSION_ID}`;
    return requestJson(`${API_ROOT}/v2/${item}:fetchStatus`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    }, 'Chrome Web Store status check');
}

async function waitForUpload(publisherId, accessToken, initialState) {
    let state = initialState;
    for (let attempt = 0; attempt < 12; attempt++) {
        if (state === 'SUCCEEDED') return;
        if (state === 'FAILED' || state === 'NOT_FOUND') {
            throw new Error(`Chrome Web Store package upload ended in ${state}`);
        }
        if (state !== 'IN_PROGRESS' && state !== 'UPLOAD_IN_PROGRESS') {
            throw new Error(`Chrome Web Store returned an unexpected upload state: ${state}`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        const status = await fetchStatus(publisherId, accessToken);
        state = status.lastAsyncUploadState;
    }
    throw new Error('Chrome Web Store package upload did not finish within 60 seconds');
}

export async function publishRelease({ env = process.env, root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
    const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID } = env;
    if (![CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID].every(Boolean)) {
        throw new Error('Set CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, and CWS_PUBLISHER_ID before publishing');
    }

    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    const releaseZip = await readFile(path.join(root, 'release.zip'));
    const targetVersion = manifest.version;
    compareVersions(targetVersion, targetVersion);

    const tokenResponse = await requestJson(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CWS_CLIENT_ID,
            client_secret: CWS_CLIENT_SECRET,
            refresh_token: CWS_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        })
    }, 'Google OAuth token refresh');
    if (!tokenResponse.access_token) throw new Error('Google OAuth token refresh returned no access token');

    const accessToken = tokenResponse.access_token;
    const status = await fetchStatus(CWS_PUBLISHER_ID, accessToken);
    const knownVersions = getKnownStoreVersions(status);
    if (shouldSkipVersion(status, targetVersion)) {
        console.log(`Skipping Chrome Web Store release ${targetVersion}; the same or a newer version is already published or submitted.`);
        return { outcome: 'skipped', targetVersion, knownVersions };
    }
    if (knownVersions.length === 0) {
        throw new Error('Chrome Web Store returned no published or submitted package version; refusing to upload without a duplicate check');
    }

    const item = `publishers/${encodeURIComponent(CWS_PUBLISHER_ID)}/items/${EXTENSION_ID}`;
    const upload = await requestJson(`${API_ROOT}/upload/v2/${item}:upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/zip'
        },
        body: releaseZip
    }, 'Chrome Web Store package upload');

    if (upload.crxVersion && upload.crxVersion !== targetVersion) {
        throw new Error(`Chrome Web Store accepted version ${upload.crxVersion}, but manifest.json declares ${targetVersion}`);
    }
    await waitForUpload(CWS_PUBLISHER_ID, accessToken, upload.uploadState);

    await requestJson(`${API_ROOT}/v2/${item}:publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
    }, 'Chrome Web Store review submission');
    console.log(`Submitted Chrome Web Store version ${targetVersion} for review.`);
    return { outcome: 'submitted', targetVersion, knownVersions };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    publishRelease().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
