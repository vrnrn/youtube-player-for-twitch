# App logo

The app mark combines an open purple chat bubble with a red play symbol. The background and the space between the shapes are transparent.

- `logo.png`: original 1254 × 1254 master, generated with the built-in imagegen tool.
- `icon16.png`, `icon48.png`, `icon128.png`: app icons referenced by `manifest.json`, resized from the master.
- `promo_440x280.png`: updated promotional graphic, preserving the existing layout and copy.

To recreate the app icon exports on macOS:

```sh
for size in 16 48 128; do
  sips -z "$size" "$size" icons/logo.png --out "icons/icon${size}.png"
done
```

The original artwork remains in the master; export resizing preserves its alpha channel. All icon and promo files are included by the existing release build.

## Logo generation prompt

```text
+Use case: logo-brand.
Asset type: production app icon for the open-source Chrome extension YouTube Player for Twitch, which plays YouTube video beside Twitch chat.
Primary request: Design one original, beautifully simple play-and-chat emblem. A bold purple geometric speech bubble with a short lower-left chat tail embraces a bright red right-pointing play triangle. Use a clean transparent negative-space gap around the triangle so both shapes read clearly. Reimagine the existing concept with precise modern proportions, soft corners, a confident silhouette, and no dark outline. The forms should feel like one unified mark, not two separate branded logos.
Style: flat vector-like graphic, two solid colors only, no fine detail, crisp shapes, balanced negative space, professional app identity. Purple #9146FF and red #FF0033. No white background or square app tile; everything outside the two shapes must be truly transparent.
Composition: one centered mark in a square image, visually filling roughly 80 percent of the canvas, comfortable even margins. It must be legible as a Chrome toolbar icon at 16 pixels as well as at 128 pixels.
Constraints: single logo only; no text, initials, lettering, wordmark, contact sheet, mockup, gradients, lighting, shadows, glossy or 3D effects, texture, decorative flourishes, black strokes, watermark, or official YouTube/Twitch logo recreation. Transparent background.
```

## Promo edit prompt

The existing promotional graphic was the edit target; the new logo was the replacement reference. The edit used the built-in imagegen tool, then was resized to 440 × 280.

```text
+Use case: precise-object-edit. Image 1 is the edit target: the existing 440 by 280 landscape promotional graphic for YouTube Player for Twitch. Image 2 is the replacement logo reference. Replace only the old dark-outlined filled purple chat logo at the left with the exact new logo from Image 2: purple rounded open chat outline, red rounded play triangle, transparent negative space, no black stroke. Preserve the Image 1 pale lavender background, the text content and purple-and-white typography, the three-line layout, spacing, right-hand text position and landscape aspect ratio. Keep the new logo roughly the same visual size and position as the original. No added elements or text. Final graphic is opaque, clean and crisp.
```
