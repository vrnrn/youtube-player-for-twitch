/**
 * YouTube on Twitch - Background Script
 * Handles cross-origin requests and logic
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SEARCH_YOUTUBE') {
        handleSearch(request.query)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true; // Keep channel open for async response
    }

    if (request.type === 'SEARCH_YOUTUBE_CHANNEL') {
        handleChannelSearch(request.channelUrl)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (request.type === 'GET_VIDEO_DETAILS') {
        handleVideoDetails(request.videoId)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
});

function getStreamsPageUrl(channelUrl) {
    try {
        const url = new URL(channelUrl);
        const hostname = url.hostname.toLowerCase();
        if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(hostname)) {
            return null;
        }

        // Do not accidentally search YouTube's home page, a video, or a playlist.
        const path = url.pathname.replace(/\/(streams?|videos|shorts|playlists|community|about|live)\/?$/i, '').replace(/\/+$/, '');
        if (!path || /^\/(watch|shorts|embed|live|playlist)(\/|$)/i.test(path)) return null;

        url.hostname = 'www.youtube.com';
        url.pathname = `${path}/streams`;
        url.search = '';
        url.hash = '';
        return url.href;
    } catch (err) {
        return null;
    }
}

function parseInitialData(html) {
    const assignments = /(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*/g;
    let match;

    while ((match = assignments.exec(html))) {
        const start = html.indexOf('{', assignments.lastIndex);
        if (start < 0) continue;

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < html.length; i++) {
            const character = html[i];

            if (inString) {
                if (escaped) escaped = false;
                else if (character === '\\') escaped = true;
                else if (character === '"') inString = false;
                continue;
            }

            if (character === '"') inString = true;
            else if (character === '{') depth++;
            else if (character === '}' && --depth === 0) {
                try {
                    return JSON.parse(html.slice(start, i + 1));
                } catch (err) {
                    break;
                }
            }
        }
    }

    return null;
}

function collectVideoRenderers(value, results = []) {
    if (Array.isArray(value)) {
        for (const item of value) collectVideoRenderers(item, results);
    } else if (value && typeof value === 'object') {
        if (value.videoRenderer && typeof value.videoRenderer === 'object') {
            results.push(value.videoRenderer);
        } else {
            for (const item of Object.values(value)) collectVideoRenderers(item, results);
        }
    }
    return results;
}

function isLiveVideo(video) {
    const hasLiveBadge = (video.badges || []).some(badge => {
        const renderer = badge.metadataBadgeRenderer || {};
        return /\bLIVE(?:\s+NOW)?\b/i.test(renderer.label || '') ||
            String(renderer.style || '').includes('LIVE_NOW');
    });

    const hasLiveOverlay = (video.thumbnailOverlays || []).some(overlay => {
        const renderer = overlay.thumbnailOverlayTimeStatusRenderer || {};
        const text = renderer.text || {};
        const visibleText = text.simpleText || (text.runs || []).map(run => run.text || '').join('');
        const accessibilityLabel = renderer.accessibility?.accessibilityData?.label || '';
        return renderer.style === 'LIVE' ||
            /\bLIVE(?:\s+NOW)?\b/i.test(`${visibleText} ${accessibilityLabel}`);
    });

    return video.isLive === true || video.isLiveNow === true || hasLiveBadge || hasLiveOverlay;
}

function getText(value) {
    if (value?.simpleText) return value.simpleText;
    if (Array.isArray(value?.runs)) return value.runs.map(run => run.text || '').join('');
    return '';
}

function findLiveChannelStream(data) {
    const video = collectVideoRenderers(data).find(isLiveVideo);
    if (!video?.videoId) return null;

    const channel = getText(video.ownerText) || getText(video.shortBylineText) || 'YouTube Channel';
    return {
        videoId: video.videoId,
        title: getText(video.title) || video.videoId,
        channel,
        isLive: true
    };
}

async function handleChannelSearch(channelUrl) {
    const streamsUrl = getStreamsPageUrl(channelUrl);
    if (!streamsUrl) return { error: 'Invalid YouTube channel URL' };

    try {
        const response = await fetch(streamsUrl, { credentials: 'omit' });
        if (!response.ok) return { error: `YouTube returned HTTP ${response.status}` };

        const data = parseInitialData(await response.text());
        if (!data) return { error: 'Could not parse YouTube channel streams' };

        const stream = findLiveChannelStream(data);
        return { results: stream ? [stream] : [] };
    } catch (err) {
        console.error('Channel search error:', err);
        return { error: err.message };
    }
}

async function handleVideoDetails(videoId) {
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetch(url);
        const html = await response.text();

        // Try to find ytInitialPlayerResponse
        let match = html.match(/var ytInitialPlayerResponse\s*=\s*({.*?});/);
        if (!match) {
            match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/);
        }

        if (match) {
            const data = JSON.parse(match[1]);
            const details = data?.videoDetails;
            if (details) {
                return {
                    title: details.title,
                    channel: details.author,
                    videoId: videoId
                };
            }
        }

        // Fallback to title tag if JSON parsing fails
        const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/);
        if (titleMatch) {
            return {
                title: titleMatch[1],
                channel: 'YouTube Stream', // Best guess fallback
                videoId: videoId
            };
        }

        return { error: 'Could not parse video details' };
    } catch (err) {
        console.error('Details error:', err);
        return { error: err.message };
    }
}

async function handleSearch(query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgJAAQ%3D%3D`;
        const response = await fetch(searchUrl);
        const html = await response.text();

        // extract ytInitialData
        // Try multiple regex patterns to be robust
        let match = html.match(/var ytInitialData\s*=\s*({.*?});/);
        if (!match) {
            match = html.match(/window\["ytInitialData"\]\s*=\s*({.*?});/);
        }

        if (!match) return { error: 'Could not parse YouTube results' };

        const data = JSON.parse(match[1]);
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
            ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

        if (!contents) return { error: 'No results found' };

        // Map results to a simplified format
        const results = [];
        for (const item of contents) {
            const v = item.videoRenderer;
            if (!v) continue;

            const isLive = v.badges?.some(b =>
                b.metadataBadgeRenderer?.label?.toLowerCase().includes('live')
            );

            if (isLive) {
                results.push({
                    videoId: v.videoId,
                    title: v.title?.runs?.[0]?.text || '',
                    channel: v.ownerText?.runs?.[0]?.text || '',
                    isLive: true
                });
            }
        }

        return { results };

    } catch (err) {
        console.error('Search error:', err);
        return { error: err.message };
    }
}
