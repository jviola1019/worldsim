# City life, jobs, housing, roads, renovation and WorldBox-style caching: design

Status: builder's design · 2026-11-19 · branch `claude/epoch-civilizations-unbound-dap8pc`. It extends the approved animations design (`2026-11-19-animations-design.md`). Both are built in round 7.

## 1. What the owner asked for (2026-11-19)

> "should be visual detail; however, cities should simulate streets and parks at a regulated rate similar to real world traffic and concepts. Types of "jobs" people are doing should be tracked and shown but no costume, benefits or other concepts than what job they are and how it will change as implementations and concepts turn. Housing should have different sizes and concepts once past regular huts and caves. Modern and futuristic highways, streets and roadpaths should be optimized. Buildings can be renovated or moved/built up. Verify all and run qualified master audit guantlet loop at end."
>
> "Do similar caching to WorldBox."

The owner also said "ask questions if needed". The session resumed after a context reset with an instruction to continue without asking, so the builder made the open calls below (§7) and recorded them for review.

## 2. Principles

- **Visual detail, regulated by real-world rates.** Streets, parks and traffic stay in the drawing layer: no new land use, nothing saved, no `sim.rng`. The amounts they show are not arbitrary. They follow published urban rates scaled by era, and are derived from simulation state (population, district type, era, road tier, vehicle era).
- **Jobs are tracked, not invented.** Named occupations are a breakdown of the employment the economy already computes (`s.employment`, 7 sectors), split by what the place has (buildings) and what the nation knows (capabilities). A job is only a name and a count. There are no wages, perks or costumes.
- **Small, real simulation changes only where the request needs them:**
  - roads reuse existing roads;
  - new towns no longer start as huts in the modern age;
  - districts more than two eras out of date get renovated.

  Each change gets a balance check against round 6.
- **Determinism unchanged.** Same seed, same history. Derived values are recomputed from saved state. Save and digest tests still pass.

## 3. Streets, parks and traffic at real-world rates

Reference rates (approximate public urban-planning figures, used as targets, not data claims):

| Era band (tier) | Street share of a block | Park share of urban land | Vehicles per 1,000 people |
|---|---|---|---|
| 0–2 (prehistoric to classical) | ~10% (lanes) | 0–2% (shared ground) | 0 (people and animals) |
| 3–4 (medieval, early modern) | ~15% | ~3% | ~20 (carts and carriages) |
| 5 (industrial) | ~22% | ~6% | ~80 (trams, early cars) |
| 6 (modern) | ~28% | ~9% | ~450 (cars) |
| 7 (future) | ~25% (transit and narrower lanes) | ~14% | ~250 (shared autonomous vehicles) |

- **Streets.**
  - `composeBlock` sizes its streets so the street area of a block between built neighbours lands within ±5 points of the band's share.
  - Its arterials follow the tile's simulated road tier: a tile carrying a tier-3 or higher road gets a wider arterial with lane marks (closes the round-6 deferred minor "road tier unused when composing blocks").
  - A unit test measures street share per band.
- **Parks (simulated and drawn).**
  - **Simulation.** The planner's park target is the larger of the round-6 rule (one park per 8 home districts) and the era's park share of all the city's districts. Dense modern cities have few, very large home districts, so the round-6 rule left them with no parks.
  - **Zoning.** A city below its share sets aside one district in every 1/share it develops as a park, ahead of other needs, as zoning rules do. The park goes on open land if there is any, else on a brownfield (an era-obsolete district), else on the oldest huts or houses.
  - **Drawing.** Residential blocks give pocket parks only to cover what the park districts leave short of the target.
  - **Test.** A test measures the city-wide green share over the blocks of a real grown modern city.
