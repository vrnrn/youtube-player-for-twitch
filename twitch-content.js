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

    function createNavButton() {
        // Create a wrapper that matches Twitch's nav item styling
        const wrapper = document.createElement('div');
        wrapper.id = 'tcfy-nav-wrapper';
        wrapper.style.cssText = 'position:relative;display:flex;align-items:center;margin-left:10px;';

        wrapper.innerHTML = `
          <button class="tcfy-nav-btn" id="tcfy-yt-toggle">
            <span style="margin-right:5px;">▶</span>YouTube
          </button>
          <div class="tcfy-dropdown" id="tcfy-yt-panel">
            <div class="tcfy-dropdown-header">
              <span>Watch YouTube Stream</span>
              <button class="tcfy-dropdown-close" id="tcfy-yt-close">×</button>
            </div>
            <div class="tcfy-dropdown-body">
              <input type="text" id="tcfy-yt-url" placeholder="Paste YouTube URL" />
              <button id="tcfy-yt-go">Go</button>
            </div>
            <button class="tcfy-dropdown-restore" id="tcfy-yt-restore">Restore Twitch</button>
          </div>
        `;
        return wrapper;
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

    function pauseTwitchPlayer() {
        // Try to pause/mute Twitch's video element
        const video = document.querySelector('video');
        if (video) {
            video.pause();
            video.muted = true;
            state.twitchVideo = video;
        }
    }

    function resumeTwitchPlayer() {
        if (state.twitchVideo) {
            state.twitchVideo.muted = false;
            state.twitchVideo.play().catch(() => { });
        }
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

        // Pause Twitch audio
        pauseTwitchPlayer();

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
        document.getElementById('tcfy-yt-panel').classList.remove('visible');
        const toggle = document.getElementById('tcfy-yt-toggle');
        toggle.innerHTML = '<span style="margin-right:5px;">🔴</span>Live';
        toggle.classList.add('active');
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

        // Resume Twitch audio
        resumeTwitchPlayer();

        // Update UI
        const toggle = document.getElementById('tcfy-yt-toggle');
        toggle.innerHTML = '<span style="margin-right:5px;">▶</span>YouTube';
        document.getElementById('tcfy-yt-restore').style.display = 'none';
        state.youtubeUrl = null;
    }

    function init() {
        if (state.initialized) return;

        // Find the left side of the nav bar (contains Twitch logo, Following, Browse, More Options)
        const leftNav = document.querySelector('.top-nav__menu > div:first-child') ||
            document.querySelector('button[aria-label="More Options"]')?.closest('div[class]')?.parentElement;

        if (!leftNav) {
            console.log('[TCFY] Nav bar not found');
            return;
        }

        // Already injected?
        if (document.getElementById('tcfy-nav-wrapper')) return;

        // Create and inject nav button
        const navBtn = createNavButton();
        leftNav.appendChild(navBtn);

        // Event listeners
        const toggleBtn = document.getElementById('tcfy-yt-toggle');
        const panel = document.getElementById('tcfy-yt-panel');
        const closeBtn = document.getElementById('tcfy-yt-close');
        const urlInput = document.getElementById('tcfy-yt-url');
        const goBtn = document.getElementById('tcfy-yt-go');
        const restoreBtn = document.getElementById('tcfy-yt-restore');

        toggleBtn.onclick = () => panel.classList.toggle('visible');
        closeBtn.onclick = () => panel.classList.remove('visible');

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

        // Look for nav bar
        if (document.querySelector('.top-nav__menu') || document.querySelector('button[aria-label="More Options"]')) {
            init();
        } else {
            setTimeout(check, 1500);
        }
    }

    setTimeout(check, 1000);
})();
