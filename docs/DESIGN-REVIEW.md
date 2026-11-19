# Design review (round 6)

**Date:** 2026-11-19

**Scope:** every screen of EPOCH at five device sizes. The review covered spacing, type, contrast, touch targets, layout, motion, states and consistency. The owner allowed identity changes and set the fix bar: fix all high and medium findings, fix low ones when cheap, and defer the rest with a reason.

**Method:** `tools/design-capture.mjs` captures every screen on five profiles: iPhone SE, iPhone 13, iPhone 13 landscape, iPad (gen 7) and desktop at 1280×800. There are 106 captures, taken from the production build in Chromium. On each screen the tool also measures:

- text smaller than 12 CSS px;
- touch targets smaller than 44 px on touch devices;
- text below WCAG AA contrast;
- every CSS transition and animation in use.

Each finding cites the principle it rests on: Nielsen's heuristics (H1–H10), Fitts's law or WCAG. This is Chromium emulation, not a physical device. Before-captures are in `images/design-review/before/` and after-captures in `images/design-review/after/`.

**Measured before:** across all screens and devices the tool counted 968 text nodes under 12 px (3 distinct elements), 1,415 small touch targets (10 distinct elements) and 253 contrast failures. All of the contrast failures were measurement errors: the era frames use gradient backgrounds, and the first version of the tool ignored them (see D13). The only motion in use was one 0.25 s animation.

## Findings

