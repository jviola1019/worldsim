# Validation record

| | |
|---|---|
| Baseline | `5571bc8`, branch `claude/epoch-civilizations-unbound-dap8pc`, clean worktree. The baseline numbers below were measured from a separate git worktree pinned at this commit. |
| Environment | Cloud container: 4 vCPU Intel Xeon @ 2.10 GHz, 15 GB RAM, Node 22.23.4, Playwright 1.63 with Chromium only (no WebKit or Firefox installed), Linux. **Not** a phone. |
| Commands | `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`, `node tools/viewports.mjs`, `npm run bench -- <size> <years>`, `npm run stats -- <seeds> <years> <size>`. Probe scripts are listed under each section. |

## R5. Round 5 final verification (2026-11-18)

Environment: the same cloud container (4 vCPU, Linux, **not** a phone), Node 22.23.4 locally and Node 26 LTS in CI, Chromium only. Every figure below comes from a recorded run, and raw outputs are in [`docs/data/round5/`](data/round5/).

### Gate

| Check | Result |
|---|---|
| `npm run typecheck` (TypeScript 7.0.2) | exit 0 |
| `npm test` (Vitest 5.1.1) | **506 passed, 0 failed, 0 skipped** (27 files). Each fix of rounds 4–5 was mutation-checked: the test fails with the fix reverted. |
| `npm run build` (Vite 8.3.8) | exit 0. The CSP meta tag is injected, and `_headers` and the font files are in `dist/`. |
| `npm run e2e` (production build) | **28/28**: world creation, time, tools, layers, nations and flags, nation overview with city pictures, album, news feed, IndexedDB save, CSP present, no CSP violations, injected script blocked, cross-origin frame refused, font loaded, no console errors; phone and desktop |
| `node tools/viewports.mjs` | **6/6** device profiles: nothing off-screen, no touch targets under 32 px, no console errors |
| `npm audit` / `npm outdated` | 0 vulnerabilities / nothing outdated (preact 11.2.0, vite 8.3.8, vitest 5.1.1, TypeScript 7.0.2, @types/node 26.6.6, @fontsource/pixelify-sans 5.3.0) |
| Security | 92-threat matrix, 4 confirmed weaknesses fixed, 32 security regression tests in `tests/security/` (9 mutations caught) plus 29 round-2 persistence tests ([SECURITY.md](SECURITY.md)) |

### GitHub Actions audit (standing to-do)

The last 10 runs of `ci.yml` before this round's final push were checked through the GitHub API.

- **Failure:** run #23 failed. It was the merge commit of P5, in which three trajectory-dependent tests broke. They were rebuilt as probe-selected counterfactuals in the next commits, and runs #24–#26 are green.
- **Stale steps:** the workflows used `@v4`/`@v3` action tags, Node 22 and Playwright 1.63. All actions are now pinned to commit SHAs at their latest releases, with Node 26 LTS and Playwright 1.65.1. Run #26 passed with exactly this configuration, including the browser e2e.
- **Skipped jobs:** none skipped. `long-run.yml` runs on its schedule and on manual dispatch. It has not yet been triggered on this branch; its commands were run locally (below). `pages.yml` runs only on `main`, and `main` is created at the end of this round.
- **Flaky e2e:** none observed. The e2e passed in every CI run of this round and in every local run.

### Natural history, 1,000 years, no god powers (128²)

| World | Furthest era (year) | Agricultural | Early Industrial | Atomic & Space | Food short (y1000) | Unemployed (y1000) | Warming |
|---|---|---|---|---|---|---|---|
| modern-1 | Spacefaring (973) | 182 | 538 | 727 | 0% | 31% | 7.18 °C |
| modern-2 | Spacefaring (988) | 165 | 552 | 714 | 0% | 15% | 10.27 °C |
| modern-3 | Atomic & Space (892) | 172 | 599 | 892 | 7% | 36% | 3.42 °C |
| realistic-1 | Near Future (831) | 160 | 538 | 703 | 0% | 24% | 7.22 °C |

