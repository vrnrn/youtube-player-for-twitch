# YPFT interface audit and polish

Audited October 11, 2026. Scope: stream dropdown, settings and floating chat.
Visual authority: the user's selected Twitch familiar direction. Website,
store artwork and provider catalogs are outside this pass.

## Initial implementation integrity verdict

Pass with minor token-record gaps. The UI expresses the extension's actual
stream-selection and chat tasks, with native controls, labeled sample messages,
open settings rows and bounded chat processing. The manual detector reported
18 advisory occurrences: 12 color occurrences and six type-size occurrences.
They are intentional existing values missing from the normative token record,
not reasons to change the selected design. No prior critique snapshot existed.

## Audit health

| Dimension | Before | Main evidence |
| --- | --- | --- |
| Accessibility | 3/4 | Named native controls and focus; URL error lacks a field association. |
| Performance | 4/4 | Lazy dialog, bounded chat, batched layout, no framework or video filters. |
| Theming | 3/4 | Shared tokens, but several reused surfaces remain literals. |
| Responsive design | 2/4 | Settings fit; stream dropdown clips at 320px and touch controls are small. |
| Implementation integrity | 3/4 | Coherent system; documented type ramp omits deliberate sizes. |
| **Total** | **15/20 — Good** | Six actionable findings below. |

Severity: no P0 findings, one P1, four P2 and one P3. Fix the clipped selector
first, then input and gesture recovery, touch sizing and token consistency;
finish with polish. The user authorized all these steps together.

## Findings and remedies

### F1 · P1 · Narrow selector clips outside the viewport

- Location: `twitch-styles.css`, narrow dropdown rule (original line 264).
- Category: responsive design.
- Evidence: at 320 × 700, menu left is −37.58px, width 296px. Its title,
  search action, URL field and error text are visibly clipped.
- Impact: the main stream-selection task is difficult in a narrow window.
- Remedy: anchor the narrow dropdown inside the viewport, including theatre mode.
- Suggested command: `$impeccable adapt`.

### F2 · P2 · URL errors lack field feedback and correction recovery

- Location: `twitch-content.js`, URL markup and `setupEventListeners`
  (original lines 123 and 982–991).
- Category: accessibility.
- Evidence: submitting `bad url` displays an error, but `aria-invalid` and
  `aria-describedby` are absent; focus stays on Go. Editing the URL leaves
  stale error copy visible.
- Impact: users must connect the error to the field and infer how to recover.
- Remedy: associate feedback, mark and focus the invalid field, then clear
  the stale validation state when the user corrects it.
- Standard: improves programmatic identification and correction feedback;
  the existing text already identifies the URL, so this is not recorded as a
  categorical WCAG failure. See [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html).
- Suggested command: `$impeccable harden`.

### F3 · P2 · Interrupted or additional pointers can leave a stale chat gesture

- Location: `twitch-chat.js`, `startGesture`, `endGesture` and listener lifecycle
  (original lines 132–168, 356–381).
- Category: responsive interaction.
- Evidence: regression tests fail for blur/hidden-page interruption and a
  second pointer replacing the current gesture. Cancel and lost-capture handlers
  already exist and should remain.
- Impact: movement may continue under the wrong pointer, or stale drag state
  may survive a focus change.
- Remedy: reject additional/nonprimary pointers, ignore unrelated pointer-up,
  finish on blur and hiding, and remove the blur listener when disabled.
- Suggested command: `$impeccable harden`.

### F4 · P2 · Compact controls are difficult under coarse pointer input

- Location: `twitch-styles.css`, close/pin/chat tools and native appearance
  controls (original lines 67, 102, 165–168, 202–220).
- Category: responsive design.
- Evidence: close controls are 32px; pins/chat tools are 28px; narrow tabs are
  40px; color input is 38 × 30px. Switch labels already supply a large target.
- Impact: touch activation and resizing need more precision than necessary.
- Remedy: preserve desktop density and enlarge targets to 44px for coarse
  pointers; keep drag surfaces' existing `touch-action: none`.
