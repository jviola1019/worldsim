# Methods: how EPOCH's numbers are produced

This document is the measurement contract behind every figure in [VALIDATION.md](VALIDATION.md), [STATUS.md](STATUS.md) and the README.
- Every claim names its data and the command that reproduces it.
- Every model coefficient is listed with its evidence class in [PARAMETERS.md](PARAMETERS.md).
- Uncertainty is stated, not hidden.

EPOCH is a **stylized simulation, not a forecasting model**. Its experiments establish two things: that mechanisms behave as designed, and that aggregate behaviour stays plausible and stable as the code changes. **None of its outputs are predictions about the real world.**

## 1. Reproducibility contract

| Guarantee | Mechanism | Enforced by |
|---|---|---|
| **Same seed and settings, same history** | Only `sim.rng` (a seeded PRNG whose state is saved) may influence history. Rendering uses a stateless hash (`hash3`); `Math.random` is confined to cosmetic UI code. | `tests/sim/determinism*.test.ts`; static guard in `tests/security/hardening.test.ts` |
| **A loaded save continues the identical history** | The full state, including the RNG state, is serialized (`persistence/serialize.ts`) | Save/reload round-trip tests (e.g. `tests/sim/pace.test.ts`) |
| **Standard settings are unchanged by optional features** | Optional levers are applied as `x * 1` on the standard path, with no extra random draws (e.g. `paceMult` returns exactly 1) | `pace.test.ts` (standard = 1); byte-identical balance-run diffs when a change claims to be neutral |
| **Invariants hold every year** | The population ledger balances (births − deaths ± migration); every state value is finite; GDP = C + I + G + NX | `scripts/multi-seed.ts` (fields `ledgerOk`, `finiteOk`, `gdpOk`); unit tests |

**Provenance:** each round's raw outputs live in `docs/data/roundN/`, written by the scripts below at the commit recorded in that round's VALIDATION section. The session ledger records the exact commit of each measurement batch.

## 2. Experiment designs

### 2.1 Twin-world counterfactuals (mechanism tests)
1. Build one world and run it to a state of interest.
2. Clone it through the save format (an exact copy, RNG included).
3. Change **one** thing in one copy, a lever or an input, and run both copies the same way.
4. The outcome difference is attributable to that one change.

Random side channels that are not under test are switched off in both arms (example: serendipity in the knowledge-diffusion control, `tests/integration/causal2.test.ts`). These tests assert a **direction or a bound**, never an exact magnitude.

### 2.2 Long-run balance comparison (regression across rounds)
- **Command:** `npx tsx scripts/modernization.ts <seed> 1000 128 [preset]` for four natural histories: `modern-1..3` (default preset) and `realistic-1`, which runs the Observer preset (the old hands-off "Realistic") so rounds stay comparable.
- **Comparison:** `node tools/balance-compare.mjs docs/data/<prev> final- docs/data/<this> final-`.
- **Measures, per world:**
  - era-milestone years;
  - mean unemployment, years 700–1,000;
  - food shortfall at year 1,000;
  - warming at year 1,000;
  - world population (from the file header).
- **Decision rule:**
  - A milestone shift within **±15%** is treated as trajectory noise.
  - Larger shifts, or any food shortage or collapse, must be explained from the run's own records (warming, disasters, wars) before acceptance.
  - Re-tuning happens only if the outcome is unrealistic. This rule was set by the owner in round 10.

### 2.3 Multi-seed invariants (breadth)
`npx tsx scripts/multi-seed.ts 20 600 96`: 20 seeds, 600 years each, on a 96² map. It reports the min, median and max of era, nations alive and fallen, wars, religions, population and speed, plus the three invariant flags. **Pass: 20/20 on every flag.**

### 2.4 Calibration (targets for [C] parameters)
1. State a target, e.g. Slow pace: a first village after **~100 years** (every seed within 40–250) and a first city of 10,000 after **~1,000 years** (600–1,600), with no band dying out before year 300.
2. Run a fixed set of seeds (`scripts/pace-calibrate.ts`, seeds `pace-a..e`) at each candidate value.
3. Adjust one lever at a time. Each run and its outcome are recorded in the round ledger, and the final table in VALIDATION.

