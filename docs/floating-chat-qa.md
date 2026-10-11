# Floating chat implementation and verification

Reference reviewed September 30, 2026:
[store listing](https://chromewebstore.google.com/detail/floating-twitch-chat/fhaenepohcgdhppcnepekkiciccpgphf)
and [source](https://github.com/xD33m/floating_twitch_chat), commit
`af8956a722ef1205c88a002daaf6325386c33a50`. The reference inspired the draggable
fullscreen overlay and appearance controls. YPFT's implementation is original.

## Architecture

- Isolated `twitch-chat.js`, off by default, using the existing Twitch feed.
  No IRC socket, API calls, framework, background-worker messages or permissions.
  Image resources are HTTPS URLs already rendered by Twitch; CDN loads can occur.
- At most 60 message rows. Existing rows are reused; moderation and late message
  content update affected rows. Mutations are batched at most eight times/second.
  Source chat changes are read only; markup, links, handlers and scripts are not copied.
- No chat observer while off, hidden/backgrounded, or outside fullscreen-only mode.
  A ResizeObserver and scroll/resize/fullscreen events keep the overlay aligned.
  SPA/player/feed reacquisition shares the existing content-script lifecycle check.
- Read-only chat with draggable/resizable bounds, keyboard controls, compact mode,
  background color/opacity, text size, click-through and scrolling to latest.
  Appearance and normalized position persist in local extension storage; chat text does not.
- Fullscreen with chat expands the stable YouTube wrapper and keeps the iframe
  mounted. While enabled, its inner fullscreen permission is temporarily removed,
  routing fullscreen through the visible YPFT control. Original iframe permissions
  return when floating chat is disabled. Twitch's own fullscreen remains supported.

## Automated checks

On September 30, 2026, `npm test` passed all 49 tests; `npm run build` validated the archive and `git diff --check` passed. Tests cover:

- Default off, invalid preferences, cross-tab settings, no network client.
- Bounded rendering, inert text, HTTPS images, omitted scripts/unsafe URLs.
- Message/node reuse, moderation changes, partially-rendered ordering, batch limits.
- Fullscreen/background gating, timer/observer cleanup, exact iframe permissions.
- SPA/channel/feed/player replacement and size/keyboard movement persistence.
- Existing YouTube ownership, pause/mute/volume, quality and VAFT regressions.

## Integrated browser verification

Checked in the integrated browser on Valkyrae before the final icon/settings build:

- Enabled floating chat through the actual unpacked extension; fullscreen-only hides it in normal view.
- Live feed rendered 60 bounded rows, native badges and emotes over playing YouTube.
- Fullscreen expanded the YouTube wrapper; keyboard movement/resizing worked and the iframe remained mounted during those controls. Twitch stayed paused/muted under YouTube.
- Restore Twitch removed YouTube and released playback ownership. Native Twitch playback/fullscreen were exercised.
- Native Twitch fullscreen initially put chat behind a player extension. A CSS preview raising only the fullscreen chat root fixed the visible overlay; that fix is now packaged.

The user reported chat working over YouTube. Their button feedback led to consistent SVG icons, centered controls and explicit button sizing in the final build.
The final icon build was reloaded by the user, but a further menu/settings change followed it. Browser controls were unavailable in the current tool session, so the final packaged UI has **not** been visually rechecked.

Remaining live checks: pointer drag/resize (prior attempts were inconclusive), appearance/click-through controls, reload/SPA/two-tab persistence, background/focus behavior, extension-overlay hiding selectors on current Twitch, and a long-running performance check. Synthetic tests cover lifecycle and message batching; these are not a live benchmark.

## Additional settings and player extensions

The YPFT dropdown opens a centered settings window with Playback, Chat and Player extras tabs. Hiding native player extensions is off by default and applies a scoped root attribute/CSS rule, requiring no new permission, observer, reload or network interception. The preference restores at startup, updates across tabs, and does not touch YouTube or floating chat. This hides their overlays/buttons; it does not stop third-party extension code or traffic.

Native Twitch chat must remain available in the page. The separate Extra emotes setting renders public BetterTTV, FrankerFaceZ and
7TV global and channel catalogs in both the native feed and the floating overlay.
Existing provider images are preserved; personal sets are outside this feature.

## Menu spacing follow-up

The user's desktop Chrome screenshot exposed missing inset spacing after the settings container changed, a hidden chat-appearance disclosure being styled visible, and an empty inactive action footer. The follow-up restores shared group padding, compact rows, scoped disclosure/chevron styling and menu-specific hidden and collapsed-disclosure rules. Turning chat off closes its appearance disclosure; the action footer is shown only while YouTube is active. Automated tests cover those state transitions. Final visual inspection is still pending because integrated-browser controls are unavailable in this session; no other browser was used.

## Settings window follow-up — October 11, 2026

Additional controls now live in a lazy native dialog with sidebar tabs. Chat
appearance fields are shown directly when floating chat is enabled. Closing
the dialog removes its controls; saved settings and the selected stream remain.
See [settings-window verification](settings-window-qa.md) for current browser
checks and screenshots. Earlier disclosure screenshots describe the previous UI.

## Resize handle follow-up — October 11, 2026

The lower-right handle now uses three diagonal grip lines instead of the
overlapping stroke/dot icon. Its hover and focus shape follows the panel corner;
the 16px icon stays inset 5px with both the 24px desktop and 44px coarse target.

An isolated local-source preview on Twitch confirmed mouse resizing (+50px width,
+25px height, one preference write in the in-memory adapter), arrow-key resizing,
visible keyboard focus and corner alignment at 1280 × 720 and 940 × 800 with coarse
pointer emulation. Real installed preferences were not changed. Physical touch
gestures remain untested. All eight floating-chat tests and JavaScript syntax
checks pass; the build verifies 16 files in the release and `build/latest`.

[Resize handle confirmation](qa/ypft-resize-handle.png). The temporary preview tab
was closed and the viewport override reset. These checks supersede the earlier
inconclusive mouse resize result above.

## Collapsed chat investigation — October 11, 2026

Reproduced on a temporary live Twitch tab. Twitch behaves differently when the
page starts with native chat collapsed versus collapsing an already initialized
chat:

| Native chat state | Observed rendered messages |
| --- | --- |
| Page reloaded with chat collapsed | The message-container element exists, but stays at zero message lines across subsequent reads. |
| Chat opened for the first time | Messages start arriving; six lines were present seven seconds after opening. |
| That initialized chat collapsed again | Messages continue arriving in the hidden native container; the count later reached 76. |

YPFT's floating chat mirrors the native message container in `layout()` and
`attachFeed()`. It does not have its own chat connection. A mounted but empty
native container therefore gives the overlay nothing to display. Opening native
chat initializes Twitch's feed, after which its DOM mutations can flow into the
overlay. This explains the intermittent dependency without implicating the
resize control or overlay rendering queue.

Follow-up candidate: initialize native chat once when a visible floating overlay
needs it, then restore the user's collapsed state. This needs bounded startup and
restoration handling for disablement, hidden tabs, fullscreen and channel changes;
it should preserve the existing one-feed architecture. The investigation changes
no runtime behavior. The temporary tab's original expanded-chat state was restored
before closing it.

## Collapsed startup fix — October 11, 2026

The overlay now initializes cold native chat once when it becomes visible. A
temporary sidebar mask and fixed native-player width preserve the visible
collapsed layout while Twitch connects. The native sidebar is collapsed again
after a minimum 600ms initialization window when its feed has content, or after
a five-second timeout. A 100ms restoration window lets React finish its commit
before releasing the mask. Explicit native-chat clicks take precedence.

This reuses the native feed and the existing observer. There is no second chat
client, new permission or permanent observer. The one temporary startup/cleanup
timer, sidebar/player references, width override and click listener are released
after restoration. Disablement, backgrounding, fullscreen exit and navigation
cancel initialization and restore the sidebar. Mirrored rows remain capped at
60 and pending nodes at 150.

Verified with current local source in an isolated-world Chrome API adapter on a
temporary live Twitch tab:

- Reloaded with chat collapsed: native messages started at zero. Initialization
  used exactly two native-toggle clicks and restored the collapsed sidebar.
  Player width remained 1040px at 20ms, 200ms and 800ms; the sidebar stayed 0px
  wide throughout. The native feed later held 127 messages and the overlay 60.
- Fullscreen-only mode did not open chat while inactive. Entering actual
  fullscreen initialized the feed and restored collapse; 21 native messages
  appeared in the overlay. Exiting fullscreen hid the overlay and released all
  mirrored rows without another sidebar toggle.
- The original expanded-sidebar preference was restored before closing the
  temporary tab. Installed extension settings were not changed.

[Collapsed sidebar with live overlay](qa/ypft-collapsed-chat.png).

`npm run check` passes syntax, website validation and all 117 tests. Eight new
regressions cover cold startup, warm/expanded/inactive exclusions, delayed React
commits, interrupted/stale callbacks, timeout, user choice, replaced sidebar/feed,
previous sizing overrides and five cancellation cycles with no retained startup
references or active listeners, timers or observers after cleanup.

## Hidden scrollbars — October 11, 2026

The floating overlay unconditionally hides native scrollbars on its root and
descendants using both `scrollbar-width: none` and the WebKit scrollbar selector.
Scrolling remains `auto`; this adds no JavaScript, listeners or memory state.

Live local-source verification used real overflowing chat. Wheel scrolling moved
the message position from 1228px to 628px; Page Up moved it to 556.5px with the
message area focused. Scrollbar width remained `none` and WebKit display `none`
during hover, keyboard focus, compact/click-through mode, 24px text at 160px panel
width, forced colors, coarse-pointer emulation and fullscreen. Fullscreen retained
60 bounded rows. Physical touch gestures were not exercised. The temporary tab
and emulation were cleaned up; installed preferences were unchanged.

[Scrollbar-free fullscreen overlay](qa/ypft-hidden-scrollbar.png).

The final release archive and constant `build/latest` folder are rebuilt from this
source and verified against all 16 shipping files.
