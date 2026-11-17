# Performance (measured)

All numbers were measured on 2026-11-15 on the development container: a shared server CPU running Node 22, and
headless Chromium for browser figures. They are **not** measurements on a real iPhone. Treat them as relative,
and re-run the commands below on target hardware.

## Headless simulation throughput

`npm run bench -- <size> <years>`; seed `bench`, default settings. The table shows the mean cost per simulated year
in each 100-year window. One year is 120 ticks.

| Years | 128² ms/year | 128² population | 256² ms/year | 256² population |
|---|---|---|---|---|
| 0–100 | 13 | 1 k | 39 | 1 k |
| 200–300 | 24 | 68 k | 88 | 43 k |
| 400–500 | 60 | 1.6 M | 110 | 1.7 M |
| 600–700 | 131 | 6.9 M | 307 | 41 M |
| 700–800 | 177 | 8.7 M | 560 | 70 M |
| 800–900 | 260 | 8.0 M | — | — |

World generation plus bootstrap takes 169 ms at 128² and 463 ms at 256². The JS heap stays between 25 and 95 MB.

**Late-game profile (128², year 850 snapshot):** late-game cost was 858 ms/year. Most of it was A* searches
for migrants: each distressed settlement searched for a fresh route every quarter. Migrants now reuse the
settlement's persisted route plans, which brought the cost to 306 ms/year on the same snapshot, 2.8× faster. The
remaining profile is flat: pathfinding about 7%, then urban planning, `forRadius` scans and migration.

## Browser frame rate

`npm run bench:browser -- phone|desktop` creates a 128² world and measures `requestAnimationFrame` over 10 s.

| Profile | Speed | FPS | Simulated years per second |
|---|---|---|---|
| iPhone 13 emulation | 1× | 60.0 | 0.2 |
| iPhone 13 emulation | Max | 60.0 | 10.2 (early game) |
| Desktop 1280×800 | 1× | 60.1 | 0.1 |
| Desktop 1280×800 | Max | 56.8 | 9.8 (early game) |

`Simulation.advance` holds simulation work to an 8 ms budget per frame, so the frame rate stays near 60 while
simulation speed degrades gracefully: late in the game, max speed delivers fewer simulated years per second.

## Known limits

- Late industrial and modern worlds on 256² cost about 0.3–0.6 s per simulated year headless. At max speed that
  means roughly 1.5–3 simulated years per real second.
- The 320² size is offered, but no benchmark has been run for it.
- No profiling has been done on physical iOS hardware.