- **Traffic** (`src/economy/traffic.ts`, derived, never saved):
  - **Demand.** Vehicle trips are computed from population × vehicles per 1,000 × daily trip rate.
  - **Capacity.** Road capacity is computed from the settlement's street lane-km (district count × street share × lanes by tier) plus the road tier on its tiles.
  - **Outputs.** `trafficLoad = trips / capacity` gives a level: free-flowing, busy, congested or gridlocked.
  - **Where it shows.**
    - The renderer's street vehicles are drawn at the density the load implies, replacing the fixed rate.
    - The settlement inspector shows the level and the vehicle mix by era (carts, trams, cars, autonomous pods).
  - Traffic changes nothing in the simulation (owner: visual detail).

## 4. Jobs (occupations)

- `src/economy/occupations.ts`, pure: `occupations(s, civ)` returns `[{ key, label, sector, count }]`.
- **How each sector splits.**

  | Sector | Occupations |
  |---|---|
  | Food | foragers, hunters, farmers, herders, fishers, farmhands, agronomists, vertical-farm techs |
  | Resources | woodcutters, quarry workers, miners, oil and gas workers |
  | Industry | artisans, smiths, millers, factory workers, steelworkers, chip technicians, robot technicians |
  | Construction | builders |
  | Services | traders and shopkeepers, priests, teachers, scholars and researchers, healers and doctors, clerks, bankers, programmers, AI supervisors, entertainers |
  | Military | warriors or soldiers |
  | Unemployed | job seekers |

  The split is weighted by the settlement's buildings (fisheries, mines, temples, schools, hospitals, banks, offices, data centers, factories, chip fabs, robot factories) and the nation's capabilities (farming, mechanization, industry, computing, ai, robotics).
- **Counts.** Counts add up exactly to the sector totals: the largest-remainder rounding preserves the sum.
- **How jobs change with technology.** The same people are named differently as concepts turn. Farming turns foragers into farmers. Mechanization shrinks farm work (already simulated), and the split moves farmhands to agronomists. Computing creates programmers. AI creates AI supervisors and takes clerks.
- **History.** Yearly civ statistics gain one series per occupation group: `job_<key>`, the share of workers. They use the existing series store, so they are decimated and saved like every other series.
- **Shown in:**
  - the settlement inspector: a jobs list with counts and shares;
  - the nation tab: a "Jobs over time" chart drawn from those series.

## 5. Housing variety past huts and caves

- **Simulation fix.** A new settlement's first district is the best early dwelling its era allows: huts until tier 1, houses from tier 2. Round 6 always started with huts, so a modern new town drew a hut block.
- **Visual mix.**
  - Every residential block past huts draws a mix of dwelling forms, chosen from the district type, the settlement's wealth (living standard), its inequality and the owner's ethos, plus the tile hash. Lot sizes and sprites follow the form.

    | Era band | Dwelling forms |
    |---|---|
    | classical, medieval | cottages, longhouses, courtyard houses, villas |
    | early modern, industrial | terraces, tenements, manors |
    | modern | detached houses, duplexes, mid-rise flats, high-rises, mansions |
    | future | eco-pods, terraced towers, sky villas |

  - Big plots go to villas, manors and mansions (more of them where inequality is high), small plots to cottages and pods.
  - The housing stock in the simulation is unchanged; the forms are how those homes look and are reported.
- **Inspector.** "Homes" lists the dwelling forms and their shares for the settlement.

## 6. Roads, renovation, relocation

- **Road network optimization** (simulation):
  - Route search between linked settlements discounts tiles that already carry a road. Networks then share trunk lines instead of laying parallel roads, so the same budget upgrades more of a shared road.
  - Cached routes are re-planned when they cross tiles that are no longer passable.
  - A test counts road tiles per connected settlement pair: fewer than before for the same links.
- **Highways and future roads** (drawing):
  - Tier-3 roads draw as two-lane highways with a centre line.
  - Tier-4 roads draw as divided highways (two carriageways and a median) with interchanges where they meet city districts.
  - Future-era nations draw tier-4 roads as guided transit lanes (light rails on a pale deck).
  - Both the 8-px map sprites and the close-up arterials follow the tier.