- Standard: 44px is an enhanced usability target. WCAG 2.2 AA generally uses
  24px plus spacing exceptions; small controls are not automatically AA
  violations. See [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Suggested command: `$impeccable adapt`.

### F5 · P3 · Token record omits deliberate local values

- Location: `twitch-styles.css`, DESIGN.md and `.impeccable/design.json`.
- Category: theming and implementation integrity.
- Evidence: detector advisories identify missing 10/11/15/24px roles and native
  hover, translucent seams, scrim, feedback and selected-hover colors.
- Impact: future edits can duplicate these values or mistake deliberate design
  choices for drift.
- Remedy: promote reused color roles and record the actual sizes; preserve the
  selected appearance. Keep shadows and motion in the sidecar.
- Suggested command: `$impeccable polish`.

### F6 · P2 · Reduced motion misses switch thumbs

- Location: `twitch-styles.css`, reduced-motion override.
- Category: accessibility.
- Evidence: with reduced motion emulated, the control has a zero-duration
  transition but its `::before` thumb still reports 150ms. The universal
  descendant selector did not cover pseudo-elements.
- Impact: the switch still animates despite the user's motion preference.
- Remedy: apply the same static state change to the thumb and other
  extension pseudo-elements, preserving visible checked state.
- Suggested command: `$impeccable animate`.

## Positive findings and scope limits

The native dialog manages modality. Tabs, Escape, focus return, lazy removal,
local preference persistence and appearance preview behavior are covered by
existing checks. Chat retains 60 visible rows, bounded queues, sanitized native
content, no added network client and teardown on disable. Layout work is batched
through animation frames. Static switch state remains visible under reduced motion.

Browser evidence uses local sources in an isolated world on a temporary Twitch
tab with in-memory settings/search responses. It does not change installed
preferences or send chat messages. Captures cover 1280, 940, 390 and 320px widths.
Coarse-pointer emulation is available; the in-app browser rejects synthesized
touch events, so touch gestures require a physical-device follow-up. Pointer
lifecycle is covered by regression tests; desktop drag was exercised in the
browser. Screen-reader software and total browser/video memory are not measured.

## Detector and hook triage

The manual detector ran once for this audit. Its palette/type advisories are
addressed by the system record. The active hook also reported two broken-image
findings in `tests/twitch-chat.test.js`: intentional hostile-image strings and
test nodes used to verify sanitization. These are fixture false positives,
not shipping images. The two findings were suppressed with a `broken-image`
value ignore scoped to that test file in `.impeccable/config.json`. No rule-wide
or file-wide hook suppression was added. The final automatic design hook
reported no deterministic design-quality issues.

## Fix and polish verification

All six actionable findings are resolved. The Twitch familiar direction is
preserved; the pass adds no framework, remote font, raster asset or video filter.

| Finding | Resolution and confirmation |
| --- | --- |
| F1 | Narrow dropdown uses viewport anchoring. At 320px it measures x=12px, width=296px, right=308px, with no horizontal overflow. |
| F2 | Invalid URLs mark and focus the field, associate feedback and clear stale errors on correction. A regression confirms subsequent valid playback. |
| F3 | Active gestures reject additional/nonprimary pointers and end on blur, hiding, cancellation or lost capture. Regression tests verify persistence and listener teardown; browser mouse drag and keyboard movement work. |
| F4 | Coarse-pointer controls provide 44px targets, including tabs, close/pin actions, appearance inputs and chat tools. Fine-pointer density stays the same. |
| F5 | Reused local colors now have semantic tokens; the actual type roles are recorded in DESIGN.md and its sidecar. Exact colors remain unchanged. Long copy wraps within the available width. |
| F6 | Reduced-motion overrides cover pseudo-elements. The switch thumb computes a zero-duration transition and its checked state remains visible. |

The three new regressions reproduced the URL and gesture defects before the
fixes. All 41 focused content/chat tests then passed. `npm run check` passes
syntax checks, **109 tests** and website validation. `npm run build` verifies
all **16 files** in `release.zip` and `build/latest`; packaged and unpacked bytes
match the sources. Only the constant `build/latest` folder remains under `build`.

Saved full-viewport captures were visually checked at 1280 × 720, 940 × 800,
390 × 844 and 320 × 700. A 640 × 720 CSS reflow check also fits without horizontal
overflow; this represents the available width of a 1280px view at 200%, but
was not an actual browser-zoom test. Keyboard tab selection, Escape dismissal
and focus return were checked in the browser. Search empty, error and success
states remain distinct; long results fit the dropdown.

Fixed shared color pairs measure 15.43:1 for body text, 9.40:1 for secondary
copy, 10.09:1 for placeholder text, 7.50:1 for primary button text, 8.85:1 for
URL feedback and 6.88:1 for preview authors. These measurements do not cover
arbitrary native chat-author colors or user-selected translucent backgrounds.

| Dimension | After | Remaining scope limit |
| --- | --- | --- |
| Accessibility | 3/4 | Field feedback, focus and motion confirmed; assistive-technology certification is outside this pass. |
| Performance | 4/4 | Existing lazy mounting and bounded processing preserved; total browser/video memory unmeasured. |
| Theming | 4/4 | Shared colors and actual type roles recorded and aligned with source. |
| Responsive design | 3/4 | Viewport fit and coarse target sizing confirmed; physical touch gestures untested. |
| Implementation integrity | 4/4 | No material source/design drift found in the scoped pass. |
| **Total** | **18/20 — Good** | No actionable audit findings left open. |

This score describes the inspected extension surfaces, not full WCAG
conformance or a whole-browser performance certification.

Selected confirmation captures:

- [Settings at desktop width](qa/ypft-audit-settings.png)
- [Narrow selector at 320px](qa/ypft-audit-dropdown.png)
- [Narrow settings with coarse input](qa/ypft-audit-narrow.png)
- [Floating chat after mouse and keyboard movement](qa/ypft-audit-floating-chat.png)

The complete before/after capture set is local review evidence under
`.impeccable/review/audit/`. Reload the extension and refresh Twitch to use the
rebuilt local build; the verification adapter did not reload the installed
extension or change real preferences.
