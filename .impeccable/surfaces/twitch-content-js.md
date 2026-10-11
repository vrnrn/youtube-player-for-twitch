---
version: 1
slug: "twitch-content-js"
primary_target: "twitch-content.js"
related_targets: ["twitch-styles.css","twitch-chat.js"]
---

# YPFT extension interface

Mode: Operate. Scope: in-page stream dropdown, settings dialog and floating chat.
Audience: Twitch viewers selecting a YouTube stream and adjusting their chat.
Keep every existing control, local preference, native keyboard affordance and
memory bound. Website and store artwork are outside scope.

## Direction contract

THESIS: Make stream selection immediate and secondary settings easy to scan;
replace oversized boxed options with familiar open setting rows.

OWN-WORLD: Twitch familiar, explicitly selected by the user. Dark Twitch
neutrals, clear purple active states, a system UI sans, compact SVG icons and
one shared control vocabulary. Twitch and BTTV supply the craft bar.

STORY: Open YPFT, find or select a stream, then adjust optional preferences in
Settings. Chat remains legible and unobtrusive over the video.

FIRST VIEWPORT: A centered 1040px window with a 210px sidebar, Settings header,
28px section title, aligned switches, and controls beside a clearly labeled
sample-message appearance preview. The dropdown stays about 360px wide.

FORM: Category standard, selected over the assigned candidate 5; seed
4606f357. The fixed reference is .impeccable/mocks/decision/canon.html. The
signature interaction is an immediate appearance preview as sliders move;
preferences still commit through the existing change handlers. Narrow windows
use a tab row and stacked appearance controls.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
