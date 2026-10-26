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
    twitch-directory.js \
    twitch-emotes.js \
    twitch-chat.js \
    kick-support.js \
    twitch-content.js \
    twitch-styles.css \
    icons/icon16.png \
    icons/icon48.png \
    icons/icon128.png \
    LICENSE
unzip -tq release.zip
node scripts/check-release.mjs

# Reserve build/ for the latest unpacked extension; never retain older builds.
unpacked_dir=build/latest
rm -rf build
mkdir -p "$unpacked_dir"
unzip -q release.zip -d "$unpacked_dir"
node scripts/check-release.mjs "$unpacked_dir"
