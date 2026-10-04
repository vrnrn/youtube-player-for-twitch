// Isolated-world playback owner. The YouTube iframe stays in a stable body portal
// when Twitch replaces its React player/container. Only Twitch's main video is controlled.
(() => {
    'use strict';
    if (window.__ypftPlayback) return;
    const selector = '[data-a-target="video-player-layout"], .video-player__container, .video-player';
    let overlay = null;
    let saved = null;
    let observer = null;
    let resizeObserver = null;
    let observedPlayer = null;
    let timer = null;
    let frame = null;
    let heldVideos = new WeakSet();
    const container = () => document.querySelector(selector);
    const video = () => container()?.querySelector('video');
    function hold(target) {
        if (!target) return;
        if (!saved) saved = { paused: target.paused, muted: target.muted, volume: target.volume };
        heldVideos.add(target);
        if (!target.muted) target.muted = true;
        if (!target.paused) target.pause();
    }
    function sync() {
        if (!overlay) return;
        // An attribute is a nonprivileged ownership signal, never a Chrome API bridge.
        if (document.documentElement.getAttribute('data-ypft-playback') !== 'youtube')
            document.documentElement.setAttribute('data-ypft-playback', 'youtube');
        const player = container();
        if (player !== observedPlayer) {
            resizeObserver?.disconnect();
            observedPlayer = player;
            if (player) resizeObserver?.observe(player);
        }
        hold(player?.querySelector('video'));
        if (document.fullscreenElement === overlay) {
            overlay.style.visibility = 'visible';
            return;
        }
        if (!player) {
            overlay.style.visibility = 'hidden';
            return;
        }
        const rect = player.getBoundingClientRect();
        overlay.style.visibility = rect.width && rect.height ? 'visible' : 'hidden';
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
    }
    function schedule() {
        if (overlay && frame === null) frame = requestAnimationFrame(() => { frame = null; sync(); });
    }
    function onMedia(event) {
        if (overlay && (event.target === video() || heldVideos.has(event.target))) hold(event.target);
    }
    function own(wrapper, restored = null) {
        if (overlay) {
            overlay = wrapper;
            sync();
            return;
        }
        overlay = wrapper;
        if (restored && typeof restored.paused === 'boolean' && typeof restored.muted === 'boolean' &&
            Number.isFinite(restored.volume) && restored.volume >= 0 && restored.volume <= 1) saved = { ...restored };
        document.documentElement.setAttribute('data-ypft-playback', 'youtube');
        resizeObserver = new ResizeObserver(schedule);
        sync();
        observer = new MutationObserver(records => {
            // Chat and menu updates do not move the player. Ignore their busy subtrees.
            if (records.some(record => !record.target.closest?.(
                '#ytot-nav-wrapper, #ytot-chat-root, .chat-scrollable-area__message-container, [data-test-selector="chat-scrollable-area__message-container"]'
            ))) schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Poll also covers resizing, animations and player swaps without DOM mutations.
        timer = setInterval(sync, 250);
        window.addEventListener('resize', schedule);
        document.addEventListener('fullscreenchange', schedule);
        document.addEventListener('scroll', schedule, true);
        for (const name of ['play', 'playing', 'volumechange', 'loadedmetadata']) document.addEventListener(name, onMedia, true);
    }
    function release({ navigation = false } = {}) {
        const current = video();
        overlay = null;
        document.documentElement.removeAttribute('data-ypft-playback');
        observer?.disconnect();
        observer = null;
        resizeObserver?.disconnect();
        resizeObserver = null;
        observedPlayer = null;
        clearInterval(timer);
        timer = null;
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        window.removeEventListener('resize', schedule);
        document.removeEventListener('fullscreenchange', schedule);
        document.removeEventListener('scroll', schedule, true);
        for (const name of ['play', 'playing', 'volumechange', 'loadedmetadata']) document.removeEventListener(name, onMedia, true);
        // Navigation may already have mounted the next channel. Never apply the old
        // channel's audio/play intention to that new player.
        if (saved && current && (!navigation || heldVideos.has(current))) {
            current.volume = saved.volume;
            current.muted = saved.muted;
            if (saved.paused) current.pause();
            else current.play()?.catch(() => {});
        }
        saved = null;
        heldVideos = new WeakSet();
    }
    window.__ypftPlayback = Object.freeze({ own, release, container, snapshot: () => saved ? { ...saved } : null });
})();
