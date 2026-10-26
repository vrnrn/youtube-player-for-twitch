# Usage guide

[← Back to the project](../README.md)

## Find and play a stream

Open a Twitch channel and click **YPFT** on the right of the top navigation.

- **Automatic:** Choose **Find YouTube Stream**. The extension checks the streamer's linked YouTube channel first. If it finds no live stream there, it searches YouTube by Twitch channel name and uses fuzzy matching to suggest a live result. Check the title and channel, then click **Use This Stream**. An approximate match can belong to a different channel.
- **Manual:** Paste a YouTube watch, youtu.be, Shorts, live, or embed URL, then click **Go**. Ordinary videos work too; the live-sync controls are intended for livestreams.

The YouTube player overlays the Twitch player. Twitch chat, badges, channel points and the surrounding interface remain available. YouTube controls playback and the quality options available for the selected stream; 4K/60fps is possible when supported by the source and embedded player.

## Settings window

Choose **Settings** at the bottom of the YPFT dropdown. The centered window groups existing controls under **Playback**, **Chat** and **Player extras**. Changes save automatically; changing interruption blocking also reloads Twitch. Floating-chat appearance controls appear when floating chat is enabled.

Use the sidebar to switch sections. Close with the × button, **Escape**, or a click outside the window. Your stream and URL selection stay in place. The window is removed from memory when closed.

The window uses Twitch's familiar dark colors and purple selection states. On
narrow windows, the section tabs move above the settings.

## Theatre mode

Open **YPFT → Settings → Playback** and click **Theatre Mode** to expand Twitch's layout. The YPFT button moves to the top-left of the player in theatre mode; reopen **Settings → Playback** and use **Exit Theatre Mode** to return. The control is available whenever Twitch provides its native theatre button.

YouTube stays mounted and follows the Twitch player size when you change the layout, including through Twitch's **Alt+T** shortcut when the Twitch page has keyboard focus. You do not need to restore Twitch or reopen the YouTube stream. The button is disabled on pages without a native theatre control and while in fullscreen.

## Sync and quality

Click **Sync Now** to seek toward the live edge. The extension briefly requests 2× playback, then returns to normal speed. This helps catch up but cannot guarantee exact alignment with Twitch chat.

Under **Settings → Playback**:

- **Auto-sync** repeats the catch-up action every 10 minutes while YouTube is active.
- **Highest Twitch quality** keeps the underlying Twitch player set to Source, when available. This controls Twitch quality, not YouTube quality.

## History and restoring Twitch

The extension remembers the last YouTube URL used for each Twitch channel and restores an active stream after a page reload. Switching to a different Twitch channel clears the current overlay. Recent history keeps the last five unpinned streams; pin favorites to keep them available.

Click **Restore Twitch** to remove the YouTube player and restore the original Twitch pause, mute and volume settings. Playback state also survives a reload caused by toggling interruption blocking.

## Experimental Kick support

Open **YPFT → Settings → Kick** and enable **Enable Kick support**. It is marked **Experimental** and is **off by default**.

- To substitute a stream on a Twitch channel, paste `https://kick.com/channel` into the YPFT menu and click **Go**. **Restore Twitch** restores the original player and audio state. Active Kick substitutions return after a reload.
- In **Settings → Kick**, enter a Kick channel name or URL and choose **Pin channel**. Up to 30 pins are saved. Only pins confirmed live on Kick appear alongside Twitch's **Followed Channels**, with their profile icon, a **Kick** label, live indicator and viewer count. Hover keeps the row background unchanged and shows the channel tooltip; keyboard focus retains a visible outline. Offline channels and failed status checks stay hidden in the sidebar. All saved pins remain accessible in Settings; **Unpin** removes one.
- Selecting a pin opens a local pseudo channel at `/directory?ypft-kick=channel`, with Kick playback and chat. This does not create a Twitch account, follow a Twitch channel, or require a matching Twitch username.
- **Show Kick chat** displays Kick's popout chat next to the stream. On an existing Twitch channel, the chat header switches between Kick and Twitch chat. **Open chat** opens Kick chat separately if embedding or sign-in is unavailable. Turning this preference off removes the Kick chat iframe.

