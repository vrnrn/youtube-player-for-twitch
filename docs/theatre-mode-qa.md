# Theatre mode verification

Addresses [issue #25](https://github.com/vrnrn/youtube-player-for-twitch/issues/25).

## Behavior

- The extension menu exposes Twitch's native theatre toggle independently of YouTube's embed UI.
- Current Twitch labels the native control with `(alt+t)` and does not give it a `data-a-target`; the lookup supports both that control and targeted variants.
- Twitch's theatre player uses a higher stacking layer than its normal player. YouTube and floating chat rise above that layer, while the existing menu moves to the top-left of the player so its exit control remains reachable.
- The YouTube iframe stays in its body portal. Resize observation follows native layout changes and player replacement; release disconnects it and restores Twitch playback intent.
- Native theatre classes and button attributes are observed to update the menu for external changes, including Alt+T. The existing lifecycle poll reacquires replaced controls.

## Automated checks

On October 3, 2026, all 56 tests passed. Theatre checks cover toggling without replacing the iframe or changing ownership/storage, external state changes, unavailable controls, moving the same menu back to its navigation parent, replaced navigation parents, resize batching, player replacement, fullscreen transitions and observer cleanup. The release build and `git diff --check` also passed.

## Live source preview

Checked on Ziggy in the integrated browser on October 3, 2026. The installed extension still contained the previous source, so the edited theatre functions, playback owner and CSS were temporarily loaded into that tab's extension content-script context through the developer protocol.

- Found the live native control using its aria-label and reproduced Twitch's theatre player covering YouTube at its original stacking level.
- With the fix, YouTube remained visible above Twitch and matched its normal and theatre player bounds. The test used an existing Valkyrae YouTube video for layout verification, not a matching Ziggy simulcast.
- The same iframe remained mounted on menu-driven entry/exit and on Alt+T. Twitch stayed paused and muted, and the saved playback intent remained unchanged.
- The menu was visibly reachable at the top-left of the theatre player; its exit control returned the menu to Twitch's top navigation.

These are live source-preview checks, not a reload/install test of the rebuilt archive. A fresh unpacked-extension reload, other Twitch layouts/locales, and interaction with floating chat in theatre/fullscreen remain manual follow-up checks. Nothing was published or submitted to the Chrome Web Store.