Round 2 measured a food shortfall of 58–69% in modern worlds; the round-4 economy fixes removed it (STATUS.md, R11). Unemployment and warming remain the open items.

### Endings census (`scripts/endings-census.ts`)

| Sample | Nations founded / fallen | Endings | Catastrophes | Nuclear use | AI incidents |
|---|---|---|---|---|---|
| 10 worlds × 600 years, from prehistory (96²) | 77 / 13 | conquest 5, civil war 5, famine 2, dispersal 1 | geomagnetic storms 32, VEI-7 eruptions 8, airbursts 8, infertility pathogen 2 | 0 | 0 |
| 10 worlds × 300 years, from era 9 (96²) | 54 / 4 | conquest 4 | geomagnetic storms 17, airbursts 5, VEI-7 2, supervolcano 1 | 0 | 31 |

Rare endings (nuclear war, AI takeover, impacts, grey goo) did not occur organically in these 9,000 world-years. Their mechanics are covered by forced-scenario tests (`endings.test.ts`, `war-nuclear.test.ts`).

### Multi-seed invariants (`npm run stats -- 20 600 96`)

| Metric | Min | Median | Max |
|---|---|---|---|
| Highest era at year 600 | 6 (Renaissance) | 7 (Early Industrial) | 8 (Late Industrial) |
| First farming (year) | 153 | 175 | 195 |
| Nations alive / fallen | 5 / 0 | 7 / 2 | 10 / 9 |
| Wars | 47 | 72 | 95 |
| Religions | 11 | 16 | 28 |
| Population | 708,851 | 1,419,191 | 1,900,171 |
| ms per simulated year | 27 | 32 | 41.8 |
| Ledger / finite / GDP identity | 20/20 | 20/20 | 20/20 |

### Divergence and settling

- Over 6 seeds, developed starts produced 7 ethos types and 4–5 government forms.
- Water-first settling, over 8 seeds: 82.4% of settlements by water with the change, 81.6% without. The difference is within noise. The 2-seed claim of 90.5% vs 83.6% made earlier was withdrawn, and the test checks the outcome (> 72% over 4 seeds).

## 1. Test health

| | Baseline (`5571bc8`) | Now |
|---|---|---|
| Vitest | 62 passed, 0 failed, 0 skipped (9 files) | **124 passed, 0 failed, 0 skipped (14 files)** |
| Typecheck / build | pass / pass | pass / pass |
| E2E (iPhone 13 + desktop, Chromium) | 12/12 | 12/12 |
| Viewports (iPhone SE, iPhone 13, iPhone 13 landscape, iPhone 15 Pro Max, iPad gen 7, Galaxy S9+) | not tested | 6/6: no off-screen controls, no touch targets under 32 px, no console errors |

### New tests this round (62)

| File | Tests | Covers |
|---|---|---|
| `tests/population/ledger.test.ts` | 9 | R12.4 population conservation at every tick: cohort↔individual rounding, migration incl. arrivals without a land route, annexation, destruction, empty world, save/load mid-interval, explanation after decimation |
| `tests/economy/employment.test.ts` | 3 | Demand-driven services (counterfactual), fed developed starts, spoilage excluded from ΔInventories |
| `tests/integration/causal2.test.ts` | 7 | Integration #3, #5, #8, #10 (recovered from the original specification) |
| `tests/integration/plan-tests.test.ts` | 14 | Named plan tests (§3) |
| `tests/persistence/security.test.ts` | 29 | 22 hostile files, gzip bomb, truncation and corruption, V0 migration, newer-version refusal, unavailable storage, quota failure mid-write |

Mutation checks were run by removing the fix and confirming the test fails, then restoring it:
- Founding-profile normalization: 3 ledger tests fail without it.
- Undo hydrology: the undo test fails if either half of the fix is removed.
- Construction guard (round 1): fails without it.
- ΔInventory valuation: fails without it.
- Security tests: 23 of 28 fail against the pre-fix decoder.

