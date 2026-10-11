---
name: "YouTube Player for Twitch"
description: "Twitch familiar controls for YouTube stream selection, settings and floating chat."
colors:
  bg: "#18181b"
  rail: "#25252b"
  surface: "#202024"
  hover: "#303038"
  line: "#35353d"
  control-line: "#62626f"
  text: "#efeff1"
  muted: "#bcbcc6"
  accent: "#bf94ff"
  accent-hover: "#d0afff"
  accent-ink: "#18181b"
  accent-subtle: "#332647"
  danger: "#ff9c9c"
  warning: "#f4ca74"
  success: "#88d9b0"
  field-bg: "#101012"
  hover-strong: "#40404a"
  accent-subtle-hover: "#3d2d53"
  native-hover: "#53535f7a"
  danger-subtle: "#ff9c9c0d"
  warning-subtle: "#483e27"
  tint: "#ffffff0d"
  tint-hover: "#ffffff14"
  preview-line: "#ffffff24"
  overlay-line: "#ffffff26"
  overlay-header: "#18181bd9"
  scrim: "#0009"
  ink: "#000"
typography:
  menu-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-0.2px"
  micro:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
  badge:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "10px"
    fontWeight: 550
    lineHeight: 1.5
  narrow-headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.65px"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.65px"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.2px"
  section-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  menu-body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  control-label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.5
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  nav-label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
  brand-mark:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "26px"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-0.6px"
rounded:
  small: "4px"
  icon: "5px"
  control: "6px"
  panel: "12px"
  dialog: "14px"
  round: "50%"
spacing:
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "18": "18px"
  "20": "20px"
  "24": "24px"
  "28": "28px"
  "32": "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.control-label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  button-secondary-hover:
    backgroundColor: "{colors.hover-strong}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-outline-hover:
    backgroundColor: "{colors.hover}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0"
    size: "32px"
  button-icon-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
  input-url:
    backgroundColor: "{colors.field-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  settings-nav:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  settings-nav-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
  settings-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    padding: "17px 0"
  switch:
    backgroundColor: "{colors.control-line}"
    rounded: "{rounded.dialog}"
    width: "40px"
    height: "24px"
  switch-checked:
    backgroundColor: "{colors.accent}"
  experimental-badge:
    backgroundColor: "{colors.warning-subtle}"
    textColor: "{colors.warning}"
    rounded: "{rounded.small}"
    padding: "2px 6px"
  result-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "14px"
  chat-preview:
    backgroundColor: "{colors.field-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "0 12px 14px"
  floating-chat:
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    width: "320px"
---

# Design System: YouTube Player for Twitch

## Overview

**Creative North Star: "Twitch familiar"**

Twitch familiar is the confirmed visual direction. The extension uses dark neutral surfaces, clear purple actions and selection, compact SVG icons and the platform UI sans. Twitch and BTTV are the visual authorities for familiar controls and settings density.

Hierarchy comes from text size, spacing and tonal layers. Stream selection stays compact; settings use open rows with aligned controls; floating chat keeps the community readable over the player. The shared system is scoped to extension surfaces so Twitch retains its own interface.

**Key Characteristics:**

- Dark neutral layers with purple actions and selection.
- System UI typography and compact, consistently stroked SVG icons.
- Open settings rows, restrained panel depth and visible keyboard focus.
- An immediate sample-message appearance preview and a bounded, movable chat overlay.

This record is extracted from `twitch-styles.css`, the dropdown and settings markup in `twitch-content.js`, and the floating-chat construction and defaults in `twitch-chat.js`. The frontmatter owns shared primitives. Component variants retain their actual local differences; the sidecar preserves borders, shadows, focus, motion and standalone examples that the frontmatter schema cannot express.

## Colors

The palette follows Twitch's dark neutrals and light purple controls, with distinct feedback colors for status messages.

### Primary

- **Twitch familiar purple** (`accent`): primary stream actions, selected settings tabs, checked switches, pinned history controls, preview authors and keyboard focus.
- **Purple hover** (`accent-hover`): hover feedback for filled actions.
- **Dark purple ink** (`accent-ink`): text and switch thumbs on the light purple fill. Its value matches the main background in the source.
- **Quiet purple** (`accent-subtle`): pinned history rows and pressed floating-chat controls.

