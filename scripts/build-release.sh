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
    docs/vaft-qa.md \
    twitch-playback.js \
    twitch-content.js \
    twitch-styles.css \
    icons \
    LICENSE \
    README.md \
    product-description.md
unzip -tq release.zip