## 2. Population accounting (R12.4)

**Method.** A tick-level probe compared Δ(boundary population) with the Δ(ledger) of the world and of every civ, and reported the first tick and entity where they disagreed. Script: `scratchpad/r2/ledgerprobe.ts` and `ledgerwho.ts`.

Conservation bugs found and fixed:
- New towns gained 0.7% people from nothing, because the founding age profile summed to 1.007.
- Settlers vanished when their site had been taken or their nation had died.
- Migrants vanished when their destination had disappeared.
- "Repression deaths" were recorded without removing anyone.
- Monster attacks recorded the intended deaths rather than the deaths that happened.
- Space colonies started with 500 people created from nothing.
- Cohort→individual conversion rounded each age band separately.
- Statistics sampled the stale census population.

| Residual \|unexplained\| / \|Δpop\| over 120 years (3 seeds, era 4) | Mean | Worst |
|---|---|---|
| Baseline (`scratchpad/r2/decomp.mts`) | 0–11% | 40% |
| Now | **0%** | **0%** |

**Independent checks.** An adversarial fuzzer (`scratchpad/r2/adversary/ledger_fuzz.ts`) applied random god powers during normal ticks in eras 1, 4, 7 and 10, about 8,900 ticks in total. It found **0** violations at world or civ level.

## 3. Economy and unemployment

`scratchpad/r2/econ.mts`: 3 seeds × 5 scenarios × 25 years on a 96² map. Each cell shows the median, with the range in brackets.

| Scenario | Unemployment, baseline → now | Food shortfall, baseline → now | Population growth, baseline → now |
|---|---|---|---|
| Industrial (era 7), rich | 0% → 0% | 0% → 0% | +48% → +51% |
| Industrial, poor | 0% → 0% | 0% → 0% | +37% → +56% |
| Modern (era 10), rich | 40% [22–48] → 27% [12–47] | 90% → 45% | −16% → +53% |
| Modern, poor | 40% [29–47] → 28% [0–50] | 84% → 44% | −8% → +67% |
| Future (era 12) | 56% [44–65] → 36% [28–54] | 100% → 34% | −25% → +42% |

**Root cause (diagnosed, not tuned).** In the baseline, formal district jobs covered about 2.5% of the workforce. Unemployment was then a fixed formula of welfare and automation: welfare 1.2 gave 46% informal and 51% unemployed.

The fixes:
- **Market-service jobs follow demand.** Demand rises with *goods* income only (lagged), so service jobs cannot inflate their own demand.
- **Developed starts fit their land.** Era-preset starts are sized to the land's carrying capacity and laid out with farmland. Capacity/need is about 1.0 for most nations, up from 0.13–0.68.
- **Spoilage is not investment.** Storage losses are excluded from ΔInventories; future-era GDP per capita had gone negative because of them.

**Open, with evidence.** Organic late-era worlds reach a Malthusian ceiling. In the year-800 snapshot, food production is 41% of need, with 26 births and 17 famine deaths per 1,000 per year. Services cannot grow because goods income is at subsistence. Three levers were tested and rejected as insufficient:
- Doubling yields raised food to 59% of need, but births rose to 30 per 1,000.
- Denser schools raised education from 0.25 to 0.37, but births stayed at 26 per 1,000.
- So the next step is to recalibrate the fertility transition. That is not done.

**Resource scarcity.** "Rich" and "poor" scenarios differ little over 25 years, because developed starts are pre-stocked with materials. Metal access does differ: 1.00 versus 0.00 in modern starts.

## 4. Counterfactual integration scenarios

Each scenario uses identical clones, asserts identical digests before the intervention, and applies a single intervention.

