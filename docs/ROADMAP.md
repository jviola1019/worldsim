# Roadmap: round 5 (agreed scope)

This document records the requested scope and the decisions the owner made. Phases run in order. Each phase is tested, documented and pushed before the next one starts. Status is kept current here and in [STATUS.md](STATUS.md).

## Decisions

| Topic | Decision |
|---|---|
| Branching | Create `main` from the finished work. CI runs on both branches, and Pages deploys from `main`. The owner then sets `main` as the default branch and enables Pages. |
| Phasing | Phases, with a commit after each. |
| City photos | Generated live in the nation overview, opened by tapping a nation: an aerial view and a street-level postcard. The overview also shows the flag and key statistics (age, people, and more), with drill-down subsections. An album subsection keeps a postcard snapshot every 50 years. |
| Album storage | Compact layout records, a few KB per city per snapshot, redrawn exactly from the stored data. |
| Endings in Realistic mode | Every ending that is humanly possible: nuclear war and nuclear winter, AI takeover, pandemics (natural and engineered), climate runaway, asteroid, supervolcano, demographic collapse and others. The rarest are genuinely rare. God mode adds fictional threats such as a zombie apocalypse and ghouls. |
| Sports | Simulated, with effects: era-appropriate sports, generated leagues and teams, seasons, cups, Olympics with host bids, and stadium, arena and ballpark sprites. Prestige, tourism and relations are affected, and boycotts follow wars. |
| Map presets | All four families: shapes, extreme terrain, structured chaos and Earth-like variety. |
| Missions | Emergent from conditions and leaders, also assignable in god mode, plus a nation **ethos**. A society's values change how it works, for example a 1940s-style atomic-age retro-futurism versus a present-day society. |

## Phases

| # | Phase | Contents | Status |
|---|---|---|---|
| P1 | Era-medium feed | Posts derived from recorded events and state, authored by generated people, outlets, platforms and AIs. Rendered as carvings, tablets, scrolls, broadsheets, newspapers, broadcasts, social posts or holograms. World feed panel plus a Feed tab per nation. Replaces the ticker. | In progress |
| P2 | Civilization depth | Ethos archetypes, including retro-futurist lock-in, technocracy, theocracy, militarism, mercantile, ecological and isolationist societies. Emergent and assignable missions. Realistic pacing and divergence across seeds. Water-first settlement. | Planned |
| P3 | Map presets | Circle, square, donut and crescent. Highlands, arid, waterworld and frozen. Shards, spiral, mirrored and checkerboard. Pangaea, twin continents, many continents and rift. Each has tests for land fraction, shape and playability. | Planned |
| P4 | World life | Sports leagues, cups and Olympics. Harbours and airports with trade and visitor (tourism) agreements. Transport by era: horses and buggies, trains, cars and buses, aircraft, hovercars and hoverboards. | Planned |
| P5 | War and endings | Era weapons, including differing concepts (chemical, drones, cyber, orbital, EMP). Nuclear arsenals, doctrine, deterrence, launches, fallout and nuclear winter. Technological overtaking (leapfrogging). Every realistic ending, with calibrated rarity and recorded causes. God-mode-only threats. | Planned |
| P6 | Visuals | Sprites for stadiums, ports, airports, housing variety, jobs and characters, and era vehicles. City photos (aerial and postcard) in the nation overview, with the flag, statistics and drill-downs. The 50-year album. | Planned |
| P7 | Professional docs and release | Architecture with an ERD and data dictionary, security review, README with new screenshots, package upgrades, CI green, a `main` branch and the Pages deployment. Then the standing to-dos in CLAUDE.md: audit the GitHub tests and the newest packages. | Planned |

## Verification standard (every phase)

- Unit and counterfactual tests, each confirmed to fail when its fix is reverted (mutation check).
- 1,000-year natural runs for Realistic mode and god-mode runs. Multi-seed invariants: the population ledger, finite values and the GDP identity.
- Browser checks at phone and desktop sizes for any UI change.
- No invented numbers: every figure in the docs comes from a recorded run.
