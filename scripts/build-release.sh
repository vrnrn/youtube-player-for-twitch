#!/bin/sh
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

node scripts/prepare-vaft.mjs --check

rm -f release.zip
zip -X -q -r release.zip \
    manifest.json \
    background.js \
    vaft-main.js \
    vendor/vaft/vaft.js \
    vendor/vaft/LICENSE \
    vendor/vaft/README.md \
    docs \
    twitch-playback.js \
    twitch-chat.js \
    twitch-content.js \
    twitch-styles.css \
    icons \
    LICENSE \
    README.md \
    product-description.md \
    -x 'docs/chrome-web-store/*' 'docs/assets/site-social-preview.html' '*/.DS_Store'
unzip -tq release.zip
