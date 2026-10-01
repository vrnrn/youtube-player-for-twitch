// Deterministic, offline adapter. The clean upstream copy remains untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const upstream = readFileSync(new URL('vendor/vaft/vaft.upstream.user.js', root), 'utf8');
const sha = '06861594a5e6e984ec3da73a4f25d84bea6a816b97ab7cbf4c80fa205583b3ee';
if (createHash('sha256').update(upstream).digest('hex') !== sha) throw new Error('Unreviewed VAFT source');
let source = upstream.slice(upstream.indexOf('(function()'));
function patch(before, after) {
    if (source.split(before).length !== 2) throw new Error(`VAFT patch did not match uniquely: ${before.slice(0, 80)}`);
    source = source.replace(before, after);
}
function range(from, to, replacement) {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start);
    if (start < 0 || end < 0) throw new Error('VAFT range missing');
    source = source.slice(0, start) + replacement + source.slice(end);
}
range('    const ourTwitchAdSolutionsVersion', '    function declareOptions', `    if (!window.__ypftVaft?.canStart()) return;
    // Any existing VAFT version is a conflict. Never tear down another worker hook.
    if (typeof window.twitchAdSolutionsVersion !== 'undefined') {
        window.__ypftVaft.report('conflict');
        return;
    }
    window.twitchAdSolutionsVersion = 24;
    const ypftRealFetch = window.fetch;
`);
patch('const twitchWorkers = [];', 'const twitchWorkers = new Set();');
range('    const workerStringConflicts', '    function hookWindowWorker()', '');
patch('        const reinsert = getWorkersForReinsert(window.Worker);', '');
patch('class Worker extends getCleanWorker(window.Worker)', 'class Worker extends window.Worker');
patch("isTwitchWorker = new URL(twitchBlobUrl).origin.endsWith('.twitch.tv');", `const origin = new URL(String(twitchBlobUrl), location.href).origin;
                    const parsed = new URL(origin);
                    isTwitchWorker = parsed.protocol === 'https:' && (parsed.hostname === 'twitch.tv' || parsed.hostname.endsWith('.twitch.tv')) && options?.type !== 'module';`);
patch("const workerString = getWasmWorkerJs('${twitchBlobUrl.replaceAll(\"'\", \"%27\")}');", 'const workerString = getWasmWorkerJs(${JSON.stringify(String(twitchBlobUrl))});');
for (const name of ['GQLDeviceID', 'AuthorizationHeader', 'ClientIntegrityHeader', 'ClientVersion', 'ClientSession']) {
    const old = name === 'AuthorizationHeader' ? 'undefined' : 'null';
    patch(`${name} = \${${name} ? "'" + ${name} + "'" : ${old}};`, `${name} = \${JSON.stringify(${name}) || 'undefined'};`);
}
patch('                    eval(workerString);', `                    try {
                        eval(workerString);
                        postMessage({ key: 'YPFTVaftWorkerReady' });
                    } catch (error) {
                        postMessage({ key: 'YPFTVaftWorkerError' });
                        throw error;
                    }`);
patch('                super(URL.createObjectURL(new Blob([newBlobStr])), options);\n                twitchWorkers.push(this);', `                const blobUrl = URL.createObjectURL(new Blob([newBlobStr]));
                try { super(blobUrl, options); }
                catch (error) {
                    URL.revokeObjectURL(blobUrl);
                    window.__ypftVaft.fail();
                    throw error;
                }
                twitchWorkers.add(this);
                const terminate = this.terminate.bind(this);
                this.terminate = () => {
                    twitchWorkers.delete(this);
                    URL.revokeObjectURL(blobUrl);
                    return terminate();
                };
                this.addEventListener('error', () => {
                    URL.revokeObjectURL(blobUrl);
                    window.__ypftVaft.fail();
                }, { once: true });`);
patch("                    if (e.data.key == 'UpdateAdBlockBanner') {", `                    if (e.data?.key === 'YPFTVaftWorkerReady') {
                        URL.revokeObjectURL(blobUrl);
                        window.__ypftVaft.report('worker-ready');
                    } else if (e.data?.key === 'YPFTVaftWorkerError') {
                        URL.revokeObjectURL(blobUrl);
                        window.__ypftVaft.fail();
                    } else if (e.data?.key == 'UpdateAdBlockBanner') {`);
range('        let workerInstance = reinsertWorkers', '    function getWasmWorkerJs', `        window.Worker = newWorker;
    }
`);
patch('        return req.responseText;', `        if (req.status !== 0 && (req.status < 200 || req.status >= 300)) throw new Error('Twitch worker unavailable');
        return req.responseText;`);
// Limit worker playlist handling to Twitch's media CDN, preserving other URLs verbatim.
patch("            if (typeof url === 'string') {\n                if (AdSegmentCache.has(url)) {", `            let isTwitchMedia = false;
            try {
                const parsed = new URL(url);
                isTwitchMedia = parsed.protocol === 'https:' && ['twitch.tv', 'ttvnw.net'].some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
            } catch {}
            if (typeof url === 'string' && isTwitchMedia) {
                if (AdSegmentCache.has(url)) {`);
// Twitch can omit SERVER-TIME; keep the original playlist in that case.
if (source.split('return matches.length > 1 ? matches[1] : null;').length !== 3) throw new Error('VAFT server time patch mismatch');
source = source.replaceAll('return matches.length > 1 ? matches[1] : null;', 'return matches && matches.length > 1 ? matches[1] : null;');
// Upstream didn't propagate asynchronous playlist parsing failures to its outer promise.
source = source.replaceAll(`return realFetch(url, options).then(function(response) {
                                processAfter(response);
                            })`, 'return realFetch(url, options).then(processAfter)');
