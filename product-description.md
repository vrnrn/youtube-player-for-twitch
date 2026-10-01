What's New?
- Find streams from the streamer's linked YouTube channel
- Fall back to Twitch channel-name search when no linked stream is live

Does your favorite stream multi-stream to both Twitch and YouTube?
This Chrome extension lets you overlay any YouTube livestream on top of a Twitch channel player, keeping the Twitch chat and interface intact. Perfect for when your favorite streamer switches platforms or when you want the superior YouTube video quality with Twitch's superior chat experience.

The code is open-source: https://github.com/vrnrn/youtube-player-for-twitch

✨ Features

📺 Watch YouTube on Twitch
Replace the Twitch video player with a YouTube livestream
Keeps Twitch chat, badges, and channel points visible and interactive
Autopauses and mutes the underlying Twitch player
Supports 4K/60fps YouTube playback

🔍 Auto-Find Stream
Smart Search: Checks the streamer's linked YouTube channel first, then searches by Twitch channel name
Fuzzy Matching: Intelligent matching works even if channel names differ slightly.
Live Filter: Only suggests actual active livestreams

⚡ Auto-Sync
Jump to Live: One-click button to seek to the absolute live edge
Smart Catch-up: Speeds up playback (2x) briefly to close the latency gap
Auto-Sync: Optional setting to automatically re-sync every 10 minutes

💾 Smart Persistence
Auto-Restore: Remembers your active YouTube stream if you reload the page
Navigation Aware: Handles switching between channels intelligently—keeps the stream when reloading, but resets when you click a different Twitch channel
Per-Channel Memory: Remembers the last YouTube URL you watched for every Twitch channel
Recent History: Keeps track of the last 5 YouTube streams you've watched, allowing for quick access.

📺 Twitch Improvements
Force Highest Quality: Optional setting to automatically enforce "Source" (maximum) quality on the underlying Twitch stream to ensure a crisp viewing experience.

Experimental Twitch Interruption Blocking (VAFT): Off by default and marked Experimental in the menu. Opt in from the YouTube menu to filter Twitch advertising segments using bundled TwitchAdSolutions VAFT and alternate Twitch playback tokens/playlists. Changing the setting reloads Twitch. Disable an existing Tampermonkey VAFT script first. YouTube playback is separate, and Twitch recovery is suspended while YouTube is active. This feature requires Twitch host access and script registration permission, contains no remote updater or telemetry, and may temporarily reduce Twitch quality during interruptions. Availability and effectiveness depend on Twitch; Chrome Web Store acceptance of this new integration has not been verified.
