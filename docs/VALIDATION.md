# Validation record (round 2)

| | |
|---|---|
| Baseline | `5571bc8`, branch `claude/epoch-civilizations-unbound-dap8pc`, clean worktree. The baseline numbers below were measured from a separate git worktree pinned at this commit. |
| Environment | Cloud container: 4 vCPU Intel Xeon @ 2.10 GHz, 15 GB RAM, Node 22.23.4, Playwright 1.63 with Chromium only (no WebKit or Firefox installed), Linux. **Not** a phone. |
| Commands | `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`, `node tools/viewports.mjs`, `npm run bench -- <size> <years>`, `npm run stats -- <seeds> <years> <size>`. Probe scripts are listed under each section. |

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

SEE_TABLE

## 7. Performance

See [PERFORMANCE.md](PERFORMANCE.md).

## 8. Browser and device coverage

| Environment | Status |
|---|---|
| Chromium desktop and Chromium device emulation (6 profiles) | Tested (e2e and viewports) |
| WebKit / Safari, Firefox | **Not tested.** These engines are not installed in this environment, and installing browsers was out of scope. |
| Physical iPhone Safari | **Not tested.** Protocol: build, run `npm run preview:lan`, open the LAN URL on the iPhone, create a Primitive Earth world, run at max speed for 5 minutes, then check pan, pinch, tap-to-inspect, brush painting, the trait editor, the past-borders slider, save and reload, and backgrounding and return. Use Safari Web Inspector for FPS and memory. |

## 9. Unresolved risks

1. Late eras sit at a Malthusian ceiling (§3), which needs the fertility-transition recalibration.
2. No WebKit testing and no physical-device testing.
3. Late-game cost on 256² maps is about 0.4–0.5 s per simulated year.
4. Dev-dependency advisories (see [SECURITY.md](SECURITY.md)).
5. Favorites and the follow camera are not implemented.