patch('                                pendingFetchRequests.delete(responseData.id);', '                                pendingFetchRequests.delete(responseData.id);\n                                clearTimeout(timeout);');
patch('const { resolve, reject } = pendingFetchRequests.get(responseData.id);', 'const { resolve, reject, timeout } = pendingFetchRequests.get(responseData.id);');
patch('            pendingFetchRequests.set(requestId, {\n                resolve,\n                reject\n            });', `            const timeout = setTimeout(() => {
                pendingFetchRequests.delete(requestId);
                reject(new Error('Twitch token request timed out'));
            }, 15000);
            pendingFetchRequests.set(requestId, { resolve, reject, timeout });`);
patch('    function doTwitchPlayerTask(isPausePlay, isReload) {', `    function doTwitchPlayerTask(isPausePlay, isReload) {
        if (window.__ypftVaft.ownsPlayback()) return;`);
patch('    function monitorPlayerBuffering() {', `    function monitorPlayerBuffering() {
        if (window.__ypftVaft.ownsPlayback()) {
            playerForMonitoringBuffering = null;
            playerBufferState.numSame = 0;
            setTimeout(monitorPlayerBuffering, PlayerBufferingDelay);
            return;
        }`);
range('    async function handleWorkerFetchRequest', '    function onContentLoaded()', `    async function handleWorkerFetchRequest(fetchRequest) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            if (fetchRequest?.url !== 'https://gql.twitch.tv/gql' || fetchRequest.options?.method !== 'POST') {
                throw new Error('Unsupported Twitch worker request');
            }
            const response = await ypftRealFetch(fetchRequest.url, { ...fetchRequest.options, signal: controller.signal });
            return {
                id: fetchRequest.id, status: response.status, statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()), body: await response.text()
            };
        } catch (error) {
            return { id: fetchRequest?.id, error: error.message };
        } finally { clearTimeout(timer); }
    }
    function hookFetch() {
        window.fetch = function(url, init, ...args) {
            // YouTube / other page requests (including Request objects) pass through unchanged.
            let isTwitchGql = false;
            try {
                const parsed = new URL(url);
                isTwitchGql = parsed.protocol === 'https:' && parsed.hostname === 'gql.twitch.tv' && parsed.pathname === '/gql';
            } catch {}
            if (typeof url !== 'string' || !isTwitchGql) {
                return ypftRealFetch.call(this, url, init, ...args);
            }
            try {
                const headers = new Headers(init?.headers);
                for (const [header, key, current] of [
                    ['X-Device-Id', 'UpdateDeviceId', GQLDeviceID],
                    ['Client-Version', 'UpdateClientVersion', ClientVersion],
                    ['Client-Session-Id', 'UpdateClientSession', ClientSession],
                    ['Client-Integrity', 'UpdateClientIntegrityHeader', ClientIntegrityHeader],
                    ['Authorization', 'UpdateAuthorizationHeader', AuthorizationHeader]
                ]) {
                    const value = headers.get(header) || (header === 'X-Device-Id' ? headers.get('Device-ID') : null);
                    if (value !== null && value !== current) {
                        if (key === 'UpdateDeviceId') GQLDeviceID = value;
                        if (key === 'UpdateClientVersion') ClientVersion = value;
                        if (key === 'UpdateClientSession') ClientSession = value;
                        if (key === 'UpdateClientIntegrityHeader') ClientIntegrityHeader = value;
                        if (key === 'UpdateAuthorizationHeader') AuthorizationHeader = value;
                        postTwitchWorkerMessage(key, value);
                    }
                }
                if (ForceAccessTokenPlayerType && typeof init?.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                    const body = JSON.parse(init.body);
                    for (const item of Array.isArray(body) ? body : [body]) {
                        if (item?.variables?.playerType) item.variables.playerType = ForceAccessTokenPlayerType;
                    }
                    init = { ...init, body: JSON.stringify(body) };
                }
            } catch { /* Malformed or non-JSON requests retain their original behavior. */ }
            return ypftRealFetch.call(this, url, init, ...args);
        };
    }
`);
// Keep upstream storage/quality preservation; remove visibility spoofing and focus autoplay.
range('        // This stops Twitch from pausing', '        // Hooks for preserving volume', '');
patch('    hookWindowWorker();\n    hookFetch();', `    try {
        hookWindowWorker();
        hookFetch();
        window.__ypftVaft.report('hooks-ready');
    } catch (error) {
        window.__ypftVaft.rollback();
        return;
    }`);
patch("adBlockDiv.P.textContent = 'Blocking' + (data.isMidroll ? ' midroll' : '') + ' ads' + (data.isStrippingAdSegments ? ' (stripping)' : '');", "adBlockDiv.P.textContent = 'Blocking Twitch interruptions (VAFT · Experimental)';");
// MAIN-world caching must observe quality writes from YPFT's ISOLATED world.
patch('                    return cachedValues.get(key);', `                    const current = realGetItem.call(this, key);
                    cachedValues.set(key, current);
                    return current;`);
// Native Twitch worker messages are not required to be objects.
source = source.replaceAll('e.data.key', 'e.data?.key').replaceAll('event.data.key', 'event.data?.key');
// No developer simulation globals on production Twitch pages.
range('    window.simulateAds =', '})();', '');
const output = `// Generated by scripts/prepare-vaft.mjs from VAFT v37.0.0 (${sha}).
// Copyright (c) 2020-present TwitchAdSolutions Contributors. MIT; see vendor/vaft/LICENSE.
// Adapter rationale and limitations: vendor/vaft/README.md. No remote updater.
${source}`;
const target = new URL('vendor/vaft/vaft.js', root);
if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Generated VAFT adapter is stale');
} else writeFileSync(target, output);
