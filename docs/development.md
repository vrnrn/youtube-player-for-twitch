# Development guide

[← Back to the project](../README.md)

## Load the extension locally

1. Clone or download this repository:

   ```bash
   git clone https://github.com/vrnrn/youtube-player-for-twitch.git
   cd youtube-player-for-twitch
   ```

2. Run `npm run build` to create the unpacked extension.
3. Open `chrome://extensions` in Chrome 102 or newer.
4. Enable **Developer mode**, then click **Load unpacked**.
5. Select `build/latest` inside the repository.
6. Open or reload a Twitch channel and use **YPFT** in the top navigation.

The local dev build always stays at `build/latest`. After changing extension code, run `npm run build` again, reload the extension from `chrome://extensions`, and reload Twitch to apply the changes. If you already loaded this folder, keep that installation and use **Reload**. If you used an older build folder, load `build/latest` once to switch to the fixed location.

## Test and build

Use Node.js 22, matching GitHub Actions. The project uses Node's built-in test runner and has no npm dependencies to install. The build also requires `sh`, `zip` and `unzip`.

```bash
npm run check
npm run build
npm run profile:memory
```

The build replaces and validates `release.zip` in the repository root, then clears `build/` and creates the unpacked dev build at `build/latest`. Only the latest build is kept; no versioned folders or old packages are retained. Both outputs contain only runtime code, manifest icons, and license notices, and every file is checked against the source. Reserve `build/` for generated output and make code changes in the repository source. Generated build outputs are ignored by Git. The build also checks that the bundled VAFT adapter matches its pinned, reviewed source. Building does not publish or submit the extension. Store listing artwork and its rendering sources are kept in [`docs/chrome-web-store/`](chrome-web-store/README.md) and excluded from the extension archive.

After reviewing an adapter change, regenerate it offline with:

```bash
node scripts/prepare-vaft.mjs
```

Automated tests cover extension logic and build tooling. They do not establish live Twitch/YouTube behavior or Chrome Web Store acceptance. Use the [theatre-mode verification notes](theatre-mode-qa.md), [floating-chat checklist](floating-chat-qa.md) and [VAFT checklist](vaft-qa.md) for the relevant browser checks.

See the [global-emote, sorting and navigation verification notes](global-emotes-and-sorting-qa.md) for the current feature checks and installation limits.

The [memory verification notes](memory-qa.md) describe retention limits and the
synthetic heap profile. This profile measures extension code in a DOM fixture;
it does not measure Twitch or YouTube video memory.

See the [settings-window verification notes](settings-window-qa.md) for modal
layout, keyboard behavior and lifecycle checks.

## Preview the website

```bash
python3 -m http.server 4185 --bind 127.0.0.1 --directory site
```

Open `http://127.0.0.1:4185/`. Check the homepage, demo controls, privacy page, and mobile layout. After changing CSS or JavaScript, run `npm run version:site` to refresh the asset fingerprints in all pages. `npm run check:site` catches stale fingerprints, missing assets, and broken local links.

## Source map

| File | Responsibility |
| :--- | :--- |
| [`manifest.json`](../manifest.json) | Manifest V3 configuration, permissions and content-script order. |
| [`background.js`](../background.js) | YouTube search, cached public global/channel emote catalogs and optional VAFT script registration. |
| [`twitch-content.js`](../twitch-content.js) | Navigation menu, stream discovery, YouTube iframe, history and sync controls. |
| [`twitch-playback.js`](../twitch-playback.js) | Twitch playback ownership and pause, mute and volume restoration. |
| [`twitch-directory.js`](../twitch-directory.js) | Default viewer-count sorting for channels and categories. |
| [`twitch-emotes.js`](../twitch-emotes.js) | Global and channel third-party emotes in native and floating chat. |
| [`twitch-chat.js`](../twitch-chat.js) | Floating chat, appearance settings and fullscreen coordination. |
| [`twitch-styles.css`](../twitch-styles.css) | Extension menu, player and chat styling. |
| [`vendor/vaft/`](../vendor/vaft/) and [`vaft-main.js`](../vaft-main.js) | Pinned upstream VAFT and its generated integration adapter. |
| [`tests/`](../tests/) and [`scripts/`](../scripts/) | Automated verification and release packaging. |
| [`site/`](../site/) | Public app information and privacy pages. |

The YouTube iframe keeps playback in YouTube's embedded player. The content scripts manage the surrounding Twitch page, and the service worker handles cross-origin search requests.

## GitHub releases

Pull requests targeting `main` run `npm run check` (syntax, regression tests, website) and build `release.zip`. Successful pushes to `main`, including merged pull requests, also save `release.zip` and the matching `manifest.json` as the one-day `chrome-extension-build` Actions artifact. Merging does not create a GitHub release or submit to the store.

To create a GitHub release later, run **Build Chrome Extension** manually from the Actions tab on `main` and explicitly enable **Create a GitHub release from this main build**. The option defaults to off. The workflow rebuilds and verifies that main commit before creating the release.

The released extension version adds the GitHub Actions run number as a fourth component, for example `1.4.0.42`. The fourth component is the build number; the checked-in base version stays unchanged.

See the [build and release workflow](../.github/workflows/chrome-web-store.yml). Its existing file path preserves the Actions run counter used for extension versions; it contains no store submission job.

## Chrome Web Store submission

Upload the chosen `release.zip` and submit it for review directly in the Chrome Web Store Developer Dashboard. Store listing artwork is available in [`docs/chrome-web-store/`](chrome-web-store/README.md). The repository does not connect to or submit updates through the store API.
