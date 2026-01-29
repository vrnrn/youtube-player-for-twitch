# YouTube Player for Twitch

**Watch YouTube livestreams with Twitch chat.**

A Chrome extension that lets you overlay any YouTube livestream on top of a Twitch channel player, keeping the Twitch chat and interface intact. Perfect for when your favorite streamer switches platforms or when you want the superior YouTube video quality with Twitch's superior chat experience.


[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/youtube-player-for-twitch/pkhipedofkjfffichjllpmoajlfndpad)

![Icon](icons/icon128.png)

## ✨ Features

### 📺 Watch YouTube on Twitch
- Replace the Twitch video player with a YouTube livestream
- Keeps Twitch chat, badges, and channel points visible and interactive
- Automutes the underlying Twitch player
- Supports 4K/60fps YouTube playback

### 🔍 Auto-Find Stream
- **Smart Search**: Automatically finds the YouTube stream for the current Twitch channel
- **Fuzzy Matching**: Intelligent matching works even if channel names differ slightly (e.g. `burntpeanut` vs `TheBurntPeanut`)
- **Live Filter**: Only suggests actual active livestreams

### ⚡ Auto-Sync
- **Jump to Live**: One-click button to seek to the absolute live edge
- **Smart Catch-up**: Speeds up playback (2x) briefly to close the latency gap
- **Auto-Sync**: Optional setting to automatically re-sync every 10 minutes

### 💾 Smart Persistence
- **Auto-Restore**: Remembers your active YouTube stream if you reload the page
- **Navigation Aware**: Handles switching between channels intelligently—keeps the stream when reloading, but resets when you click a different Twitch channel
- **Per-Channel Memory**: Remembers the last YouTube URL you watched for every Twitch channel
- **Recent History**: Keeps track of the last 5 YouTube streams you've watched, allowing for quick access.
- **Pin Favorites**: Pin your favorite channels in the history list to keep them permanently available.
- **Force Highest Quality**: Optional setting to automatically enforce "Source" (maximum) quality on the underlying Twitch stream to ensure a crisp viewing experience.

## 🚀 Usage

1. **Install** the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/youtube-player-for-twitch/pkhipedofkjfffichjllpmoajlfndpad)
2. Go to any **Twitch Channel**
3. Click the **▶ YouTube** button in the top navigation bar

### Finding a Stream
- **Option A (Automatic)**: Click "🔍 Find YouTube Stream" to search for the streamer's YouTube live.
- **Option B (Manual)**: Paste any YouTube URL (video, live, or embed link) and click "Go".

### Syncing
- Click **⚡ Sync Now** to jump to the live edge.
- Enable **Auto-sync** to keep it synced automatically in the background.

### Quality Control
- Enable **Force Highest Quality (Source)** to automatically set the Twitch background stream to the maximum available resolution (e.g. 1080p60).


### Restoring Twitch
- Click **Restore Twitch** to remove the YouTube player and unmute the original stream.

## 📦 Installation (Developer Mode)

1. Clone or download this repository
    ```bash
    git clone https://github.com/yourusername/youtube-on-twitch.git
    ```
2. Open Chrome and navigate to `chrome://extensions`
3. Toggle **Developer mode** in the top right
4. Click **Load unpacked**
5. Select the extension folder

## 🛠 Tech Stack

- **Manifest V3**: Modern, secure extension architecture
- **Service Worker**: Handles cross-origin search requests securely
- **Content Script**: Injects UI and manages the players
- **Shadow DOM / Iframe**: Isolates the YouTube player

## 📄 License

MIT License. Free to use and modify.

---

<p align="center">Made for the streaming community 💜</p>
