# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Twitch viewers watching a creator who also streams on YouTube. They want the
YouTube feed while keeping the Twitch community, chat and channel interface.

## Product Purpose

YouTube Player for Twitch (YPFT) replaces the video area with a YouTube embed
without leaving the Twitch channel. Finding and selecting a stream is the main
task; playback and chat preferences support that task.

## Operating Context

Chrome Manifest V3 extension injected into Twitch. Vanilla JavaScript and CSS,
with no UI framework or external font dependency. The in-page YPFT button sits
on the right of Twitch's navigation and blends with its controls.

## Capabilities and Constraints

- Keep YouTube search, recent/pinned streams, URL selection, Sync Now and Restore
  Twitch in the dropdown. Additional settings belong in a centered window with
  sidebar navigation, following the user's reference layout.
- The settings window contains Playback, Chat and Player extras. Preserve all
  existing settings, local persistence, keyboard access and reload semantics.
- Floating chat mirrors Twitch's rendered messages, badges and emotes. It is
  read-only, movable, resizable and optionally visible in fullscreen only.
- Extra emotes include global and channel catalogs from BTTV, FFZ and 7TV.
  Channels and categories default to highest viewer count first.
- Preserve bounded chat queues, lazy UI creation, cleanup on close and existing
  memory optimizations. Do not add a framework, polling loop or heavy visual
  effect for the redesign.
- User confirmed the redesign includes the dropdown, settings window and
  floating chat. Website, store artwork and extension icon are outside scope.
- Keep the local unpacked build at build/latest. Replace it on each build and
  retain no old build folders.

## Brand Commitments

Use the existing name YouTube Player for Twitch and the abbreviation YPFT.
The supplied BTTV screenshot is a layout reference, not settings content.
The user selected Twitch familiar for the redesign. Twitch and BTTV are the
visual references: dark neutral surfaces, purple selection, familiar controls.

## Evidence on Hand

Implementation and usage documentation live in twitch-content.js,
twitch-chat.js, twitch-styles.css and docs/usage.md. Existing visual captures
are in docs/qa. Automated tests and local browser previews are available;
synthetic heap measurements do not establish total browser memory usage.

## Product Principles

- Make stream selection fast and keep Twitch chat available.
- Keep secondary preferences out of the main dropdown.
- Retain native interaction, local preferences and existing functionality.
- Spend memory and screen space on the stream and community.

## Open Decisions

Light-theme styling is not established by this request. Preserve the current
dark extension surfaces for this redesign rather than expanding theme support.
