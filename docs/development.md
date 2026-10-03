# Development guide

[← Back to the project](../README.md)

## Load the extension locally

1. Clone or download this repository:

   ```bash
   git clone https://github.com/vrnrn/youtube-player-for-twitch.git
   cd youtube-player-for-twitch
   ```

2. Open `chrome://extensions` in Chrome 102 or newer.
3. Enable **Developer mode**, then click **Load unpacked**.
4. Select the repository root, where `manifest.json` lives.
5. Open or reload a Twitch channel and use **▶ YouTube** in the top navigation.

After changing extension code, reload the extension from `chrome://extensions` and reload Twitch to apply the changes.

## Test and build

Use Node.js 22, matching GitHub Actions. The project uses Node's built-in test runner and has no npm dependencies to install. The build also requires `sh`, `zip` and `unzip`.

```bash
npm test
npm run build
```

The build writes and validates `release.zip` in the repository root. Generated release archives are ignored by Git. It checks that the bundled VAFT adapter matches its pinned, reviewed source. Building does not publish or submit the extension. Store listing artwork and its rendering sources are kept in [`docs/chrome-web-store/`](chrome-web-store/README.md) and excluded from the extension archive.

After reviewing an adapter change, regenerate it offline with:

```bash
node scripts/prepare-vaft.mjs
```

Automated tests cover extension logic and the publishing scripts. They do not establish live Twitch/YouTube behavior or Chrome Web Store acceptance. Use the [theatre-mode verification notes](theatre-mode-qa.md), [floating-chat checklist](floating-chat-qa.md) and [VAFT checklist](vaft-qa.md) for the relevant browser checks.

## Source map

| File | Responsibility |
| :--- | :--- |
| [`manifest.json`](../manifest.json) | Manifest V3 configuration, permissions and content-script order. |
| [`background.js`](../background.js) | YouTube search and metadata requests; optional VAFT script registration. |
| [`twitch-content.js`](../twitch-content.js) | Navigation menu, stream discovery, YouTube iframe, history and sync controls. |
| [`twitch-playback.js`](../twitch-playback.js) | Twitch playback ownership and pause, mute and volume restoration. |
| [`twitch-chat.js`](../twitch-chat.js) | Floating chat, appearance settings and fullscreen coordination. |
| [`twitch-styles.css`](../twitch-styles.css) | Extension menu, player and chat styling. |
| [`vendor/vaft/`](../vendor/vaft/) and [`vaft-main.js`](../vaft-main.js) | Pinned upstream VAFT and its generated integration adapter. |
| [`tests/`](../tests/) and [`scripts/`](../scripts/) | Automated verification, release packaging and store submission. |
| [`site/`](../site/) | Public app information and privacy pages. |

The YouTube iframe keeps playback in YouTube's embedded player. The content scripts manage the surrounding Twitch page, and the service worker handles cross-origin search requests.

## GitHub releases

Pull requests targeting `main` run `npm test` and build `release.zip`. Each successful push to `main`, including a merged pull request, also creates a GitHub Release containing `release.zip` and the matching `manifest.json`.

The released extension version adds the GitHub Actions run number as a fourth component, for example `1.4.0.42`. The fourth component is the build number; the checked-in base version stays unchanged.

See the [build and release workflow](../.github/workflows/chrome-web-store.yml).

## Chrome Web Store submission

Submission is manual. Run **Publish GitHub Release to Chrome Web Store** from the Actions tab on `main`. It selects the highest numbered generated GitHub Release and submits those exact assets. The submission job is restricted to the maintainer account, including reruns.

The publish script checks the currently published and submitted store versions before uploading, so reruns or versions already submitted manually are skipped. A successful workflow means the update was submitted for review; Google controls when it becomes publicly available.

See the [submission workflow](../.github/workflows/publish-chrome-web-store.yml).

### Maintainer setup

Create Chrome Web Store API OAuth credentials for the Google account that owns the listing and authorize the `https://www.googleapis.com/auth/chromewebstore` scope. Add these repository Actions secrets:

- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`

Add the repository Actions variable `CWS_PUBLISHER_ID`. Keep credential values in GitHub's secret fields; never commit them or paste them into chat. Follow Google's [Chrome Web Store API setup guide](https://developer.chrome.com/docs/webstore/using-api) for credentials and the publisher ID.

The OAuth scope grants publisher-level write access, including other items the authorized account can manage. Google OAuth refresh tokens for external apps in Testing expire after seven days when using this scope. For reliable publishing, use a production OAuth configuration and complete any verification Google requires for the sensitive scope; personal-use exceptions may apply. See Google's [refresh-token expiration guidance](https://developers.google.com/identity/protocols/oauth2#expiration) and [sensitive-scope verification guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

Workflow files, run logs and releases are public. GitHub requires repository write access to manually dispatch a workflow; pull request builds never receive publishing credentials. Both workflows use standard GitHub-hosted Ubuntu runners.