### Neutral

- **Main dark** (`bg`): dropdown and settings background.
- **Sidebar dark** (`rail`): settings rail and select fields.
- **Raised dark** (`surface`): stream result cards.
- **Hover dark** (`hover`): neutral button and row hover feedback; Restore Twitch at rest.
- **Divider dark** (`line`): row rules, section dividers and settings-header separation.
- **Control outline** (`control-line`): URL/select/outlined-button borders, unchecked switches and scrollbar thumbs.
- **Primary light** (`text`): readable labels, body text and unchecked switch thumbs.
- **Secondary light** (`muted`): descriptions, helper copy, captions and idle icon controls.
- **Field dark** (`field-bg`): URL input and the chat preview's CSS fallback surface.

### Feedback

- **Error pink** (`danger`): errors and destructive history-clear hover text.
- **Warning gold** (`warning`): result notices, experimental labels and warning/pending feedback.
- **Success mint** (`success`): successful status messages and enabled interruption-blocking indicators.

**The Purple State Rule.** Use the shared accent for primary actions, selected tabs, enabled switches and keyboard focus. Neutral surfaces carry ordinary content.

The navigation entry inherits Twitch's text and hover colors when Twitch provides them. Floating-chat author colors mirror Twitch messages. Chat background color and opacity are user preferences rather than fixed shared tokens. Sidecar tonal strips are generated color previews, not additional approved UI colors.

The auxiliary roles preserve the actual neutral layers and feedback: stronger
neutral/pinned hover, Twitch's native hover fallback, subtle error/warning fill,
translucent interaction tint, preview/overlay seams, toolbar fill, scrim and
video/text-shadow ink. These are semantic values reused in the stylesheet;
their alpha is intentional rather than an additional theme.

## Typography

**UI Font:** the `fontFamily` stack in the frontmatter is shared across the extension. No external font is loaded.

**Character:** compact, familiar and readable. Weight identifies titles and actions; secondary copy remains regular. Controls keep ordinary case rather than adding uppercase tracking.

### Hierarchy

- **Headline** (`headline`): settings section headings (28px, 650, line height 1.25); the narrow layout reduces these to 24px.
- **Title** (`title`): the settings-window header (18px, 600).
- **Section title** (`section-title`): settings subsections (16px, 600).
- **Body** (`body`): settings text (14px, line height 1.5). Option titles use 550; descriptions use the smaller caption role.
- **Menu body** (`menu-body`): dropdown and appearance-control text (13px, line height 1.5). The dropdown title is 15px at 650; result titles are 14px at 600 with line height 1.4.
- **Control label** (`control-label`): filled dropdown actions (13px, 650). Restore Twitch, Sync Now and outlined settings actions use their observed 12px labels.
- **Caption** (`caption`): supporting labels and descriptions (12px). Preview captions and Latest use 11px; the Experimental badge uses 10px at 550.
- **Navigation label** (`nav-label`): the compact YPFT entry (12px, 700, line height 1).
- **Brand mark** (`brand-mark`): the YPFT word mark in the settings rail (26px, 750).

Settings introductions have a maximum measure of 65ch. Range outputs use tabular numerals. Floating chat starts at 14px with line height 1.45; the user can select 11–24px. Compact messages use line height 1.2.

## Layout

The dropdown is right-aligned under its navigation entry, with an 8px offset. It is 360px wide, capped at the viewport width minus 24px, and scrolls within the viewport height minus 76px. Its main horizontal padding is 20px; search and URL entry are separate groups.

Settings occupy a centered window capped at 1040px by 720px, with 48px horizontal and 64px vertical viewport clearance. A 210px rail sits beside the content; the main header is 78px high. Content padding is 28px by 32px. Standard options are at least 76px tall with 17px vertical padding. Appearance fields use the denser 54px rows. The preview sits beside controls in a 228px column with a 28px gap.

