#!/bin/sh
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

rm -f release.zip
zip -X -q -r release.zip \
    manifest.json \
    background.js \
    twitch-content.js \
    twitch-styles.css \
    icons \
    LICENSE \
    README.md \
    product-description.md
unzip -tq release.zip
