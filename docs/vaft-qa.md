# VAFT integration verification

## Automated coverage

Run `npm test`, `node scripts/prepare-vaft.mjs --check`, and `npm run build`.
Tests execute the packaged adapter in controlled Node VM page/worker fixtures,
not against live Twitch advertisements. They cover:

- Default off; minimum Twitch-only MAIN registration at document_start; persistence
  order; repeated/concurrent toggles; install/update/startup reconciliation; storage
  changes; service worker restart; register/unregister/storage failures and rollback.
- Extension-only, Twitch-top-frame settings messages; invalid senders and values.
- Duplicate VAFT and unrelated Worker wrappers; idempotence; script error states.
- YouTube URL, fetch-input and Worker pass-through; Twitch header/body handling;
  quoted-header-safe Blob payloads; worker bootstrapping, cleanup and token relay.
- Recovery messages during YouTube ownership, manual pause, mute/volume/quality
  preservation, Twitch player replacement, missing containers and SPA navigation.
- Persisted playback restoration across a forced reload; switching YouTube streams.
- Worker playlist errors, missing SERVER-TIME, alternate playlist selection,
  HEVC/HVC1 codec fallback and end-of-interruption reload requests.
- Quality changes written by isolated YPFT remain visible to VAFT's MAIN-world
  localStorage wrapper; unrelated saved quality fields survive enforcement.

## Recorded verification — October 1, 2026

`npm test`: **38 tests passed**. Pinned-source/adapter verification and release
ZIP integrity passed. These fixtures do not establish live interruption efficacy.

The user loaded `build/ypft-vaft-unpacked` and reloaded the extension in the
**Codex integrated browser**, Chromium 154 on macOS, extension version 1.4.0.
Live checks used `https://www.twitch.tv/valkyrae` and Valkyrae's discovered live
YouTube stream, `StKmQjb7DIU`. No concurrent VAFT installation was detected.

| Check | Observed result |
| --- | --- |
| Default off / disable and reload | No MAIN VAFT object or status; native Worker retained. |
| Enable, repeat toggles, preference persistence | Menu toggles reloaded Twitch; enabled preference survived reload and reached `worker-ready`. |
| MAIN / Blob / worker startup | Actual Twitch worker booted; no VAFT CSP, Blob, XHR or evaluation error observed. Worker readiness establishes boot only. |
| YouTube ownership / restore | Twitch stayed paused and muted under YouTube. A manually paused/muted Twitch player retained its state when restored. |
| Toggle while YouTube is active | Selected YouTube stream and saved Twitch playback intent survived both on and off reloads. |
| Recovery / replacement | Calling Twitch recovery while YouTube owned playback kept its iframe. A controlled DOM video replacement stayed paused/muted and retained the same iframe; the original video was restored after the test. |
| SPA navigation | Browse removed the channel overlay; returning to Valkyrae restored its saved YouTube stream. |
| Multiple tabs | Disabling in a second Twitch tab updated the first tab's setting and showed a reload action; reload removed its hooks. |
| Source quality | Isolated quality enforcement was visible through MAIN localStorage and preserved another saved field. Test values/settings were restored. |
| YouTube-only page | No VAFT object, status or menu; native Worker retained. The live YouTube iframe remained interactive. |
| Embedded fullscreen | Enter and exit worked; Twitch stayed paused/muted and YouTube ownership remained. |
| Redesigned menu | Visually checked on live Valkyrae after the user's extension reload, including the final Experimental badge; new switch successfully disabled and reloaded Twitch. |

The final review tab has interruption blocking **off** and the selected YouTube
stream restored. Other already-open Twitch tabs need reload to remove old hooks.
An older automation tab stopped responding after the extension reload; a fresh
tab in the same integrated browser completed the menu and fullscreen checks.

## Required live checks before release

Use the **integrated/in-app browser only**. Load the unpacked reviewed build,
disable the Tampermonkey VAFT userscript (leave other scripts enabled), and reload
Twitch. The automation tool cannot open `chrome://extensions` because its URL policy
allows HTTP(S) pages only; the user can perform the Load unpacked step in the
integrated browser. An isolated UI fixture can verify menu/layout interactions,
but does not substitute for loading the extension.

Record browser version, extension version, settings, channel/codec and visible
results without tokens/cookies. Verify:

1. Fresh install is off with no MAIN Worker/fetch hooks. The menu explains reload.
2. Enable: successful settings write/registration, exactly one page reload,
   checkbox persists; status advances to hooks-ready then worker-ready. Check
   actual console errors for MAIN-world CSP, Blob worker creation, synchronous
   worker XHR and dynamic evaluation. “Worker-ready” confirms boot, not efficacy.
3. Repeated on/off, browser restart, extension update, multiple Twitch tabs:
   preference/registration reconcile; other tabs clearly require reload. After
   turning off and reloading, original Twitch Worker/fetch and ordinary YPFT work.
4. Watch an actual Twitch advertising interruption before/after enabling. Exercise
   preroll, midroll, backup token failure and the end-of-interruption recovery path.
   Record whether it works; do not infer success from a synthetic playlist.
5. Twitch → YouTube → Twitch, including during interruptions: no Twitch audio or
   recovery under YouTube, iframe identity/playback survives player replacement,
   original user pause/mute/volume returns. Enable/disable while YouTube is active:
   selected video and original Twitch playback intent survive reload.
6. SPA channel switch and back; delayed/absent/replaced Twitch player and nav bar;
   focus/background transitions; Twitch pause and mute set by the user; quality
   enforcement on/off; Source/HEVC 2K/4K paths and temporary AVC backup quality.
7. YouTube-only page and embedded YouTube player: no VAFT registration/hooks; normal
   network/player API behavior, sync, fullscreen, theater layout and chat interaction.
8. Existing Tampermonkey VAFT: conflict reported if it loads first; only one hook
   installation. Disable its VAFT entry before efficacy tests, then reload.

Still required before release: actual advertising interruption efficacy and
transition/recovery behavior, real HEVC/HVC1 playback and fallback quality,
focus/background transitions, browser restart and live extension-update
reconciliation, genuine Twitch player/container recreation, and live duplicate
Tampermonkey ordering. Lifecycle and recovery fixtures cover the corresponding
logic but cannot replace these checks. Chrome Web Store acceptance remains
unverified; review dynamic Twitch worker evaluation before publication.
