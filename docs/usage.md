# Usage guide

[← Back to the project](../README.md)

## Find and play a stream

Open a Twitch channel and click **▶ YouTube** in the top navigation.

- **Automatic:** Choose **Find YouTube Stream**. The extension checks the streamer's linked YouTube channel first. If it finds no live stream there, it searches YouTube by Twitch channel name and uses fuzzy matching to suggest a live result. Check the title and channel, then click **Use This Stream**. An approximate match can belong to a different channel.
- **Manual:** Paste a YouTube watch, short, live or embed URL, then click **Go**. Ordinary videos work too; the live-sync controls are intended for livestreams.

The YouTube player overlays the Twitch player. Twitch chat, badges, channel points and the surrounding interface remain available. YouTube controls playback and the quality options available for the selected stream; 4K/60fps is possible when supported by the source and embedded player.

## Theatre mode

Open **▶ YouTube** (or **Live** while YouTube is playing) and click **Theatre Mode** to expand Twitch's layout. The menu moves to the top-left of the player in theatre mode; use **Exit Theatre Mode** there to return. The button sits above **Additional settings**, outside YouTube's embedded controls, and is available whenever Twitch provides its native theatre control.

YouTube stays mounted and follows the Twitch player size when you change the layout, including through Twitch's **Alt+T** shortcut when the Twitch page has keyboard focus. You do not need to restore Twitch or reopen the YouTube stream. The button is disabled on pages without a native theatre control and while in fullscreen.

## Sync and quality

Click **Sync Now** to seek toward the live edge. The extension briefly requests 2× playback, then returns to normal speed. This helps catch up but cannot guarantee exact alignment with Twitch chat.

Under **Additional settings → Playback**:

- **Auto-sync** repeats the catch-up action every 10 minutes while YouTube is active.
- **Highest Twitch quality** keeps the underlying Twitch player set to Source, when available. This controls Twitch quality, not YouTube quality.

## History and restoring Twitch

The extension remembers the last YouTube URL used for each Twitch channel and restores an active stream after a page reload. Switching to a different Twitch channel clears the current overlay. Recent history keeps the last five unpinned streams; pin favorites to keep them available.

Click **Restore Twitch** to remove the YouTube player and restore the original Twitch pause, mute and volume settings. Playback state also survives a reload caused by toggling interruption blocking.

## Floating chat

Open **Additional settings → Chat** and enable **Floating chat**. It is off by default; when enabled, its initial mode is **Fullscreen only**.

Use **Fullscreen with chat** on the YouTube player to expand the video with Twitch chat, or Twitch's own fullscreen control when watching Twitch. Keep the normal Twitch chat open so there are messages to mirror.

- Drag the chat header to move it and the bottom-right handle to resize it. Both controls also support arrow keys.
- Open **Chat appearance** for **Always on player** mode, background color, opacity, text size, compact spacing, click-through and **Reset position & size**.
- The overlay is read-only. Send messages and use moderation controls in the normal Twitch chat.

Floating chat reuses messages, badges and emotes already rendered by Twitch. It does not open another chat connection or add emote providers. Up to 60 mirrored messages stay in memory only; updates are batched and observation stops while the overlay is hidden. Preferences and position are stored locally. No additional permissions or framework dependencies are needed.

Inspired by [Floating Twitch Chat](https://github.com/xD33m/floating_twitch_chat), with an original implementation built for this extension. See the [floating-chat verification notes](floating-chat-qa.md).

## Player extras

**Additional settings** groups Playback, Chat and Player extras, and starts collapsed.

**Hide Twitch extensions** hides native Twitch player-extension overlays and buttons immediately. The preference is stored locally and follows Twitch player replacement and navigation. It does not uninstall extensions or stop their code or network requests. YouTube and floating chat remain available.

## Experimental interruption blocking

Under **Additional settings → Player extras**, **Interruption blocking** is marked **Experimental** and is **off by default**. Changing it saves the preference and reloads Twitch so the player hooks start early or are fully removed. Already-open Twitch tabs show a reload action when their hooks differ from the saved setting.

The extension bundles the pinned TwitchAdSolutions VAFT v37.0.0 algorithm. It filters Twitch advertising segments and requests alternate Twitch playback tokens and playlists. It runs only on Twitch; YouTube requests and the embedded player retain their own behavior. Twitch recovery is suspended while YouTube owns playback.

If you use another VAFT installation, disable that individual script before enabling this option, then reload Twitch. Leave unrelated scripts and extensions enabled. The integrated version skips an already-detected VAFT or Worker wrapper.

The feature uses `scripting` permission and `https://www.twitch.tv/*` host access for persistent MAIN-world registration at `document_start`. It adds no all-sites access, media-host privileges, telemetry or remote updater. Chrome 102 or newer is required.

Worker startup and YouTube coordination were checked in the integrated browser. Actual interruption efficacy, real HEVC fallback and Chrome Web Store acceptance remain unverified. VAFT dynamically evaluates Twitch's player-worker source in a Blob worker; alternate playlists can temporarily reduce quality. See the [source and adapter notes](../vendor/vaft/README.md) and [verification checklist](vaft-qa.md).

## Storage and privacy

Settings, recent history, pinned streams and per-channel playback state are stored on your device in Chrome's extension-local storage. You can clear recent history from the menu; removing the extension clears its local storage.

Search and playback requests go from your browser to YouTube and Twitch. The extension has no developer analytics, telemetry service or developer-operated request proxy. Those platforms process their own requests under their own policies. See the full [privacy policy](https://youtube-player-for-twitch.vrnrn.com/privacy/).