The feature uses [Kick's stream embed](https://help.kick.com/en/articles/8010826-how-to-embed-your-kick-livestream) and [popout chat](https://help.kick.com/en/articles/7978574-how-to-create-a-kick-chat-dock-in-obs). Kick may block an embed, require interaction before autoplay, or restrict sign-in through browser cookie rules. Public channel status uses Kick's website endpoint, which is undocumented and may change or reject requests. New pins get an initial check, then each pin is rechecked every **10 minutes** while the Twitch tab is visible, with at most three requests in flight. Failed checks hide the channel until a later check confirms it is live. When Twitch has no followed-channel section, live pins occupy that section's usual sidebar slot. Pins remain saved when support is turned off. No Kick requests or frames start while support is disabled.

Settings, pins and active substitutions are stored locally. Metadata requests to `kick.com` omit cookies and credentials; profile icons load from `files.kick.com` without a referrer and fall back to channel initials if unavailable. Player and chat frames use Kick's normal browser session and load directly from Kick. The extension does not capture or store Kick chat messages. YouTube's **Sync Now / Auto-sync** and the Twitch-only floating chat overlay do not control or mirror Kick chat. Turning support off removes Kick playback, chat and sidebar entries immediately.

## Browse sorting

Twitch's categories, live channels and category channel listings default to **Viewers (High to Low)**. Twitch's native control applies the sort, including when you navigate without reloading. Filters remain available. An explicit sort in the URL, including one selected from Twitch's dropdown, is respected.

## Extra emotes

**Settings → Chat → Extra emotes** is on by default. It renders exact, case-sensitive emote codes from BetterTTV, FrankerFaceZ and 7TV in normal Twitch chat and floating chat, including animated images. It loads both the providers' global catalogs and the current channel's assigned and shared sets, preserving channel aliases such as Valkyrae's animated `om`. Channel codes take precedence over matching global codes. Existing Twitch or third-party rendered emotes, links, usernames and badges stay intact.

The extension fetches public catalogs directly from the providers. Global catalogs refresh after six hours; channel catalogs refresh after thirty minutes, with at most ten recent channels cached locally. Channel requests use the channel's public login or Twitch ID. When FrankerFaceZ has no room record, a public Twitch lookup resolves the channel ID. Requests omit credentials, chat messages and viewer usernames. Channel sets are replaced when you navigate to another channel; personal sets are outside this feature. Provider failures keep the last available catalog and retry after five minutes; unavailable images fall back to their text codes. Turn the setting off to restore text immediately.

## Floating chat

Open **Settings → Chat** and enable **Floating chat**. It is off by default; when enabled, its initial mode is **Fullscreen only**.

Use **Fullscreen with chat** on the YouTube player to expand the video with Twitch chat, or Twitch's own fullscreen control when watching Twitch. Twitch chat can start collapsed: when the overlay needs messages, the extension initializes the native feed and restores the collapsed sidebar.

- Drag the chat header to move it and the bottom-right handle to resize it. Both controls also support arrow keys.
- Scrollbars are always hidden. Scroll with your mouse, touch or the keyboard, and use **Latest** to return to new messages.
- Under **Chat appearance**, adjust **Always on player** mode, background color, opacity, text size, compact spacing, click-through and **Reset position & size**.
- The labeled sample-message preview shows appearance changes as you adjust
  background, opacity and text size. The controls also display their values.
- The overlay is read-only. Send messages and use moderation controls in the normal Twitch chat.

Floating chat reuses Twitch's rendered messages, badges and emotes, and uses the extra emote catalogs when that separate setting is enabled. It does not open another chat connection. Up to 60 mirrored messages stay in memory only; updates are batched and observation stops while the overlay is hidden. Preferences and position are stored locally. Catalog requests use host access limited to the three provider APIs and Twitch's public channel lookup; no framework dependencies are needed.

Inspired by [Floating Twitch Chat](https://github.com/xD33m/floating_twitch_chat), with an original implementation built for this extension. See the [floating-chat verification notes](floating-chat-qa.md).

## Player extras

Open **Settings → Player extras** for these controls.

**Hide Twitch extensions** hides native Twitch player-extension overlays and buttons immediately. The preference is stored locally and follows Twitch player replacement and navigation. It does not uninstall extensions or stop their code or network requests. YouTube and floating chat remain available.

## Experimental interruption blocking

Under **Settings → Player extras**, **Interruption blocking** is marked **Experimental** and is **off by default**. Changing it saves the preference and reloads Twitch so the player hooks start early or are fully removed. Already-open Twitch tabs show a reload action when their hooks differ from the saved setting.

The extension bundles the pinned TwitchAdSolutions VAFT v37.0.0 algorithm. It filters Twitch advertising segments and requests alternate Twitch playback tokens and playlists. It runs only on Twitch; YouTube requests and the embedded player retain their own behavior. Twitch recovery is suspended while YouTube owns playback.

If you use another VAFT installation, disable that individual script before enabling this option, then reload Twitch. Leave unrelated scripts and extensions enabled. The integrated version skips an already-detected VAFT or Worker wrapper.

The feature uses `scripting` permission and `https://www.twitch.tv/*` host access for persistent MAIN-world registration at `document_start`. It adds no all-sites access, media-host privileges, telemetry or remote updater. Chrome 102 or newer is required.

Worker startup and YouTube coordination were checked in the integrated browser. Actual interruption efficacy, real HEVC fallback and Chrome Web Store acceptance remain unverified. VAFT dynamically evaluates Twitch's player-worker source in a Blob worker; alternate playlists can temporarily reduce quality. See the [source and adapter notes](../vendor/vaft/README.md) and [verification checklist](vaft-qa.md).

## Storage and privacy

Settings, recent history, pinned streams and per-channel playback state are stored on your device in Chrome's extension-local storage. You can clear recent history from the menu; removing the extension clears its local storage.

Search and playback requests go from your browser to YouTube and Twitch. When extra emotes are enabled, public catalogs and images load directly from BetterTTV, FrankerFaceZ and 7TV, and Twitch can resolve a public channel ID when needed. The extension has no developer analytics, telemetry service or developer-operated request proxy. Those platforms process their own requests under their own policies. See the full [privacy policy](https://youtube-player-for-twitch.vrnrn.com/privacy/).