A calibrated value is fitted to **the simulation's own behaviour**, not to real-world data.

### 2.5 Promise audits (product claims)
`scripts/mode-audit.ts` turns each game mode's description and objectives into measurable promises and runs **3 worlds per mode** to its horizon. A failure triggers root-cause analysis (instrumented probes, recorded in the ledger) before any fix. `tests/modes/promises.test.ts` keeps the start-of-world promises under test.

### 2.6 Interface measurements
- **Accessibility:** `npm run a11y`. axe-core with the WCAG 2.2 A/AA rules runs on the settled page, after entrance animations finish, in Chromium and WebKit. It adds scripted checks of keyboard focus, Escape, reflow at 320 px and text spacing. The colour tokens are verified arithmetically by `tests/ui/mediumTheme.test.ts`.
- **Design floors:** `tools/viewports.mjs` and `tools/design-capture.mjs` check text size, touch targets and contrast.

## 3. Statistical limits (read before quoting a number)

- **Small samples.** Balance comparisons use 4 worlds; audits use 3 per mode; the multi-seed check uses 20. They detect gross changes and broken mechanisms, not small effects. **No significance tests are run and no p-values are claimed.** "2/3" means two of three audited worlds, not a 67% probability.
- **Chaotic trajectories.** A one-line change can send a world down a different history; the same seed is not a matched sample across code versions. Compare distributions (medians and ranges across seeds), not single worlds. Explain outliers from their own records (example: modern-2's −25% population in round 10, traced to a hotter history).
- **Stylized magnitudes.** Most coefficients are [S] (stylized; 87 of 108 in round 10). Absolute levels, such as 10% unemployment or 6.5 °C of warming, describe the model, not the world.
- **Timing is approximate.** `msPerYear` figures come from a shared 4-vCPU cloud container that often runs other simulations at the same time. Compare timings only within one batch. Browser timing is measured separately in [PERFORMANCE.md](PERFORMANCE.md).
- **Emulation is not devices.** Browser tests use Playwright emulation of an iPhone 13 and desktop in Chromium and WebKit. No physical phone, tablet or screen reader has been used.

## 4. Known modelling gaps (stated so they are not mistaken for results)

| Area | What is modelled | What is not |
|---|---|---|
| Wildlife | Predator–prey dynamics (Lotka–Volterra style); people hunt animals | Wild animals attacking people (worldwide this is small next to disease, famine and war) |
| "Monsters" | Fantasy creatures and god-only horrors, only where fantasy or god mode allows | Real-world equivalents are modelled as other systems: dangerous wildlife (above), rogue AI (the "AI takeover" ending), nuclear war (blast, fallout, radiation sickness, nuclear winter). **Mutants are not modelled**: radiation causes illness, not new creatures |
| Climate | CO₂, lagged warming, sea level, a finite feedback store, policy response | Grid storage; efficiency-driven demand reduction; carbon removal |
| Economy | Physical goods, labour, prices, GDP identity, automation, public jobs | Finance and credit cycles beyond debt and inflation |

## 5. How to reproduce a round

1. Check out the commit named in that round's VALIDATION section.
2. Run:
   ```bash
   npm ci
   npx tsx scripts/modernization.ts modern-1 1000 128        # repeat for modern-2, modern-3
   npx tsx scripts/modernization.ts realistic-1 1000 128 realistic
   npx tsx scripts/multi-seed.ts 20 600 96
   npx tsx scripts/pace-calibrate.ts 1600 slow
   npx tsx scripts/mode-audit.ts all 3
   node tools/balance-compare.mjs docs/data/<prev> final- <your output dir> final-
   ```
3. Outputs should match `docs/data/roundN/` byte for byte, apart from the wall-clock seconds on each file's first line.
