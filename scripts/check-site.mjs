import assert from "node:assert/strict";
import fs from "node:fs/promises";

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
  for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (!value.startsWith("/")) continue;
    const target = new URL(value, origin).pathname;
    const relative = target.endsWith("/")
      ? `${target.slice(1)}index.html`
      : target.slice(1);
    await fs.access(new URL(relative, directory));
  }
}
const missing = await fs.readFile(new URL("404.html", directory), "utf8");
assert.match(missing, /name="robots" content="noindex"/);
assert.ok(
  !sitemap.includes("404.html"),
  "Error pages are excluded from the sitemap",
);
console.log(
  "Validated product and privacy metadata, structured data, sitemap, robots, local assets, and the 404 page.",
);
