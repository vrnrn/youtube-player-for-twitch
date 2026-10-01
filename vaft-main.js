// MAIN world, Twitch top frame only. DOM state communicates playback ownership and
// diagnostics; it never grants access to Chrome APIs or accepts privileged commands.
(() => {
    'use strict';
    if (location.origin !== 'https://www.twitch.tv' || window.top !== window) return;
    if (window.__ypftVaft) return;
    let status = 'starting';
    const publish = () => document.documentElement?.setAttribute('data-ypft-vaft', status);
    const originalWorker = window.Worker;
    const originalFetch = window.fetch;
    const workerDescriptor = Object.getOwnPropertyDescriptor(window, 'Worker');
    const api = Object.freeze({
        canStart: () => status === 'starting',
        ownsPlayback: () => document.documentElement?.getAttribute('data-ypft-playback') === 'youtube',
        report(value) { if (status !== 'error') status = value; publish(); },
        fail() {
            status = 'error';
            publish();
        },
        rollback() {
            if (workerDescriptor) Object.defineProperty(window, 'Worker', workerDescriptor);
            else window.Worker = originalWorker;
            window.fetch = originalFetch;
            this.fail();
        }
    });
    Object.defineProperty(window, '__ypftVaft', { value: api });
    if (typeof window.twitchAdSolutionsVersion !== 'undefined' ||
        !Function.prototype.toString.call(originalWorker).includes('[native code]')) {
        api.report('conflict');
    }
    publish();
    document.addEventListener('DOMContentLoaded', publish, { once: true });
})();
