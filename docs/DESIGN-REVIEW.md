# Design review

## R10. Round 10: medium-themed feed, era typography, accessibility audit (2026-11-24)

**Scope:**
- the news feed, which now takes on its era's medium;
- the nation inspector on phones;
- the HUD's nation count;
- era typography;
- a WCAG 2.2 AA audit of every screen.

**Method:**
- `design-skills:accessibility-audit` (5 layers);
- `design-skills:design-critique` (Nielsen heuristics, UX laws);
- `frontend-design` for the type and colour direction.

The evidence comes from the production build in Chromium and WebKit: Playwright emulation of an iPhone 13 and a 1280×800 desktop, plus a 320-px reflow check. **No physical device and no screen reader (VoiceOver, NVDA) were used.** Layer 3 of the audit (screen-reader testing) was therefore limited to what axe checks in the accessibility tree: names, roles, states and labels.

### Accessibility audit (`npm run a11y`, axe-core 4.14.1, WCAG 2.2 A/AA rules)

The first pass in Chromium passed 37 of 78 checks; 41 failed. Every finding was fixed:

| # | Finding | WCAG | Severity | Fix |
|---|---|---|---|---|
| 1 | Escape did not close any sheet | 2.1.1 / expected dialog behaviour | High | Escape closes the open sheet (not while typing) |
| 2 | The viewport blocked pinch-zoom (`user-scalable=no`) | 1.4.4 | High (on every page) | Removed; the map keeps its own gestures (`touch-action: none` on the canvas) |
| 3 | Scroll areas could not be reached with the keyboard (Statistics, the outlet chips) | 2.1.1 | High | Every sheet body is focusable; the outlet chips wrap |
| 4 | The feed could not be scrolled with the keyboard in WebKit (Safari does not focus scroll areas) | 2.1.1 | High | A focusable, named region |
| 5 | Two law sliders had no label | 1.3.1 / 4.1.2 | Critical | `<label for>` |
| 6 | Meters (stability, skills, adoption…) had no name | 4.1.2 | Serious | `Bar` now requires a label (TypeScript enforces it) |
| 7 | The History button's visible war count was not part of its name | 2.5.3 | Serious | "History, 3 active wars" |
| 8 | Phones: the Menu button sat under an open sheet | 2.5.8 | Serious | HUD buttons laid out 3×2 |
| 9 | Nation tabs: no arrow-key navigation, every tab a Tab stop | ARIA tabs pattern | Moderate | Roving tabindex; arrows, Home and End |

**After the fixes:** 80/80 checks in Chromium and 80/80 in WebKit, with 0 violations at any impact level. The checks cover 30 stops per device, the scripted keyboard, Escape, 320-px reflow and text-spacing checks, and the feed in 4 mediums. All 8 mediums' colours are proven by `tests/ui/mediumTheme.test.ts`: text ≥ 4.5:1, borders and focus ≥ 3:1.

### Design critique

| # | Finding | Principle | Severity | Resolution |
|---|---|---|---|---|
| 1 | **The feed did not scroll at all.** `.sheet-body` was a flex child without `min-height: 0`, so every sheet grew instead of scrolling. | H3 user control | 4 | Fixed in the layout (every sheet) |
| 2 | **The feed was a brown box inside a navy panel.** | Common region, aesthetic integrity | 3 | The whole sheet takes the medium: header, filters, tabs, frame, posts |
| 3 | **On phones, the nation tabs took three rows** and the Favourites bar a fourth, so the first post was below the fold. | False floor | 3 | One swipeable tab row; Follow and Favourite as header icons |
| 4 | **On phones, the nation chips took four rows** before the first post. | False floor; Hick's law | 3 | One swipeable chip row |
| 5 | **Generic Georgia** on the scroll, broadsheet and newspaper themes; the newspaper masthead font was never bundled. | Aesthetic integrity | 3 | Era typography (below) |
| 6 | **Uncial letterforms** (a "t" that reads as "c") made invented names hard to read. | H2; readability | 3 | Almendra replaces Uncial Antiqua |
| 7 | **Truncated names** ("Kingdom of Gai…", "Renaissanc…") | H1 | 2 | Titles and stat values wrap |
| 8 | **"8 / nations"** broke across lines in the HUD; one nation read "1 people"; wandering bands counted as nations | Proximity; H2 | 2 | No-break spaces; an honest nation and tribe count |
| 9 | **"Older posts"** showed when there were none | H1 | 1 | Shown only when older posts exist; also loads on scroll |

### Era typography

Every face is bundled under the OFL licence (the CSP stays `'self'`). Display faces are used for headings only; body text is a readable face at 16 px with a 1.5 line height.

| Medium | Display | Body |
|---|---|---|
| Cave carving | Pixelify Sans | Pixelify Sans |
| Clay tablet | Cinzel | Alegreya |
| Scroll | Almendra | Alegreya |
| Printed broadsheet | IM Fell English | IM Fell English |
| Newspaper | UnifrakturMaguntia (masthead), Old Standard TT | Old Standard TT |
| Broadcast | Oswald | Atkinson Hyperlegible |
| Social app | Atkinson Hyperlegible | Atkinson Hyperlegible |
| Hologram | Orbitron | Atkinson Hyperlegible |

Postcards and aerial photos letter in their era's face too. The rest of the game keeps its own pixel face (Pixelify Sans) with Atkinson Hyperlegible for reading. A guard test (`tests/ui/fonts.test.ts`) fails if any font named in the CSS or on the canvas is not bundled.

---

## R6. Design review (round 6)

**Date:** 2026-11-19

**Scope:** every screen of EPOCH at five device sizes. The review covered spacing, type, contrast, touch targets, layout, motion, states and consistency. The owner allowed identity changes and set the fix bar: fix all high and medium findings, fix low ones when cheap, and defer the rest with a reason.

**Method:** `tools/design-capture.mjs` captures every screen on five profiles: iPhone SE, iPhone 13, iPhone 13 landscape, iPad (gen 7) and desktop at 1280×800. There are 106 captures, taken from the production build in Chromium. On each screen the tool also measures:

- text smaller than 12 CSS px;
- touch targets smaller than 44 px on touch devices;
- text below WCAG AA contrast;
- every CSS transition and animation in use.

Each finding cites the principle it rests on: Nielsen's heuristics (H1–H10), Fitts's law or WCAG. This is Chromium emulation, not a physical device. Before-captures are in `images/design-review/before/` and after-captures in `images/design-review/after/`.

**Measured before:** across all screens and devices the tool counted 968 text nodes under 12 px (3 distinct elements), 1,415 small touch targets (10 distinct elements) and 253 contrast failures. All of the contrast failures were measurement errors: the era frames use gradient backgrounds, and the first version of the tool ignored them (see D13). The only motion in use was one 0.25 s animation.

### Findings

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

### Results after the fixes

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
