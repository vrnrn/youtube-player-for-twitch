# Global emotes, browse sorting and YPFT navigation

Verified October 11, 2026.

## Automated checks

`npm run check` passes syntax validation, all 106 tests and website checks.
`npm run build` validates all 16 files in `release.zip` and `build/latest` against the source.
`git diff --check` passes.

Regression coverage includes provider formats, global-only FFZ sets, CDN URL
validation, catalog caching across worker restarts, concurrent requests, provider
outages, exact-token rendering, existing images and links, feed replacement,
moderation, enablement, image failure, native/floating chat integration, directory
defaults, explicit sorts, late mounting, stale navigation and the stable YPFT label.

Channel-emote coverage includes BTTV owned/shared sets, assigned FFZ sets,
animated 7TV aliases, public Twitch-ID fallback, per-channel caching and its
ten-channel limit, stale navigation responses, channel/global name collisions,
reuse of the same chat feed, disablement during requests and popout chat.

## Browser and API checks

- Ran the background catalog loader with real HTTP requests and an in-memory
  Chrome storage adapter. It returned 56 BetterTTV, 9 FrankerFaceZ and 45 7TV
  global emotes. Catalog sizes can change upstream.
- Injected the local content sources in an isolated world on Twitch in the
  integrated browser, with a Chrome API adapter and the fetched public catalog.
  A local-only preview row used `monkaS CatBag reckH SourPls`. All four images
  loaded at their actual CDN URLs in native chat and floating chat. Nothing was
  sent as a Twitch message.
- Turning Extra emotes off restored the exact codes in the native row;
  turning it back on rendered all four images again.
- Clicking Browse and Live Channels selected Twitch's native Viewers (High to
  Low) option and produced `sort=VIEWER_COUNT`. Opening Just Chatting applied
  the same default to its channel list. Selecting Recommended For You produced
  `sort=RELEVANCE` and remained selected across subsequent checks.
- The new YPFT button sat in the right navigation column before the account
  controls. Its dropdown opened inward and its additional settings remained
  collapsed initially. The older installed extension also ran in this test tab
  and replaced the menu on navigation; the final header screenshot was captured
  after reinitializing the local menu on the stable directory route.

### Channel-emote follow-up — `om`

The reported `om` was absent from all three global catalogs. It is an animated
alias in Valkyrae's assigned 7TV set. The updated background loader fetched 43
BTTV channel/shared emotes, 44 FFZ channel emotes and 871 7TV channel emotes
through real provider requests. Its normalized `om` URL returned HTTP 200 and
an animated WebP containing eight frames. Counts can change upstream.

In a separate background Twitch tab, the updated local renderer loaded the
real catalogs through an in-memory Chrome API adapter. Existing live channel
emotes rendered, and a local-only `om monkaS CatBag SourPls` preview row loaded
all four CDN images. The `om` image loaded at its animated URL in both normal
and floating chat. The optimized renderer was checked again after the memory
changes: lazy images loaded, disablement restored the exact text and removed
all owned images and floating UI, and reenablement rendered `om` again in both
views with the floating history limited to 60 rows. No Twitch message was sent
and the test tab was closed.

- [Channel emotes and animated `om` preview](qa/ypft-channel-om.jpg)

The setting is now called **Extra emotes** because it includes global and
channel sets. No additional chat connection is opened. Catalog requests can
include the current channel's public login or Twitch ID; the local privacy
page and usage guide reflect that change.

Screenshots:

- [Right-side YPFT navigation](qa/ypft-navigation.jpg)
- [Player, chat and right-side menu context](qa/ypft-header-global-emotes.jpg)
- [Global-emote setting](qa/ypft-chat-settings.jpg)
- [Highest-first categories](qa/ypft-directory-sort.jpg)
- [Highest-first category channel list](qa/ypft-category-channels-sort.jpg)

## Scope of verification

The installed extension was not replaced and nothing was published. Browser
checks used the local sources and a Chrome API adapter; the complete installed
service-worker/content-script bridge and coexistence with installed BTTV, FFZ
and 7TV extensions still need an unpacked-extension check. Existing-renderer
preservation and storage/worker behavior are covered by regression tests. These
checks are not a long-running busy-chat performance benchmark.

See [memory verification](memory-qa.md) for retention bounds and the synthetic
heap comparison, including its limits.