- **Renovation** (simulation): a residential district at least 2 era tiers behind its nation gets a "renovate" project. The type stays the same, the tier is brought up to date, and the cost and labour are about 40%, like farm upgrades. This only happens while housing is not under pressure.
- **Build-up and relocation** already happen in the simulation: in-place densification and redevelopment of obsolete sites. They become visible:
  - upgrade projects show scaffolding on the block;
  - each settlement keeps counters, since its founding, of districts built, built up (denser homes), renovated, and redeveloped for a new use (the old use is rebuilt elsewhere if it is still needed: this is how a district "moves"), shown in the inspector;
  - these counters are small saved integers, so saves keep them.

## 7. WorldBox-style caching

WorldBox keeps the world as one pixel texture and rewrites only the pixels of tiles that changed. Overlays (kingdom borders, zones) are cached per zone and redrawn only for zones whose owners changed. Static layers are never rebuilt wholesale. EPOCH adopts the same model:

1. **Overview pixel map (far zoom).**
   - `updateOverview` rewrites only the dirty 16×16 chunks: one `putImageData` dirty rectangle each. Round 6 rebuilt all w×h pixels whenever anything changed.
   - Pixel colours come from a pure `overviewPixel(map, i, out)`.
2. **Overlay zones.**
   - The 4-px overlay is redrawn per chunk.
   - `markOverlay` also marks the neighbouring chunk when the tile is on a chunk edge, so border lines on both sides stay right.
   - Static modes (nations, religion, culture, language, resources, infrastructure, past borders) redraw only dirty chunks.
   - Live modes (population, economy, technology, military, diplomacy, pollution, climate) refresh in a rolling sweep of chunks per pass, so a full refresh is spread over time instead of happening in one frame.
   - Mode changes redraw everything once.
3. **Equivalence.** Unit tests (no DOM) apply random tile changes, then compare the incremental pixels against a full rebuild: they must match byte for byte, including border pixels at chunk edges.
4. Round 6 already caches map chunks, close-up blocks (LRU, nearest first) and tinted sprites. These are unchanged.

## 8. Verification ("qualified master audit gauntlet loop")

The loop repeats until a full pass finds nothing to fix. Each pass is recorded in `docs/VALIDATION.md` §R7.

1. tsc, the full Vitest suite, the build, e2e (Chromium), the viewport floors and the design capture (text ≥ 12 px, targets ≥ 44 px, contrast).
2. New unit tests:
   - occupations sum to sectors and change with capabilities;
   - street and park shares match the bands;
   - traffic levels are monotonic in demand and capacity;
   - the road network shares trunk roads;
   - renovation;
   - first-district fix;
   - overview and overlay incremental pixels equal a full rebuild;
   - all tests from the animations design.
3. A balance check against round 6: 3 seeds × 300 years with milestones, unemployment and population. Any change beyond ±15% is explained or fixed.
4. Determinism and save round-trip, with the new counters included.
5. Performance: a frame-time comparison before and after the incremental overview and overlay. The report gives measured numbers only.
6. A final whole-branch review, with fixes.
7. The standing to-dos: GitHub Actions runs, `npm outdated` and `npm audit` with upgrades, Actions versions, and SECURITY and STATUS updated.

## 9. Builder's calls (for owner review)

- Streets, parks and traffic are visual and derived (the owner's "should be visual detail"). Traffic does not slow trade or growth.
- Occupations are a named split of the existing sector employment, so no new labour simulation. Their history is stored as civ series.
- Housing variety is a visual and reporting mix over the unchanged housing stock. The only housing change in the simulation is the first-district fix.
- Four simulation changes, each balance-checked: road reuse, renovation projects, the first district, and the park target with zoning.
- The rate table in §3 gives rough targets from general planning figures, not measured data.