| # | Scenario | Result |
|---|---|---|
| 1 | Drought → food output ↓, food price ↑ | holds |
| 2 | Roads → land path cost ↓ (< 0.7×) | holds |
| 3 | Education investment versus none, 3 literate worlds | Schooling ↑ in at least 2 of 3 worlds and research rate ↑ in at least 2 of 3. Tech score shows **no measurable effect within 30 years** (−0.6%, within noise). |
| 4 | War versus peace between neighbouring kingdoms → battles or war deaths, population not higher | holds |
| 5 | Electric power (with its prerequisites) → power plants and energy use the twin lacks | holds |
| 6 | Legitimacy collapse → political change | holds |
| 7 | Industrial start → more pollution | holds |
| 8 | Embargo on the importer's main dependency (more than 50% of supply) → flow cut, importer scarcer; lifting it restores trade | holds |
| 9 | Religion crosses borders | holds |
| 10 | Prerequisites always known (3 seeds, eras 1/4/9); speculative technology locked; diffusion requires contact (mechanism test with a contacted control) | holds |

## 5. Determinism and saves

- **Same seed, same digest:** the existing tests pass.
- **Mid-month save/load:**
  - Identical digests for 20 years after saves in eras 4, 10 and 12 at odd tick offsets (`scratchpad/r2/detcheck.ts`).
  - Identical for 40 years in eras 1 and 9 (`tests/persistence/roundtrip.test.ts`).
- **The strict decoder accepts every valid save:** 43 of 43 accepted with identical digests. These cover every preset at years 0 and 30, eras 1–14 after applying every god power, and a 460-year world with decimated statistics (`scratchpad/r2/falsepos.ts`).

## 6. Long-run statistics

**Setup.** `npm run stats -- 20 600 96` with seeds `ms-0`…`ms-19`. None of these seeds was used for tuning this round; tuning used the `econ-*`, `fed-*` and `int-*` seeds and snapshots. They therefore serve as a holdout sample. The baseline column is 8 seeds of the same script at `5571bc8`.

Every seed checks three invariants:
- `ledgerOk`: world population reconciles with its ledger from year 0.
- `finiteOk`: no NaN or Infinity, and no negative stock.
- `gdpOk`: the GDP identity holds.

| Metric (year 600, 96²) | Baseline `5571bc8`, 8 seeds (min / median / max) | Now, 20 holdout seeds (min / median / max) |
|---|---|---|
| Highest era index | 5 / 7 / 7 | 5 / 5 / 7 |
| Year farming appears | 145 / 176 / 204 | 144 / 167 / 189 |
| Nations alive | 5 / 8 / 11 | 5 / 7 / 10 |
| Nations fallen | 1 / 3 / 8 | 0 / 2 / 7 |
| Wars | 60 / 81 / 104 | 37 / 75 / 121 |
| Annexations | 2 / 6 / 16 | 0 / 4 / 14 |
| Religions | 12 / 19 / 29 | 6 / 16 / 30 |
| Population | 0.72M / 1.17M / 1.86M | 0.61M / 0.99M / 1.83M |
| ms per simulated year | 25.9 / 29.2 / 34.5 | 20.3 / 24.9 / 43 |
| Invariants (ledger, finite and non-negative, GDP identity) | not measured | **20/20 seeds pass all three** |

