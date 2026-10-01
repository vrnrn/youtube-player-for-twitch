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

The menu uses a collapsed native disclosure with Playback, Chat and Player extras groups. Hiding native player extensions is off by default and applies a scoped root attribute/CSS rule, requiring no new permission, observer, reload or network interception. The preference restores at startup, updates across tabs, and does not touch YouTube or floating chat. This hides their overlays/buttons; it does not stop third-party extension code or traffic.

Native Twitch chat must remain available in the page. Additional emote providers
are supported only when they already render messages in that native feed.

## Menu spacing follow-up

The user's desktop Chrome screenshot exposed missing inset spacing after the settings container changed, a hidden chat-appearance disclosure being styled visible, and an empty inactive action footer. The follow-up restores shared group padding, compact rows, scoped disclosure/chevron styling and menu-specific hidden and collapsed-disclosure rules. Turning chat off closes its appearance disclosure; the action footer is shown only while YouTube is active. Automated tests cover those state transitions. Final visual inspection is still pending because integrated-browser controls are unavailable in this session; no other browser was used.
