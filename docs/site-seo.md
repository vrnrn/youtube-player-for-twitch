# Product website SEO

The Cloudflare Pages project `ytpt-site` publishes the `site/` directory at `https://youtube-player-for-twitch.vrnrn.com`. Website files are separate from the extension release package.

Run `npm run check:site` before publishing website changes. This validates the canonical product and privacy URLs, structured site/page identities, local assets, crawler files, and the non-indexable error page. `site/404.html` gives Pages an explicit error page and prevents its default single-page-app fallback from returning the homepage for missing paths.

`robots.txt` advertises `https://youtube-player-for-twitch.vrnrn.com/sitemap.xml`. The sitemap contains the product and privacy pages and excludes the error page. Submit the live XML URL in the verified `vrnrn.com` Search Console domain property after deployment; that property includes this subdomain.

Descriptions and page names identify the Chrome extension's actual features. `WebSite` and `WebPage` JSON-LD identifies this product separately from the personal website and links to its creator. The markup does not assert software reviews, ratings, or rich-result eligibility.

A push to this repository's `main` branch runs the extension checks and build through GitHub Actions. Creating a GitHub release requires an explicit manual workflow dispatch with the release option enabled. Deploy `site/` to the Pages project `ytpt-site` to publish website changes.
