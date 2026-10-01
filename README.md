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
- Enable **Highest Twitch quality** to keep the Twitch background stream set to Source (e.g. 1080p60).

### Experimental Twitch Interruption Blocking (VAFT)
- **Experimental and off by default.** In the YouTube navigation menu, enable **Interruption blocking**, marked **Experimental**. Changing it saves the preference and reloads Twitch so its player hooks start early or are fully removed.
- This bundles the pinned TwitchAdSolutions VAFT v37.0.0 algorithm, which filters Twitch advertising segments and requests alternate Twitch playback tokens/playlists. It runs only on Twitch; YouTube requests and the embedded player retain their own behavior.
- If another VAFT installation is active, disable that individual script before enabling the integrated option, then reload Twitch. Leave unrelated scripts/extensions enabled. The integrated version skips an already-detected VAFT or Worker wrapper.
- Twitch recovery is suspended while YouTube owns playback. Restore Twitch preserves your original pause, mute and volume settings, including after a toggle reload. Already-open Twitch tabs show a reload action when their hooks differ from the saved setting.
- The feature adds `scripting` and `https://www.twitch.tv/*` host permission for persistent MAIN-world registration at `document_start`. It adds no all-sites access, media-host privileges, telemetry or remote updater. Chrome 102+ is required.
- Worker startup and YouTube coordination were checked in the integrated browser. Actual interruption efficacy, real HEVC fallback and Chrome Web Store acceptance remain unverified. VAFT still dynamically evaluates Twitch's player worker source in a Blob worker. Temporary alternate-playlist quality reductions are possible. See [source and adapter notes](vendor/vaft/README.md) and [verification checklist](docs/vaft-qa.md).


### Restoring Twitch
- Click **Restore Twitch** to remove YouTube and restore the original Twitch pause, mute and volume settings.

### Floating Chat
- Open **Additional settings → Chat** in the YouTube menu and enable **Floating chat**. It defaults off; when enabled, it defaults to **Fullscreen only**. Use the **Fullscreen with chat** button on the player to expand YouTube with Twitch chat, or Twitch's own fullscreen control when watching Twitch.
- Drag the chat header to move it and its bottom-right handle to resize it. Both controls also support arrow keys. **Chat appearance** offers always-on-player mode, background color/opacity, text size, compact spacing, click-through and a position/size reset.
- This read-only overlay reuses the current Twitch chat, including badges and emotes already rendered there. Keep Twitch chat open; the overlay does not create its own chat connection or add emote providers. Send messages and use moderation controls in the normal Twitch chat.
- Recent mirrored messages stay in memory only, capped at 60. Updates are batched and observation stops when the overlay is hidden. Preferences and position are stored locally. No new permissions or framework dependencies are added.
- Inspired by [Floating Twitch Chat](https://github.com/xD33m/floating_twitch_chat), with an original implementation built for YPFT. See [verification notes](docs/floating-chat-qa.md).

### Additional settings
- Expand **Additional settings** in the YouTube menu for Playback, Chat and Player extras. The section defaults collapsed to keep the stream controls compact.
- **Hide Twitch extensions** hides native player-extension overlays and buttons immediately, persists locally, and follows Twitch player replacement and navigation. It does not uninstall extensions or stop their code/network requests. YouTube and floating chat are unaffected.

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

Run the extension tests and build the package with Node.js:

```bash
npm test
npm run build
```

The build writes a validated `release.zip` in the repository root and checks that the bundled VAFT adapter matches its pinned, reviewed source. It does not publish or submit the feature. Regenerate the adapter offline with `node scripts/prepare-vaft.mjs` after reviewing any adapter change.

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

MIT License. Free to use and modify. Bundled VAFT retains the TwitchAdSolutions Contributors' [MIT license](vendor/vaft/LICENSE).

---

<p align="center">Made for the streaming community 💜</p>
