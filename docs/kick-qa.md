# Experimental Kick verification

Verified October 25, 2026. Kick is off by default under **YPFT → Settings → Kick**.

`npm run check` passes all 133 tests, syntax checks and website validation.
`npm run build` validates the 17 runtime/license files in `release.zip` and
`build/latest`. Kick's host access is limited to `https://kick.com/*`; frames
load directly from Kick, without injected Kick content scripts or a chat relay.

Regression coverage includes strict URL parsing, sender and opt-in checks,
live/offline/unavailable metadata, pin persistence and limits, chat switching,
navigation cleanup, delayed restoration, and Twitch audio/playback restoration.
YouTube-only sync controls stay hidden during Kick playback. Directory sorting
does not run on a pseudo-channel route. Existing playback, chat, emote and VAFT
tests still pass.

The initial stream/chat browser checks used the actual local sources and stylesheet in an isolated
world on temporary Twitch tabs, with an in-memory Chrome storage/message
adapter. No installed-extension settings were changed. Status requests in this
preview returned unavailable deliberately; direct requests to Kick's channel
endpoint separately confirmed offline and live responses.

- Enabled Kick and pinned a channel through Settings. The experimental label,
  off-by-default explanation, saved pins and sidebar entry were visible.
- A Kick URL loaded Kick's actual stream embed on a Twitch channel. Its actual
  popout chat loaded messages and emotes. The Twitch/Kick chat switch worked.
  Restore Twitch removed both frames and restored the chat column.
- Selecting a sidebar pin opened `/directory?ypft-kick=channel`. The pseudo
  channel showed the Kick player and chat without a matching Twitch channel.
- An active stream from Kick's homepage played in the pseudo channel: its video
  was unpaused, readyState was 4, video width was 1280, playback time advanced
  from approximately 8 to 38 seconds, and no media error was reported.
- The desktop layout had no horizontal overflow. At a 500 × 800 CSS viewport,
  the settings dialog was 480px wide with horizontal tabs and a stacked pin
  form; the pseudo channel stacked video and chat without horizontal overflow.
- Turning Show Kick chat off removed its iframe. Turning Kick support off
  removed the player, pseudo page and sidebar entries while preserving pins.
- The privacy page includes the new storage and network behavior. Its copy
  fit the existing layout. The design hook's existing site contrast and shadow
  findings were left outside this feature's scope; no suppressions were added.

The design/documentation review was performed inline. The new controls retain
the incumbent dark palette, system typography, purple selection/focus, open
settings rows and native control behavior. DESIGN.md and its sidecar were
preserved; this feature adds no replacement visual system.

Initial stream/chat screenshots (before the live-only sidebar revision): [settings](qa/ypft-kick-settings.jpg),
[narrow settings](qa/ypft-kick-settings-narrow.jpg),
[pseudo channel](qa/ypft-kick-channel.jpg),
[narrow channel](qa/ypft-kick-channel-narrow.jpg), and
[substitution](qa/ypft-kick-substitution.jpg).

## Live pins in Followed Channels

Pinned Kick channels now share Twitch's existing followed-channel list, with a
profile icon, **Kick** label, live indicator and viewer count. There is no separate Kick heading.
Only a confirmed live response produces a sidebar row; offline, pending and
failed checks stay hidden. Saved pins remain available in Settings.

Each pin is checked initially and every 10 minutes while the tab is visible.
Adding a pin checks that new channel without refreshing other pins early.
There are still at most three status requests in flight, using the existing
page refresh loop rather than another polling timer.

Regressions cover live-only filtering, the exact 600,000ms boundary, failed
checks, new pins, hidden tabs, translated followed groups identified by their
native card marker, replacement lists and cleanup without removing Twitch rows.
When Twitch has no followed group, live pins occupy its usual sidebar slot;
the extension merges into the native group if Twitch mounts it later.

The current sources were checked again on a signed-out Twitch tab. Direct Kick
responses confirmed one pinned channel live and another offline; only the live
pin appeared under Followed Channels, above Twitch's native Live Channels.
A temporary native-list fixture verified merging into the same followed list,
removal of the fallback heading, and preservation of the Twitch card. An
in-memory clock check kept the live row at 599,999ms and removed it after an
offline response at 600,000ms. No account follows or installed settings changed.
The temporary tab was closed afterward.

The [initial Followed Channels screenshot](qa/ypft-kick-followed-channels.jpg)
predates the profile-icon and native-formatting refinement below.

## Native channel formatting and profile icons

Kick rows now use the channel's profile image from the existing metadata
response. Only HTTPS images on files.kick.com are accepted. Image requests
omit the referrer; missing or failed images retain the initials fallback.
An icon change refreshes the row at the next normal status check without
adding another metadata request or changing the 10-minute interval.

The expanded row has a channel name, a muted Kick label, and a right-aligned
live dot with a compact viewer count. The link's accessible name and tooltip
retain the full viewer count. Collapsed rows use the same 38px height and
30px circular image as the native Twitch rows measured in the preview.
The row background remains transparent on hover. Keyboard focus retains its
outline without filling the row background.

Browser verification loaded the actual profile photo for the channel shown in
the user's screenshot. The image completed successfully at 30 × 30px.
The initial refinement used a hover background; the user's subsequent reference
corrected that behavior. The hover background rule was removed so the profile
icon and channel tooltip remain without a row highlight.
The collapsed Kick and native Twitch links both measured 42 × 38px with
their icons aligned at the same horizontal position.

Regression tests verify profile URL validation, image-failure fallback,
avatar refresh, compact counts and full accessible labels. Existing live-only
filtering and 10-minute timing regressions still pass.

The [expanded](qa/ypft-kick-channel-hover.jpg) and
[collapsed](qa/ypft-kick-channel-hover-collapsed.jpg) hover captures predate the
removal of the hover background.

The corrected source was verified with the pointer over the Kick link in both
sidebar modes: `:hover` was active and the computed background stayed
`rgba(0, 0, 0, 0)`. The channel profile image still loaded successfully.
[Current hover appearance](qa/ypft-kick-no-hover-background.jpg).

Kick sign-in, sending messages, subscriptions and purchases were not exercised.
Kick may restrict embeds, autoplay or third-party cookies, and its undocumented
website status endpoint can change. Open chat/Open on Kick provide direct
fallback links. The installed extension was not reloaded, and nothing was
published. Temporary browser tabs were closed and the viewport override reset.
