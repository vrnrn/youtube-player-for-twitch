// Side panel script

const TWITCH_URL = 'https://www.twitch.tv/popout/{channel}/chat?darkpopout';

const elements = {
    setup: document.getElementById('setup'),
    hint: document.getElementById('hint'),
    channelInput: document.getElementById('channel'),
    connectBtn: document.getElementById('connect'),
    chat: document.getElementById('chat'),
    channelName: document.getElementById('channelName'),
    changeBtn: document.getElementById('change'),
    frame: document.getElementById('frame')
};

function connect(channel) {
    if (!channel) return;

    channel = channel.toLowerCase().trim();
    elements.frame.src = TWITCH_URL.replace('{channel}', channel);
    elements.channelName.textContent = '📺 ' + channel;
    elements.setup.classList.add('hidden');
    elements.chat.classList.add('active');

    // Save to storage
    chrome.storage.local.set({ lastChannel: channel });
}

function showSetup() {
    elements.setup.classList.remove('hidden');
    elements.chat.classList.remove('active');
    elements.frame.src = 'about:blank';
}

// Events
elements.connectBtn.onclick = () => connect(elements.channelInput.value);
elements.channelInput.onkeydown = (e) => {
    if (e.key === 'Enter') connect(elements.channelInput.value);
};
elements.changeBtn.onclick = showSetup;

// Load last used channel
chrome.storage.local.get(['lastChannel'], (result) => {
    if (result.lastChannel) {
        connect(result.lastChannel);
    }
});

// Try to get channel suggestion from current YouTube tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.url?.includes('youtube.com/watch')) {
        // Extract from title as a simple heuristic
        const title = tab.title || '';
        // YouTube titles are usually "Video Title - Channel Name - YouTube"
        const parts = title.split(' - ');
        if (parts.length >= 2) {
            const channelGuess = parts[parts.length - 2]
                ?.toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[^a-z0-9_]/g, '');
            if (channelGuess && channelGuess.length > 2) {
                elements.hint.textContent = 'Suggested: ' + channelGuess;
                elements.channelInput.value = channelGuess;
            }
        }
    }
});
