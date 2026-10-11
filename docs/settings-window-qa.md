# Settings window verification

Verified October 11, 2026.

The YPFT dropdown now contains YouTube search, recent/pinned streams, URL input,
Sync Now and Restore Twitch. Its Settings button opens a centered native dialog.
Existing additional controls live under Playback, Chat and Player extras;
Theatre Mode is under Playback. The reference image supplied the window/sidebar
layout, not settings content.

The modal has a dimmed backdrop, selected sidebar tabs, a fixed header and a
scrollable content pane. On narrow windows the sidebar becomes a tab row.
Appearance controls appear directly when floating chat is enabled. Settings
retain their existing persistence and reload behavior.

## Automated checks

`npm run check` passes syntax, all 109 tests and website validation.
`npm run build` verifies all 16 files in the release and `build/latest`.
`git diff --check` passes.

New regressions cover lazy mounting, tab selection and keyboard movement,
Tab/Shift+Tab wrapping, Escape dismissal, focus restoration, removal on close,
reopening with saved values, navigation cleanup and initialization without
settings controls in the DOM. Existing chat, playback, quality, emote and VAFT
tests continue to pass. Closing an older dialog cannot close a newly opened one
when its native close event arrives later.

## Browser checks

Loaded local sources in an isolated world on a temporary Twitch tab, with an
in-memory Chrome API adapter. The installed extension was left in place; it
finished initialization before the local preview was mounted. Native dialog,
CSS, event handlers, keyboard handling and floating chat used the actual local
sources. Chrome setting writes stayed in the adapter and no chat message was
sent.

- At 1280 × 720 the centered window measured 1040 × 656, with the dropdown hidden
  and input outside the dialog blocked by native modality.
- The sidebar switched to Chat with arrow keys. Floating chat enablement,
  Always on player mode and opacity changes worked. Mode and opacity survived
  closing/reopening; the existing URL input was preserved.
- Shift+Tab from the first tab wrapped to the last visible control. Escape
  removed the dialog and returned focus to the YPFT navigation button. The close
  button and backdrop also dismissed the window.
- Chat appearance scrolled inside the content pane without moving the header
  or sidebar. Player extras retained the existing experimental label and reload
  explanation.
- At 500 × 720, the dialog fit within 480 × 688 with no horizontal overflow and
  a compact row of section tabs. The temporary viewport override was reset.

Screenshots:

- [Compact dropdown](qa/ypft-compact-dropdown.jpg)
- [Playback settings](qa/ypft-settings-playback.jpg)
- [Chat settings](qa/ypft-settings-chat.jpg)
- [Narrow window](qa/ypft-settings-narrow.jpg)

The preview tab was closed. The unpacked build was rebuilt, but the installed
extension was not reloaded by this check. Existing store artwork was not
regenerated or published; its capture source now opens the settings dialog.

## Twitch familiar redesign

The user selected Twitch familiar in the Impeccable direction round and included
floating chat in the scope. The dropdown, settings and chat now share dark
neutral tokens, purple active states and an SVG icon vocabulary. Settings use
open rows, aligned controls and larger section headings. The window retains its
native dialog behavior and sidebar layout. Floating chat retains its memory
bounds, drag/resize controls, click-through and fullscreen behavior.

Chat appearance includes a labeled sample-message preview and numeric opacity
and text-size values. Input updates only the preview; existing change handlers
commit preferences. A regression test confirms input does not write preferences
before a change is committed. Preview DOM is part of the lazy dialog and is
removed on close. The redesign adds no framework, remote font or visual filter.

Browser checks use actual local sources and an in-memory Chrome adapter in a
temporary Twitch tab. Native focus after Escape was checked with CDP and returns
to `ytot-toggle`; the read-only Playwright DOM scope does not reliably report
native focus. Review evidence covers 1440px, the actual 1280px viewport and a
390px narrow viewport. Captures and the finish verdict are recorded under
`.impeccable/review/`; the direction contract is under `.impeccable/surfaces/`.

The fresh finish reviewer returned **ship** after reviewing valid full-viewport
captures and the local sources against the user's selected direction. No
material fixes were requested. The skill's custom role was unavailable, so a
fresh agent loaded its shipped review instructions. A standalone catalog quality
card and raw seed output were unavailable; the review used the recorded chosen
canonCard, seed record, fixed code sketch, Twitch and the supplied BTTV reference.

Redesign captures:

- [Settings and appearance preview](qa/ypft-redesign-settings.png)
- [Narrow appearance controls](qa/ypft-redesign-narrow.png)
- [Stream dropdown](qa/ypft-redesign-dropdown.png)
- [Floating chat](qa/ypft-redesign-floating-chat.png)

The finish documenter recorded the implemented system in [DESIGN.md](../DESIGN.md)
and [.impeccable/design.json](../.impeccable/design.json). The frontmatter and
sidecar parse successfully; shared colors, component references, selected
direction and responsive breakpoints match the source. Runtime files still
match the verified unpacked build at `build/latest`.

## Subsequent audit and polish

The scoped [interface audit](ui-audit.md) resolved six findings: narrow dropdown
clipping, URL validation recovery, interrupted chat gestures, coarse-pointer
target sizing, missing token/type records and switch motion under reduced-motion
preferences. Three new regressions raised the suite to 109 tests. Final captures
confirm desktop, intermediate and narrow layouts; physical touch gestures remain
untested because synthesized touch is unavailable in the in-app browser.

## Final polish and merge preparation — October 11, 2026

The compact-spacing tool now has the same accessible name as its settings row
and a state-specific tooltip explaining the next click. Missing-feed copy says
that Twitch chat is pending, matching automatic collapsed-chat initialization.
The Twitch familiar typography, spacing, color roles and existing controls remain.

A current-source preview checked all three surfaces at 1280 × 720, settings at
940 × 800 and 390 × 844, and the selector at 320 × 700. Long sample search results
fit the narrow selector. Search success, empty and error responses stayed distinct;
an invalid URL focused its linked error and recovered on editing. Selecting a
sample result mounted the YouTube wrapper and recorded playback ownership;
Restore Twitch removed it and released ownership. Compact mode updated its
pressed state and action tooltip, with 60 mirrored rows and no overlay scrollbar.
Escape removed settings and returned focus to YPFT. The Chrome/search adapter was
in memory; installed preferences stayed unchanged. The temporary tab and viewport
override were cleaned up.

The fresh finish review returned **ship**, with no material fixes in the scoped
interface. The custom role was unavailable, so a fresh agent followed the shipped
fallback reviewer instructions. The original raw direction roll and standalone
catalog quality card remain unavailable; the incumbent documented direction,
fixed sketch, sources and valid captures supplied the visual authority.

The finish documenter confirmed the shared tokens and named layout rules and
updated only the compact tool's example markup. The preserved sidecar's standalone
chat example still contains an older `scrollbar-width: thin` declaration; the
shipping stylesheet unconditionally hides overlay scrollbars. No design tokens
or unrelated examples were changed in this pass.

`npm run check` passes all **117 tests**, syntax and website validation.
`npm run build` validates the **16** shipping files against the ZIP and constant
`build/latest`; generated outputs remain untracked. The workflow YAML parses.
PR and main builds remain automatic; GitHub release creation now requires an
explicit manual dispatch on main with `create_release` enabled. Chrome Web Store
submission remains a separate manual operation.

[Polished floating chat](qa/ypft-polish-overlay.png). The complete six-capture set
is local review evidence in `.impeccable/review/polish/`.