- At **940px and below**, appearance controls and preview stack, with a 16px gap and preview width capped at 320px.
- At **760px and below**, the settings rail becomes 180px; horizontal content padding becomes 20px and action rows can wrap.
- At **560px and below**, settings use 20px horizontal and 32px vertical viewport clearance. The rail becomes a horizontal three-tab row, its word mark and note are hidden, the header becomes 60px high, and content padding becomes 24px by 18px.

At the same narrow width, the stream dropdown is fixed 12px from both viewport
edges and 48px from the top, including theatre mode. With a coarse pointer,
compact actions, tabs, selects, ranges and color controls expand to 44px targets;
switch labels already provide a larger target. Floating chat uses 44px tools and
a 52px header under coarse input, while desktop density stays compact.

The spacing frontmatter records repeated literal intervals from the build, not an implied universal grid. Floating chat stays within the player with an 8px inset. Its initial width is 320px and height is 55% of player height; resizing clamps width to 160–600px and height to 15–90%, further constrained by player bounds.

**The Open Row Rule.** Settings groups stay transparent. Divide ordinary options with a fine bottom rule and align the control at the right edge of the row.

## Elevation & Depth

Dark tonal layers convey most depth. The dropdown and dialog use offset, softly blurred black shadows; their outer frames have no border. The dialog backdrop uses a translucent black scrim. Result cards and chat previews have no shadow. Floating chat uses a translucent white border and a subtle text shadow for legibility over video; it has no panel shadow or backdrop filter.

### Shadow Vocabulary

- **Dropdown elevation** (`0 16px 48px #0009`): separates the stream selector from Twitch navigation.
- **Dialog elevation** (`0 24px 80px #0009`): separates the settings window from the page.
- **Chat text** (`0 1px 2px #000`): supports chat text over video; the toolbar resets this shadow.

**The Surface Depth Rule.** The dropdown and settings dialog carry the soft elevation shadows. Result cards and chat previews separate through tone; floating chat uses a fine translucent border.

## Shapes

Small controls use gently curved corners: 4px for the navigation entry and experimental badge, 5px for small chat and history tools, and 6px for ordinary buttons, tabs and fields. Dropdowns, result cards, chat previews and floating chat use 12px corners. The desktop settings window uses 14px corners, reducing to 12px on narrow screens.

The switch is a 40px by 24px rounded track with an 18px circular thumb. Its checked state moves the thumb 16px and replaces the track with purple. Status indicators are 6px circles. Form outlines and dividers use a single-pixel stroke.

## Components

### Buttons

Filled purple actions lead stream selection. Find YouTube Stream uses a 40px minimum height and 10px by 14px padding; Go is at least 48px wide; result actions, Sync Now and Restore Twitch use a 36px minimum height. The exact padding for each variant remains in source and the frontmatter.

Restore Twitch uses a filled neutral surface. Theatre Mode, reload and chat-reset actions use a transparent surface with the control outline. Close controls are 32px square; history and floating-chat tools are 28px square. Ghost actions brighten on hover. Theatre Mode's pressed state uses the purple border and text.

Keyboard focus is a 2px purple outline with a 3px offset on navigation and settings controls. Floating-chat controls use an inset outline at −2px so focus fits within the clipped panel. Disabled controls use 0.55 opacity and a default cursor.

### Inputs / Fields

URL entry uses the field-dark surface, control outline and 6px corners, with a 40px minimum height. Focus changes the border to purple; placeholder text uses the shared secondary light at full opacity. The caret and text selection use the purple accent.

Appearance selects are 174px wide, capped at 60% of their row, with a 36px minimum height. Range controls use the same width, a purple native accent and an adjacent numeric output. The background-color control is 38px by 30px with a 5px radius. These remain native controls.

An invalid URL uses the error border and linked status feedback, focuses the
field, and clears stale validation feedback during correction. Long status and
result copy may wrap anywhere to preserve the narrow layout.

### Navigation

The YPFT entry is a 30px-high compact text button placed in Twitch navigation. An active player colors its label purple. In theatre layout the entry sits at the upper left and gains a dark background and control outline.

