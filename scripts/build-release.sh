#!/bin/sh
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

node scripts/prepare-vaft.mjs --check

# Explicit files keep artwork, authoring tools and local state out of the package.
rm -f release.zip
zip -X -q release.zip \
    manifest.json \
    background.js \
    vaft-main.js \
    vendor/vaft/vaft.js \
    vendor/vaft/LICENSE \
    vendor/vaft/README.md \
    twitch-playback.js \
    twitch-chat.js \
    twitch-content.js \
    twitch-styles.css \
    icons/icon16.png \
    icons/icon48.png \
    icons/icon128.png \
    LICENSE
unzip -tq release.zip
node scripts/check-release.mjs
