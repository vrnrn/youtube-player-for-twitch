import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    let body, type;
    if (url.pathname === "/capture-content.js") {
      // Capture-only adaptation: keep the real interface and event handlers,
      // replace remote playback with original local sample artwork.
      body = (await readFile(path.join(root, "twitch-content.js"), "utf8"))
        .replace(
          "iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`;",
          'iframe.src = "/docs/chrome-web-store/source/sample-player.html";',
        )
        .replace(
          /\}\)\(\);\s*$/,
          "window.assetUI = { init, injectYouTube, handleAutoFind, renderHistory, renderChatControls };\n})();",
        );
      type = "text/javascript";
    } else {
      const requested =
        url.pathname === "/vrnrn"
          ? "/docs/chrome-web-store/source/studio.html"
          : url.pathname;
      const file = path.resolve(root, "." + decodeURIComponent(requested));
      if (!file.startsWith(root + path.sep)) throw new Error("Outside root");
      body = await readFile(file);
      type = types[path.extname(file)] || "application/octet-stream";
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(4187, "127.0.0.1", () =>
  console.log("Asset studio: http://127.0.0.1:4187/vrnrn?asset=watch"),
);
