// Default Twitch's native directory queries to descending viewer count.
(function () {
    'use strict';
    if (window.__ypftDirectory) return;
    let pending = false, failedUrl = null;

    function defaultSortUrl(value) {
        const url = new URL(value);
        if (!/^\/directory(?:\/(?:all|gaming|irl|music|creative|esports)|\/(?:category|game)\/[^/]+)?\/?$/.test(url.pathname) ||
            url.searchParams.has('sort') || url.searchParams.has('ypft-kick')) return null;
        url.searchParams.set('sort', 'VIEWER_COUNT');
        return url.href;
    }

    function sync() {
        const url = defaultSortUrl(window.location.href);
        if (!url || pending || failedUrl === window.location.href) return;
        const control = document.getElementById('browse-sort-drop-down');
        if (!control || control.getAttribute('aria-expanded') === 'true') return;
        const originalUrl = window.location.href;
        pending = true;
        // Use Twitch's native control so its query, results and displayed selection agree.
        // Both category and channel directories put descending viewer count after Recommended.
        control.click();
        const select = (attempt = 0) => {
            if (window.location.href !== originalUrl || !control.isConnected ||
                control.getAttribute('aria-expanded') !== 'true') { pending = false; return; }
            const option = document.getElementById('browse-sort-drop-down-opt1');
            if (option?.getAttribute('role') === 'option') {
                option.click();
                pending = false;
            } else if (attempt < 3) {
                setTimeout(() => select(attempt + 1), 50);
            } else {
                control.click();
                failedUrl = originalUrl;
                pending = false;
            }
        };
        setTimeout(select, 0);
    }

    window.__ypftDirectory = Object.freeze({ sync, defaultSortUrl });
    window.addEventListener('popstate', sync);
    sync();
})();