| ID | Severity | Screen / device | Finding | Principle | Fix | Identity change | Status |
|---|---|---|---|---|---|---|---|
| D1 | High | In-game HUD, phones | The news strip above the tool dock shows a whole post (medium, outlet, text, byline) and covers about a quarter of the map on a phone. | H8 minimalist design: the map is the primary content | On phones, show a compact one-line headline with its medium badge (tap opens the feed). Wider screens keep the full post. | no | Fixed: phones show one line of news (medium and text), and tapping it opens the feed. |
| D2 | High | Every screen, touch devices | Touch targets are below 44 px: playback 36×32, side icon buttons 40×40, power categories 56×40, the settings segmented control 38 px tall, `.btn.small` 36 px, checkboxes 22 px, chips. | Fitts's law; Apple HIG 44 pt | `--tap: 44px` is applied to every control on coarse pointers (`@media (pointer: coarse)`). Checkboxes get a full-row hit area. | no | Fixed: all controls are at least 44 px on touch screens. A checkbox inside a 44-px label counts as the label. |
| D3 | Medium | Tool dock, feed badges, key-figure tiles | Text below 12 px: tool labels 10.5 px, "STATE MEDIA" badges 10 px, tile captions 11 px. | WCAG 1.4.4 legibility; H4 | A type scale whose smallest step is 12 px, used everywhere. | no | Fixed: smallest text is 12 px (tokens `--t-xs`…`--t-xl`). |
| D4 | Medium | History, descriptions, feed body, settings help (all sizes) | Long text is set in the pixel display font at 12–14 px and is tiring to read. | Readability (pixel fonts are display faces) | Pair a readable body font (Atkinson Hyperlegible, OFL, self-hosted) for paragraphs and lists. Pixelify Sans stays for headings, buttons, numbers and the wordmark. Era frames keep their own type. | **yes** | Fixed (identity change): Atkinson Hyperlegible 400/700, self-hosted and OFL, is used for paragraphs, lists, preset descriptions, hints and footnotes. |
| D5 | Medium | Nation inspector, phones | The 10 tabs overflow sideways with no sign that more exist ("Technol…" is cut off), so tabs past the fifth are effectively hidden. | H6 recognition rather than recall | Tabs wrap onto two rows in narrow sheets, so all ten are visible. | no | Fixed: tabs wrap, so all ten are visible (three short rows on a phone). |
| D6 | Medium | Nation inspector, phones | Sheet height follows content, so it jumps between tabs (Diplomacy collapses to a strip). | H4 consistency; layout stability | Fixed sheet height on phones (62% of the viewport); content scrolls inside. | no | Fixed: phone sheets are a fixed 62vh. |
| D7 | Medium | New world, phone and desktop | The floating "Create world" button covers preset text (phone) and the size options (desktop). | H8; content obscured | Sticky footer bar with its own background, plus bottom padding on the page. | no | Fixed: a solid sticky footer bar with a top rule. |
| D8 | Medium | Close-up map (desktop) | Armies, settlers, herds and monsters are drawn at full size over 32-px city blocks and dwarf whole districts. | Visual hierarchy; scale consistency | Draw them at half size in the close-up. | no | Fixed: units, settlers, herds and monsters are drawn at half size from 20 px per tile. |
| D9 | Medium | Sheets, toasts, buttons | There is no motion system. Sheets snap open and shut, and the only animation is a 0.25 s tick-in. State changes give no spatial cue. | H1 visibility of system status; motion guidelines (≤ 300 ms for direct interactions) | Motion tokens: `--dur-fast 120ms`, `--dur-sheet 200ms`, `--ease-out`. Sheets slide and fade in. Button presses ease. | no | Fixed: motion tokens; sheets slide up (phone) or in (side panel) over 200 ms; presses and borders ease over 120 ms. |
| D10 | Medium | Whole game | `prefers-reduced-motion` is ignored. Water, smoke, weather, walkers and traffic animate constantly. | WCAG 2.3.3 animation from interactions | A **Reduce motion** setting (default follows the OS) that turns off UI transitions and freezes map ambience (water and weather at most 1 frame per second, no walkers or traffic). | no | Fixed: a Reduce motion setting (default off, and the OS setting also applies). It turns off UI transitions, holds map sprites to at most 1 frame per second, and hides walkers and street traffic. |
| D11 | Low | All | Spacing values are ad hoc (4, 6, 8, 10, 12, 14, 16, 18 px). | Law of similarity | A spacing scale on a 4-px base (`--s1`…`--s8`), used in the rules this round touches. | no | Partly fixed: the 4-px scale is defined, and every rule touched this round uses it. Older rules keep their values (deferred: cosmetic, no user impact). |
| D12 | Low | Statistics, phones | Chart legend labels are cut off at the chart edge ("World p…"). | H6 | Legend below the chart on narrow screens. | no | Fixed: single-series charts drop the end label (the heading names the series); multi-series labels are fitted with an ellipsis; axis text is 12 px. |
| D13 | Info | Measurement | The first contrast pass compared dark text on gradient era frames (scroll, broadsheet) with the dark app background behind them. That gave 253 false failures. | — | The tool now reads the first colour of a gradient background. Results are re-measured below. | no | Fixed in the tool (gradient backgrounds, and labels as checkbox targets). |

## Results after the fixes

Same 106 captures and the same five devices, after the fixes (`node tools/design-capture.mjs`):

| Measure | Before | After |
|---|---|---|
| Text under 12 CSS px | 968 (3 distinct elements) | **0** |
| Touch targets under 44 px (touch devices) | 1,415 (10 distinct elements) | **0** |
| Text below WCAG AA contrast | 253 reported (all false: gradient frames) | **0** (real issues found and fixed along the way: bylines on light frames, red at 4.48:1 on a lighter panel) |
| Motion in use | one 0.25 s animation | 120 ms press and colour transitions, 200 ms sheet entrances; all off under Reduce motion or the OS setting |

Before and after captures of the same screens are in `images/design-review/before/` and `images/design-review/after/`. Visible changes:

- the one-line news strip on phones;
- the full set of nation tabs;
- stable sheet height;
- the solid Create bar;
- 44-px controls;
- body text in the readable face;
- half-size units in the close-up.

**Not covered:** physical devices, WebKit and Firefox (Chromium emulation only); screen-reader and keyboard walkthroughs beyond focus rings (focus-visible outlines already existed); colour-vision simulation.
