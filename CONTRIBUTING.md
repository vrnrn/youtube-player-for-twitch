# Contributing

Use Node.js 22 or newer. There are no npm dependencies to install.

```sh
npm run check
npm run build
```

For local installation, browser checks, and publishing instructions, see the [development guide](docs/development.md).

Keep changes focused. Include reproduction steps for a fix and a screenshot for visible UI changes. Add regression coverage when changing playback, storage, or asynchronous behavior. Check the website at desktop and mobile widths when editing it.

Edit the VAFT adapter in `scripts/prepare-vaft.mjs`, then regenerate it; do not hand-edit the generated bundle or the pinned upstream source. Keep its license notices intact.

Bug reports should include the Chrome and extension versions, steps to reproduce, expected and actual behavior, and relevant optional settings. Omit cookies, tokens, and private chat content from logs.
