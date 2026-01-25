/**
 * Twitch Content Script
 * Replaces Twitch player with YouTube livestream while keeping Twitch chat
 */

(function () {
    'use strict';

    // Guard against multiple executions
    if (window.__tcfyTwitchLoaded) return;
    window.__tcfyTwitchLoaded = true;

    let state = {
        initialized: false,
        youtubeUrl: null,
        originalPlayer: null
    };

    function createYouTubeOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'tcfy-yt-overlay';
        overlay.innerHTML = `
      <div class="tcfy-yt-controls">
        <button class="tcfy-yt-toggle" id="tcfy-yt-toggle">📺 Watch YouTube</button>
      </div>
      <div class="tcfy-yt-input-panel" id="tcfy-yt-panel">
        <div class="tcfy-yt-header">
          <span>Replace with YouTube Stream</span>
          <button class="tcfy-yt-close" id="tcfy-yt-close">×</button>
        </div>
        <div class="tcfy-yt-body">
          <input type="text" id="tcfy-yt-url" placeholder="Paste YouTube livestream URL" />
          <button id="tcfy-yt-go">Watch</button>
        </div>
        <button class="tcfy-yt-restore" id="tcfy-yt-restore">Restore Twitch Player</button>
      </div>
    `;
        return overlay;
    }

    function extractVideoId(url) {
        if (!url) return null;
        // Handle various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    function replaceWithYouTube(videoId) {
        if (!videoId) return;

        // Try multiple selectors for the video player area
        const playerContainer = document.querySelector('[data-a-target="video-player-layout"]') ||
            document.querySelector('.video-player__container') ||
            document.querySelector('.video-player') ||
            document.querySelector('[data-a-target="video-player"]');

        if (!playerContainer) {
            console.log('[TCFY] Player container not found');
            return;
        }

        // Create wrapper div
        const wrapper = document.createElement('div');
        wrapper.id = 'tcfy-youtube-wrapper';
        wrapper.style.cssText = 'position:absolute;inset:0;z-index:9999;background:#000;';

        // Create YouTube iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'tcfy-youtube-player';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.style.cssText = 'width:100%;height:100%;border:none;';

        wrapper.appendChild(iframe);

        // Add wrapper to player (don't remove original, just overlay)
        playerContainer.style.position = 'relative';
        playerContainer.appendChild(wrapper);

        // Update UI
        document.getElementById('tcfy-yt-panel').classList.add('hidden');
        document.getElementById('tcfy-yt-toggle').textContent = '🔴 YouTube Active';
        document.getElementById('tcfy-yt-restore').style.display = 'block';

        state.youtubeUrl = videoId;
        chrome.storage?.local?.set({ tcfy_youtube_id: videoId });

        console.log('[TCFY] YouTube player injected:', videoId);
    }

    function restoreTwitchPlayer() {
        const wrapper = document.getElementById('tcfy-youtube-wrapper');
        if (wrapper) {
            wrapper.remove();
        }

        // Update UI
        document.getElementById('tcfy-yt-toggle').textContent = '📺 Watch YouTube';
        document.getElementById('tcfy-yt-restore').style.display = 'none';
        state.youtubeUrl = null;
    }

    function init() {
        if (state.initialized) return;

        // Wait for player to exist
        const playerContainer = document.querySelector('.video-player, [data-a-target="video-player"]');
        if (!playerContainer) return;

        // Create overlay
        const overlay = createYouTubeOverlay();
        document.body.appendChild(overlay);

        // Event listeners
        const toggleBtn = document.getElementById('tcfy-yt-toggle');
        const panel = document.getElementById('tcfy-yt-panel');
        const closeBtn = document.getElementById('tcfy-yt-close');
        const urlInput = document.getElementById('tcfy-yt-url');
        const goBtn = document.getElementById('tcfy-yt-go');
        const restoreBtn = document.getElementById('tcfy-yt-restore');

        toggleBtn.onclick = () => panel.classList.toggle('hidden');
        closeBtn.onclick = () => panel.classList.add('hidden');

        goBtn.onclick = () => {
            const videoId = extractVideoId(urlInput.value);
            if (videoId) replaceWithYouTube(videoId);
        };

        urlInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const videoId = extractVideoId(urlInput.value);
                if (videoId) replaceWithYouTube(videoId);
            }
        };

        restoreBtn.onclick = restoreTwitchPlayer;

        state.initialized = true;
        console.log('[TCFY] Twitch content script initialized');
    }

    // Wait for page to load
    let attempts = 0;
    function check() {
        if (state.initialized || attempts > 15) return;
        attempts++;

        if (document.querySelector('.video-player, [data-a-target="video-player"]')) {
            init();
        } else {
            setTimeout(check, 1500);
        }
    }

    setTimeout(check, 1000);
})();
