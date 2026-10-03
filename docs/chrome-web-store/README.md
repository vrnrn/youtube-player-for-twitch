# Chrome Web Store assets

A matching set for the product page, prepared October 3, 2026. All author credits use **vrnrn**.

Upload the files in `upload/` to the corresponding slots. The ZIP contains the same eight PNGs plus this guide. `preview.jpg` is an overview for review, not a store upload.

| Slot                | File                                  | Dimensions |
| ------------------- | ------------------------------------- | ---------- |
| Existing store icon | `store-icon-128.png`                  | 128 × 128  |
| Screenshot 1        | `01-watch-together-1280x800.png`      | 1280 × 800 |
| Screenshot 2        | `02-find-your-stream-1280x800.png`    | 1280 × 800 |
| Screenshot 3        | `03-floating-chat-1280x800.png`       | 1280 × 800 |
| Screenshot 4        | `04-recent-streams-1280x800.png`      | 1280 × 800 |
| Screenshot 5        | `05-customize-your-view-1280x800.png` | 1280 × 800 |
| Small promo tile    | `promo-small-440x280.png`             | 440 × 280  |
| Marquee promo tile  | `promo-marquee-1400x560.png`          | 1400 × 560 |

The store icon is an unmodified copy of the newer transparent `icons/icon128.png` on `main`, introduced in commit `8ccc26f` (logo update PR #28). No new icon was designed. `source/branding/icon128.png` pins that asset so an older local branch cannot silently reintroduce the previous logo. The export retains the icon's original alpha channel. The screenshots and promo tiles are opaque, 24-bit RGB PNGs with square outer corners and no transparent padding.

These sizes and the five-screenshot limit follow the [Chrome Web Store graphic asset requirements](https://developer.chrome.com/docs/webstore/cws-dashboard-listing). The layouts also follow the store's [image guidance](https://developer.chrome.com/docs/webstore/best-listing): consistent branding, concise text, and clear feature demonstrations.

## What the screenshots show

The menus, search result, recent history, preferences, and floating chat are rendered from this repo's v1.4.0 JavaScript and `twitch-styles.css`. The surrounding channel shell, stream, and chat messages are controlled illustrative content. These are composed feature images, not captures of a live Twitch broadcast. Each screenshot labels the sample content. Settings are shown in a cropped view of the real panel.

`source/server.mjs` serves the original extension code with a capture-only adaptation: it exposes initialization helpers and substitutes a local sample-player document for YouTube's remote iframe. A local Chrome API fixture supplies sample search results and history. The production extension source and icon files are unchanged by this work. No accounts, live chats, private browser state, or third-party broadcasts were used.

The landscape is the original artwork already used on the product page; see `site/assets/README.md` for provenance and the original imagegen prompt. The font is the same self-hosted Manrope used on the page, under the SIL Open Font License. Promo play/chat symbols are simple HTML/SVG illustrations.

## Edit and render again

From the repository root, run:

```sh
node docs/chrome-web-store/source/server.mjs
```

Open `http://127.0.0.1:4187/vrnrn?asset=watch` and use `asset=find`, `floating`, `history`, or `settings` for the other screenshots. Capture at 1280 × 800 with device scale factor 1 after `body[data-ready="true"]` is present and images load. `asset=small` uses 440 × 280; `asset=marquee` uses 1400 × 560. Capture lossless PNGs and keep the existing icon.

Edit layout and copy in `source/studio.css` and `source/studio.js`. The studio is an asset-authoring tool, not part of the public website or extension package.

After rendering, run `python3 docs/chrome-web-store/source/verify-and-package.py` from the repository root with Pillow installed to validate the files, rebuild the preview, and create the ZIP. `manifest.json` records the exported dimensions and hashes. Generated previews and ZIPs are ignored by Git; the eight upload PNGs, manifest, and rendering sources are tracked.
