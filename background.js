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

    if (request.type === 'GET_VIDEO_DETAILS') {
        handleVideoDetails(request.videoId)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
});

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
