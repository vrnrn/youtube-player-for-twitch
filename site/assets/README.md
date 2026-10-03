# Website assets

The product site is static HTML, CSS, and a small progressive demo enhancement. Serve `site/` with `python3 -m http.server 4185 --bind 127.0.0.1 --directory site` from the repository root. No build or installation is required. The illustrated demo has sample chat and does not load YouTube or connect to Twitch.

- `logo.png`: an unmodified copy of the newer transparent `icons/icon128.png` on `main`, introduced in logo update PR #28. Used throughout the website and as its favicon. The icon is exported from the original master in `icons/logo.png`; see `icons/README.md` for provenance.
- `adventure-stream.jpg`: original artwork created with the built-in imagegen tool on October 3, 2026. Optimized to 1400 × 788 JPEG for the website. It illustrates a stream; it is not a screenshot of a real game or a live broadcast.
- `extension-screenshot.png`: the existing, unmodified product screenshot from the [Chrome Web Store listing](https://chromewebstore.google.com/detail/youtube-player-for-twitch/pkhipedofkjfffichjllpmoajlfndpad), downloaded on October 3, 2026. Source: https://lh3.googleusercontent.com/36mOwuDyZrRekxXESa2bTzvT4e-XuAleO-FEnEuKq1dpQcTs3zCxZfbL1y_AHMNlGn9rx_32KcicV6ZrLd8RgkrR3Q=s1280-w1280-h800 . This is the author's published extension screenshot, including third-party platform and broadcast content.
- `manrope-latin.woff2`: the self-hosted Latin subset of Manrope, variable weights 400–800, retrieved from Google Fonts. Licensed under the SIL Open Font License; see `Manrope-OFL.txt`. The website makes no requests to a font service.
- `social-preview-v2.jpg`: 1200 × 630 social-sharing image rendered from `docs/assets/site-social-preview.html` using the original artwork, current repo logo, and self-hosted font. To regenerate, serve the repository root locally, open `/docs/assets/site-social-preview.html`, set a 1200 × 630 viewport, and capture it. This source template is not shipped as part of `site/`.

## Original artwork prompt

Built-in imagegen mode; no reference images or transparent background.

Use case: stylized-concept
Asset type: landscape video artwork inside a product website's illustrated livestream player.
Primary request: create a beautiful cinematic fantasy game environment, an original stylized 3D scene, wide 16:9 composition. A small adventurer in a warm red-orange cape stands with their back to the camera on a mossy stone overlook in the lower center-right, overlooking an immense alpine valley, pine forests, a blue winding river, and soaring distant mountains. A few ancient stone ruins nestled among trees. Rich emerald and teal trees, hazy pale blue mountain silhouettes, golden warm light on the grassy cliff, expansive soft sky. Polished art direction reminiscent of a premium adventure game's environment concept art, fine detailed painterly textures, immersive depth, peaceful exploration atmosphere. Clear readable middle-distance composition and cinematic lighting, no dark murky foreground. This image will fill a video player demonstration on a dark Twitch-inspired product page.
Constraints: no text, no letters, no logos, no interface, no HUD, no video borders, no watermarks. Original environment and character, no identifiable game IP. Landscape 16:9.