Settings navigation uses vertical, icon-and-label tabs on the rail, with 46px minimum height and 6px corners. Hover uses the shared neutral treatment; selection uses purple with dark ink. On narrow screens tabs form a 40px-high horizontal row and omit their icons. Tab orientation and arrow-key behavior follow the layout.

### Settings Rows / Switches

Open rows pair a title and optional description with a right-aligned switch or action. Standard descriptions sit 4px below titles. Switches retain native checkbox behavior with `role="switch"`, a circular thumb and a single 150ms ease-out thumb transition. Reduced-motion preference disables transitions across extension surfaces.

### Chips / Status

The Experimental chip uses a muted gold surface, warning text, 4px corners and 2px by 6px padding. Feedback uses the semantic text colors and, in interruption-blocking status, a small matching status dot. Labels and message copy carry the state alongside color.

### Cards / Containers

Stream-result cards use the raised-dark surface, 12px corners and 14px padding. Their title clamps to two lines; creator text sits below and the stream action spans the card. Pinned history rows use quiet purple and a purple pressed pin; ordinary history rows remain transparent until hover. Stream-title ellipsis keeps history rows compact.

The dropdown and settings dialog use the panel depth vocabulary. Settings groups themselves have no card surface or radius.

### Chat Appearance Preview

A clearly labeled sample-message preview shows the chosen background color, opacity, text size and compact spacing immediately during control input. It has 12px corners, 208px minimum height on wide layouts and 170px when stacked. The purple sample authors are illustrative; live authors retain Twitch's colors. Changes still persist through the existing change handlers.

### Floating Chat

The read-only panel uses 12px corners, a fine translucent border, a 36px header and message padding of 8px by 12px with 24px bottom clearance. The header groups a labeled drag grip with compact and close tools. A Latest action appears while scrolled away from the newest messages; resize sits at the lower right. Its three diagonal grip lines stay inset 5px from the corner, with a muted resting color and a hover shape that follows the panel's inner 11px radius. The target remains 24px on desktop and 44px for coarse pointers; the icon stays at the corner in both sizes. The separate fullscreen button uses a 34px square control.

When native chat starts collapsed and empty, a visible overlay initializes that feed once. A temporary scoped mask keeps the sidebar visually collapsed and holds the native player's existing width during startup. The mask, width override and startup click listener are removed after the native collapsed state is restored, including cancellation. Startup is bounded to five seconds plus a 100ms commit window; it adds no second chat client or permanent observer.

The default chat background is the configurable `#18151f` at 70% opacity. Normal messages have 4px vertical padding; compact messages remove it. Twitch author colors, badges and emotes are retained. Dragging and resizing also support arrow keys. Click-through mode leaves the header interactive while message clicks reach the video.

Native scrollbars are always hidden throughout the floating overlay, including hover, focus, fullscreen and coarse-pointer states. The message area keeps native mouse, touch and keyboard scrolling; Latest remains available while reading older messages.

One primary pointer owns a drag at a time. Release, cancel, lost capture, blur
and page hiding end the gesture; unrelated pointers cannot replace or end it.

## Do's and Don'ts

### Do:

- **Do** use the shared dark palette and purple action, selection and focus states.
- **Do** keep settings labels and descriptions in open rows with right-aligned controls.
- **Do** retain the native button, input, tab, switch and dialog semantics and visible focus treatments.
- **Do** use the existing SVG stroke vocabulary for interface icons.
- **Do** label the appearance preview as sample messages and reflect appearance controls immediately.
- **Do** preserve the stacked appearance layout and horizontal settings tabs at the implemented narrow widths.

### Don't:

- **Don't** turn settings groups into nested cards; use the observed row dividers.
- **Don't** introduce a separate display font into these extension controls; the confirmed world uses the system UI stack.
- **Don't** add decorative blur or heavy effects over the player.
- **Don't** treat user-selected chat colors, text sizes or generated tonal-ramp previews as new shared palette rules.
- **Don't** infer a light theme from this dark-surface redesign; light-theme styling is not established.
