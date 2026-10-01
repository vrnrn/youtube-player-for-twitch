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
- **Smart Search**: Checks the streamer's linked YouTube channel first, then searches by Twitch channel name
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
- **Option A (Automatic)**: Click "🔍 Find YouTube Stream" to check the streamer's linked YouTube channel for a live stream. If no linked stream is live, the extension falls back to searching by Twitch channel name.
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
    git clone https://github.com/vrnrn/youtube-player-for-twitch.git
    ```
2. Open Chrome and navigate to `chrome://extensions`
3. Toggle **Developer mode** in the top right
4. Click **Load unpacked**
5. Select the extension folder

## Development

Run the background-script tests and build the Chrome Web Store package with Node.js:

```bash
npm test
npm run build
```

The build writes a validated `release.zip` in the repository root.

### GitHub Actions release pipeline

Pull requests targeting `main` run `npm test` and build `release.zip`. Each successful push to `main`, including a merged pull request, also creates a GitHub Release with the built `release.zip` and its matching `manifest.json`. The extension version in the release adds the GitHub Actions run number as a fourth component, such as `1.4.0.42`; the fourth component is the build number. The checked-in base version is left unchanged.

Chrome Web Store submission is manual. Run **Publish Chrome Web Store** from the Actions tab; it selects the highest numbered generated GitHub Release and submits those exact assets. The submission job is restricted to the maintainer account, including for reruns. Since this repository is public, workflow files, run logs, and releases remain publicly visible; GitHub requires write access to manually dispatch a workflow. Pull request builds never receive publishing credentials. The workflow uses standard GitHub-hosted Ubuntu runners.

To enable publishing, create Chrome Web Store API OAuth credentials for the Google account that owns the listing, authorize the `https://www.googleapis.com/auth/chromewebstore` scope, and add these repository Actions secrets: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, and `CWS_REFRESH_TOKEN`. This is a publisher-level write scope, not an extension-specific grant: it can operate on any Chrome Web Store item the authorized account can manage. Add the repository Actions variable `CWS_PUBLISHER_ID`. Keep credential entry in GitHub's secret fields; never commit or paste the values into chat. See Google's [Chrome Web Store API setup guide](https://developer.chrome.com/docs/webstore/using-api) for obtaining the credentials and publisher ID.

Google OAuth refresh tokens for external apps in Testing expire after 7 days when using this Chrome Web Store scope. For reliable unattended publishing, use a production OAuth configuration and complete any verification Google requires for this sensitive scope (personal-use exceptions may apply). See Google's [refresh token expiration guidance](https://developers.google.com/identity/protocols/oauth2#expiration) and [sensitive-scope verification guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

The publish script checks the currently published and submitted Chrome Web Store versions before uploading, so a rerun or a version already submitted manually is skipped. A successful workflow means the update was submitted for review; Google controls when it becomes publicly available.

## 🛠 Tech Stack

- **Manifest V3**: Modern, secure extension architecture
- **Service Worker**: Handles cross-origin search requests securely
- **Content Script**: Injects UI and manages the players
- **Shadow DOM / Iframe**: Isolates the YouTube player

## 📄 License

MIT License. Free to use and modify.

---

<p align="center">Made for the streaming community 💜</p>
