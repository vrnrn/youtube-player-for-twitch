import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const directory = new URL("../site/", import.meta.url);
const origin = "https://youtube-player-for-twitch.vrnrn.com";
const routes = ["/", "/privacy/"];
const sitemap = await fs.readFile(new URL("sitemap.xml", directory), "utf8");
assert.match(sitemap, /^<\?xml/);
assert.equal((sitemap.match(/<loc>/g) || []).length, routes.length);
const robots = await fs.readFile(new URL("robots.txt", directory), "utf8");
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.ok(!/Disallow:\s*\/\s*$/m.test(robots));

for (const route of routes) {
  const url = `${origin}${route}`;
  const html = await fs.readFile(
    new URL(`.${route}index.html`, directory),
    "utf8",
  );
  assert.equal(
    (html.match(/<h1[ >]/g) || []).length,
    1,
    `${route}: one primary heading`,
  );
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /name="description"\s+content="[^"]+"/);
  assert.ok(
    !/name="robots"[^>]+noindex/.test(html),
    `${route}: indexable page`,
  );
  assert.match(
    html,
    new RegExp(
      `rel="canonical"\\s+href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
    ),
  );
  assert.ok(
    sitemap.includes(`<loc>${url}</loc>`),
    `${route}: canonical URL in sitemap`,
  );
  const block = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(block, `${route}: structured data`);
  const data = JSON.parse(block[1]);
  assert.equal(data["@context"], "https://schema.org");
  const page = data["@graph"].find((item) => item["@type"] === "WebPage");
  assert.equal(page.url, url, `${route}: structured page URL`);
  if (route === "/") {
    assert.equal(
      data["@graph"].find((item) => item["@type"] === "WebSite").url,
      url,
    );
  } else {
    const crumbs = data["@graph"].find(
      (item) => item["@type"] === "BreadcrumbList",
    ).itemListElement;
    assert.equal(crumbs.at(-1).item, url, "Privacy breadcrumb destination");
  }
}
const missing = await fs.readFile(new URL("404.html", directory), "utf8");
assert.match(missing, /name="robots" content="noindex"/);
assert.ok(
  !sitemap.includes("404.html"),
  "Error pages are excluded from the sitemap",
);

for (const route of [...routes, "/404.html"]) {
  const relative = route.endsWith("/") ? `${route.slice(1)}index.html` : route.slice(1);
  const html = await fs.readFile(new URL(relative, directory), "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${route}: unique element IDs`);
  for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (!value.startsWith("/") && !value.startsWith("#")) continue;
    const target = new URL(value, `${origin}${route}`);
    const file = target.pathname.endsWith("/") ? `${target.pathname.slice(1)}index.html` : target.pathname.slice(1);
    const content = await fs.readFile(new URL(file, directory));
    if (target.hash) {
      const targetIds = [...content.toString().matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
      assert.ok(targetIds.includes(decodeURIComponent(target.hash.slice(1))), `${route}: ${value} has a target`);
    }
    if (/\.(css|js)$/.test(file)) {
      const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
      assert.equal(target.searchParams.get("v"), hash, `${value}: run npm run version:site after editing assets`);
    }
  }
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) assert.match(tag, /\balt="[^"]*"/, `${route}: image alternative text`);
}
console.log(
  "Validated website metadata, structured data, routes, anchors, assets, cache versions, and the 404 page.",
);
