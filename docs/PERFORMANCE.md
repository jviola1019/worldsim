# Performance (measured)

**Environment:** 4 vCPU Intel Xeon @ 2.10 GHz, 15 GB RAM, Node 22.23.4, headless Chromium. This is **not a phone**. Treat the numbers as relative and re-run them on target hardware. Measured 2026-11-18. Baseline = commit `5571bc8`, run from a pinned git worktree; current = round 2.

## 1. Equivalent-workload comparison (same saved state, both codebases)

Both codebases load the same 256² world at year 700 (era 12, about 40M people) and simulate 4 years, timing each year. This was repeated 3 times per side. Script: `scratchpad/r2/perfcmp.mts`.

| Code | Median ms per simulated year (3 runs) | First year (includes JIT warm-up) | Worst single tick | Heap |
|---|---|---|---|---|
| Baseline | 456, 463, 419 | 586–695 | 41–44 ms | 49–59 MB |
| Current | 381, 392, 452 | 580–607 | 40–52 ms | 45–50 MB |

The median is about **9% faster**, but the ranges overlap, so this is a modest gain.

**Profile before:**
- `planConstruction`: 23.7% inclusive. Each plan scanned the town's surroundings 5 or more times, and 42% of plans had nothing affordable.
- `forRadius` scans: 16.3%.
- Army re-pathing: 6.7%.

**Changes:**
1. A tick-memoized list of each settlement's own tiles, in raster order. This preserves behavior: the same digests on 3 seeds and on this snapshot.
2. A 2-month cooldown after a planning pass that finds nothing to build.
3. Armies already marching to the chosen target keep their path.

On the snapshot's 3-year average (`scratchpad/r2/digests.ts`), these took the cost from 659 to 580 ms after change 1, and to 530 ms after changes 2 and 3.

## 2. Full runs (not equivalent workloads: the fixed model grows larger populations)

`npm run bench -- 128 900` and `npm run bench -- 256 800`, seed `bench`. Each cell is the mean ms per simulated year in that window, with the population at its end in brackets.

| Years | 128² baseline | 128² current | 256² baseline | 256² current |
|---|---|---|---|---|
| 0–100 | 16.4 (1k) | 16.6 (1k) | 42.3 (1k) | 44.7 (1k) |
| 300–400 | 42.3 (474k) | 38.9 (534k) | 102.1 (408k) | 110.6 (361k) |
| 500–600 | 93.2 (3.1M) | 81.0 (5.0M) | 169.7 (6.8M) | 163.1 (11.2M) |
| 600–700 | 127.6 (7.1M) | 103.0 (10.0M) | 337.5 (33M) | 292.9 (48M) |
| 700–800 | 179.0 (10.3M) | 118.3 (13.0M) | 514.0 (72M, era 13) | 483.0 (84M, era 14) |
| 800–900 | 206.0 (10.6M) | 124.8 (11.8M) | — | — |

Worldgen plus bootstrap took 159–165 ms on 128² and 362–414 ms on 256². The heap stayed between 22 and 152 MB. Heap growth is not monotonic, and garbage collection reclaims it.

**Regression noted:** early 256² years (300–500) are 8–11% slower in the current run. This is the population ledger bookkeeping plus a different world trajectory. It is small in absolute terms (under 20 ms per year).

## 2b. Round 5 rerun (128², 900 years)

`npm run bench -- 128 900`, seed `bench`, after the round 4–5 systems: media and AI, ethos, missions, sports, visitors, album, catastrophes, risks, nuclear, overtaking. Raw output: [`data/round5/bench-128x900.txt`](data/round5/bench-128x900.txt). This is **not an equivalent workload**: the world takes a different trajectory and grows a smaller population.

| Years | Round 2 (current column above) | Round 5 |
|---|---|---|
| 0–100 | 16.6 (1k) | 20.8 (1k) |
| 300–400 | 38.9 (534k) | 44.9 (592k) |
| 500–600 | 81.0 (5.0M) | 104.1 (2.8M) |
| 600–700 | 103.0 (10.0M) | 113.9 (3.9M) |
| 700–800 | 118.3 (13.0M) | 126.3 (5.6M) |
| 800–900 | 124.8 (11.8M) | 150.6 (6.0M) |

Worldgen plus bootstrap took 196 ms, and the heap stayed between 23 and 66 MB. **The cost per simulated year rose by roughly 10–30%** in every window, at lower populations. The new yearly systems add work in every window, the most in the modern and future eras. At 150 ms per year the simulation can run at most about 6–7 simulated years per second in the late game on this machine. It has not been measured on a phone. The 20-seed run measured a median of 32 ms per year on 96² (VALIDATION §R5).

## 3. Browser

`npm run bench:browser -- phone|desktop` measured `requestAnimationFrame` over 10 s on a fresh 128² world.

| Profile | Speed | FPS | Simulated years per second |
|---|---|---|---|
| iPhone 13 emulation | 1× | 60.0 | 0.2 |
| iPhone 13 emulation | Max | 60.0 | 10.2 (early game) |
| Desktop 1280×800 | 1× | 60.1 | 0.1 |
| Desktop 1280×800 | Max | 56.8 | 9.8 (early game) |

These figures are from round 1. In round 2, the 6-profile layout check and the e2e test ran with no console errors, but the frame-rate benchmark was not re-measured. `Simulation.advance` caps simulation work at an 8 ms budget per frame, so the frame rate stays near 60 and max speed delivers fewer simulated years per second in late eras.

## Known limits

- **Late game on 256²:** about 0.4–0.5 s per simulated year headless, which means about 2 simulated years per real second at max speed.
- **320² maps:** offered but not benchmarked.
- **Physical iOS hardware:** not profiled; **unverified**.
