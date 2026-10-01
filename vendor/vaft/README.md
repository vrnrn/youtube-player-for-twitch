# Bundled VAFT integration

YPFT's optional, experimental **interruption blocking** feature uses TwitchAdSolutions VAFT to
filter Twitch advertising segments and obtain alternate Twitch playback tokens
and playlists. It is off by default. The label does not change what the feature
executes or imply Chrome Web Store approval.

## Provenance and license

- Upstream: https://github.com/pixeltris/TwitchAdSolutions
- File: `vaft/vaft.user.js`, userscript version **37.0.0**.
- Pinned commit: `f8f86706daf90daa534b26bce5b2f01238667d5f`.
- Immutable source: https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/f8f86706daf90daa534b26bce5b2f01238667d5f/vaft/vaft.user.js
- Clean copy: `vendor/vaft/vaft.upstream.user.js` (unchanged, development only).
- SHA-256: `06861594a5e6e984ec3da73a4f25d84bea6a816b97ab7cbf4c80fa205583b3ee`.
- MIT: Copyright (c) 2020-present TwitchAdSolutions Contributors; see `LICENSE` in this directory.

`node scripts/prepare-vaft.mjs` applies a deterministic adapter to the pinned
copy. `--check` verifies the checked-in output; the release build rejects source
or adapter drift. There are no runtime source downloads or userscript updaters.
The generated `vaft.js`, this notice and the upstream license are packaged. The
original userscript metadata (including its update/download URLs) is not packaged.

## Adapter changes

The script runs only in the top frame of `https://www.twitch.tv/*`, registered
persistently in Chrome's MAIN world at `document_start` while enabled. Chrome
102 or newer is required for the registered script's execution-world selection.
The settings service worker reconciles registration on install, update, startup,
storage changes and settings reads. It serializes writes and rolls registration
back if persistence fails. Turning either direction on this tab reloads Twitch;
other already-open Twitch tabs display a reload action because unregistering a
script does not remove its already-installed hooks.

The adapter:

- Skips if any VAFT version or a non-native Worker wrapper is already present.
  It never removes other Worker wrappers or intercepts later Worker assignments.
- Stops Twitch recovery/reload/buffering tasks while YPFT owns playback. YPFT's
  separate isolated controller reacquires replaced Twitch videos and restores
  prior pause, mute and volume. Its YouTube iframe lives in a stable body portal
  so replacing a Twitch player/container does not reparent/reload the iframe.
- Removes visibility spoofing and focus autoplay. Upstream manual-pause checks,
  Source-quality preservation, codec fallback and playlist processing remain.
  Cached localStorage reads consult native storage so quality changes made by
  YPFT's isolated content script are also visible in MAIN world.
- Limits Worker replacement to HTTPS Twitch-origin classic workers. YouTube
  workers and module workers retain their native construction arguments.
- Limits window-fetch rewriting to `https://gql.twitch.tv/gql` and worker media
  handling to HTTPS Twitch/ttvnw.net URLs. Other requests retain original inputs.
  Header values are safely serialized; missing headers and malformed JSON retain
  normal fetch behavior. Caller request options are not mutated.
- Keeps the token relay in the page's own security context, limited to POST at
  the Twitch GQL endpoint with a timeout. There is no privileged extension-fetch
  proxy, arbitrary page-message API, telemetry, or new media host permission.
- Reports hooks-ready, worker-ready, conflict and error through an informational
  DOM attribute. The attribute/ownership signal is page-visible and untrusted;
  neither exposes privileged Chrome APIs. Worker errors stay visible until reload.
- Releases generated Blob URLs and removes terminated workers from its registry.
  Playlist-processing failures reject their promises; missing SERVER-TIME is safe.
- Uses “interruption blocking” for the visible banner, retains internal upstream
  identifiers and attribution, and removes developer-only simulation globals.

## Runtime and publishing limitations

The upstream algorithm still creates a Blob worker, synchronously reads the
original Twitch worker's JavaScript through page-origin XHR, and evaluates that
Twitch worker code inside the new worker after installing the playlist hook.
This is Twitch's player code, not a remote YPFT updater. However, MAIN-world CSP,
Blob-worker restrictions, dynamic evaluation and Chrome Web Store remote-code
policy require actual validation and review. No extension CSP has been weakened.
Do not represent this change as store-approved or as verified on live advertising
based on unit fixtures.

Upstream's alternative tokens can reduce quality during advertising interruptions,
including HEVC/HVC1 fallback to AVC where available. Twitch changes can break this
pinned implementation. When it fails, turn the option off and reload Twitch.

Before enabling, disable **only** the TwitchAdSolutions (vaft) script in your
Tampermonkey dashboard, then reload Twitch. Do not disable Tampermonkey or unrelated
scripts/extensions. Existing scripts that load after YPFT may independently
replace hooks; the integration cannot control their lifecycle. Test with exactly
one VAFT installation enabled.

See `docs/vaft-qa.md` for verification evidence and the remaining live checks.