Highest era reached by year 600: era 5 in 15 seeds, era 7 in 5 seeds. Median annexations are well below median wars, so most wars end without total conquest (the plan's `notAlwaysTotalConquest` criterion).

A run before the public-debt fix had 12 of 20 seeds passing. All 8 failures came from debt compounding to Infinity; see STATUS bug #4.

## 6b. Modernization: natural history with no god powers

**Method.** `npx tsx scripts/modernization.ts <seed> 1000 128 [realistic]` runs 1,000 years on a 128² map with **0 interventions**. It records the year the leading nation first reached each era, its modernization indicators every 100 years, and every natural hazard.

**First verification run (before the fixes).** Two of four worlds (`modern-1`, `modern-3`) **stayed in the Medieval era for about 600 years**: literacy plateaued at 0.26 and industry at 3%. Two root causes were diagnosed:

1. **Ecological collapse.** Foragers took 12% of a herd every month however scarce it was. Every domesticable species was extinct by about year 300, so `domestication` (which needs nearby domesticable herds) became impossible. Fix: a type-III hunting response, where scarce prey is hard to find. Regression test: `tests/ecology/refugia.test.ts`, which fails without the fix (0 animals left).
2. **A hard dead end in the tech tree.** 146 of 207 technologies depended on `domestication` through `heavy_plow`. Two historically wrong edges were removed:
   - watermills no longer require the heavy plow;
   - chemical fertilizer now requires scientific method plus electric power, not the seed drill.

   Without domesticable animals, only 9 animal-based technologies stay locked. Structural regression test in `tests/technology/techData.test.ts`.

**Final runs (current code, 0 interventions).** Each cell is the first year the leading nation reached that era.

| World | Agricultural | Medieval | Early Industrial | Early Modern | Atomic & Space | Further |
|---|---|---|---|---|---|---|
| `modern-1` | 180 | 420 | 549 | 669 | 792 | — |
| `modern-2` | 186 | 413 | 517 | 701 | 859 | — |
| `modern-3` (previously stuck) | 151 | 405 | 529 | 761 | 886 | — |
| `realistic-1` (Realistic preset) | 173 | 394 | 507 | 613 | 650 | Digital 720, Near Future 849 |

**Modernization indicators of the leading nation.** These move in the expected direction:
- urban share: 0% → 99–100%;
- literacy: 0 → 0.81–0.91;
- life-expectancy index: 0.33 → 0.74–0.85;
- agricultural employment: about 50% → 0–2%.

**Natural hazards over 1,000 years, with no intervention:**
- 30–41 logged disasters (earthquakes, storms, one volcanic eruption), causing 168k–358k deaths;
- 128–260 deadly epidemics;
- 2.9k–5.5k drought cell-years;
- emergent warming of 5.2–7.1 °C, with up to 65 sea-level events.

**Verified limitation (open).** Modern nations are dysfunctional economically:
- **Food:** a chronic shortfall of 58–69% from the Industrial era on (the Malthusian ceiling, §3).
- **Metals:** iron and copper access falls to 0 as deposits deplete. Electric power then decays by design ("lost access to required materials"), and almost no factories or power plants are ever built.
- **Result:** in the Atomic era and later, industry is at 0–2% of jobs, unemployment 46–66%, and GDP per person about 0.5–0.65, against about 1.5 in the Renaissance.

Next steps (STATUS): recalibrate the fertility transition and the metal economy (recycling and substitution, deep deposits, imports).

## 7. Performance

See [PERFORMANCE.md](PERFORMANCE.md).

## 8. Browser and device coverage

| Environment | Status |
|---|---|
| Chromium desktop and Chromium device emulation (6 profiles) | Tested (e2e and viewports) |
| WebKit / Safari, Firefox | **Not tested.** These engines are not installed in this environment, and installing browsers was out of scope. |
| Physical iPhone Safari | **Not tested.** Protocol: build, run `npm run preview:lan`, open the LAN URL on the iPhone, create a Primitive Earth world, run at max speed for 5 minutes, then check pan, pinch, tap-to-inspect, brush painting, the trait editor, the past-borders slider, save and reload, and backgrounding and return. Use Safari Web Inspector for FPS and memory. |

## 9. Unresolved risks (updated round 5)

1. Modern unemployment of 15–36% and warming of 3–10 °C (§R5).
2. No WebKit testing and no physical-device testing.
3. Late-game cost on 256² maps is about 0.4–0.5 s per simulated year (round-2 measurement; see PERFORMANCE.md for the round-5 rerun).
4. GitHub Pages cannot send security headers (SECURITY.md §5).
5. Favorites and the follow camera are not implemented.

The Malthusian ceiling and the dev-dependency advisories of round 2 are resolved.
