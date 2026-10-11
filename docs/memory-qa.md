# Extension memory verification

Verified October 11, 2026. This covers extension-owned state, queues and DOM.
It does not measure total Twitch/YouTube/browser process memory or promise a
percentage reduction in video decoding, GPU surfaces or browser image caches.

## Changes and bounds

- Native emotes and floating chat each retain at most 150 pending message nodes.
  Removed nodes are skipped; the newest connected messages continue to render.
  Floating chat retains its existing limit of 60 rendered rows, 32 images per
  message and six badges per author.
- Channel aliases take precedence through two catalog maps, without a third
  merged lookup. Disabled emotes and hidden tabs release catalogs and observers.
  Generation checks discard delayed replies; visibility restores from the
  service worker's cache. Failed-image tracking is weak, and images load lazily.
- The service worker reads only the requested channel's catalog. Ten compact
  persistent channel caches are indexed separately; completed requests retain
  no channel catalog in worker globals. Cached reads avoid reserializing the
  catalog. Obsolete cache entries and the earlier all-channel cache are removed.
- Floating chat disablement releases detached controls, rows, host references,
  gesture state, timers, observers, listeners and iframe references.
- Collapsed-chat startup reuses Twitch's native connection. Its single temporary
  state holds the sidebar/player references and at most one startup or cleanup
  timer. Initialization is attempted once per channel while active, capped at
  five seconds with a 100ms restoration window. Five cancellation cycles verify
  release of both references, the temporary listener, sizing overrides and timer.
- Menu history renders on demand and releases its rows when closed. Saved pins
  are preserved. Navigation clears cached menu/player references and cancels
  pending player restoration. Theatre observers disconnect when the navigation UI vanishes
  or the page becomes hidden.
- Optional VAFT workers retain eight recent channel playlist records. Stream
  restarts and eviction remove old URL references. Remembered ad requests are
  capped at 128 URLs and cleared after an interruption; failed and terminated
  workers leave the registry. These changes are generated deterministically from
  the pinned upstream source.
- The native playback controller already uses weak video tracking and releases
  its media listeners, observers, timers, saved playback state and portal on
  restore. Directory sorting already has bounded retries. Their lifecycle tests
  continue to pass. Video pipeline behavior is preserved.

## Reproducible synthetic profile

Run `npm run profile:memory` with Node.js 22 or newer. The profile uses the actual
chat scripts in the DOM fixture, forces GC, queues 10,000 chat messages that are
removed before the batch flush, then renders 200 live messages and disables both
features. Diagnostic access exists only in the VM; production scripts expose no
profiling API.

| Measurement | Before memory changes | After |
| --- | ---: | ---: |
| Pending native message nodes after burst | 10,000 | 150 |
| Catalog lookup entries for 1,200 emotes | 2,400 | 1,200 |
| Retained heap above the initial fixture after burst/GC | 33,419,176 bytes | 576,472 bytes |
| Active floating rows after 200 live messages | 60 | 60 |
| Retained floating UI references after disablement | 6 | 0 |
| Catalog lookup entries after disablement | 2,400 | 0 |
| Active chat observers/timers after disablement | 0 / 0 | 0 / 0 |

This run reduced retained heap by about 98% in the removed-message scenario.
Exact heap numbers vary by runtime and GC. The fixture excludes real Twitch
React state, browser DOM allocation, image decoding and video-player memory.

A real provider response for Valkyrae contained 958 channel emotes. The packed
cache serialized to 71,981 bytes, compared with 101,375 bytes for the same data
with repeated object keys and provider names (about 29% smaller). A second
request used the fresh cache with no provider HTTP calls. Counts can change.

## Validation and remaining limits

`npm run check` passes 117 tests, syntax and website checks. Regression coverage
includes removed-message bursts, five enable/disable cycles, hidden tabs and
late replies, menu closure, navigation cleanup, compact cache reads, 30 VAFT
channel visits and restarted streams. Existing playback, moderation and sorting
tests pass. `npm run build` verifies the latest unpacked build against source.

The optimized emote scripts rendered the animated `om` and other provider
images in native/floating chat in a temporary live Twitch tab. Disablement and
reenablement worked; the tab was closed. See [the preview](qa/ypft-channel-om.jpg).
This used an isolated-world Chrome API adapter. The installed extension was not
reloaded. Full extension loading and long-duration browser heap/process profiling
remain outside this verification; live advertising behavior is not established
by the VAFT fixtures.
