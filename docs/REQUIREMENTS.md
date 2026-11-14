# EPOCH: Civilizations Unbound — Requirements Specification

Condensed, numbered restatement of the master development prompt (2026-11-14).
IDs are referenced by the implementation plan, tests and the feature-status report.

## R0 Principles
- R0.1 Player is an observer/creator; civilizations act autonomously; the world runs without input.
- R0.2 History is emergent and nonlinear; no fixed outcome sequence; tech is NOT a global timer.
- R0.3 Runs in iPhone Safari (touch) and desktop browsers; top-down 8/16-bit pixel art.
- R0.4 Deep simulation, simple UI; casual-friendly.
- R0.5 Truthful documentation: never present mocked/planned behavior as implemented; disclose limits.
- R0.6 Original IP: WorldBox is a genre reference only (no copied code, sprites, icons, layouts).

## R1 World creation
- R1.1 Start menu: New World, Load World, Scenario Worlds, Settings.
- R1.2 New World options: name, seed, size, landmass, ocean coverage, fragmentation, mountains, rivers,
  climate variation, resources, biodiversity, disaster frequency, aggressiveness, tech speed, start era,
  start civ count, fantasy toggle, futuristic-tech toggle.
- R1.3 Presets: Primitive Earth, Age of Kingdoms, Industrializing World, Modern Geopolitics, After the Collapse,
  Alien Planet, Complete Randomization. Empty world and populated world both supported.
- R1.4 No forced quests, energy limits, cooldowns, ads or purchases; optional scenario objectives only.

## R2 Geography & environment
- R2.1 Tile attributes: elevation, terrain, water depth, temperature, moisture, fertility, vegetation, resources,
  pollution, controlling settlement/civ, infrastructure, hazards.
- R2.2 Terrains: deep/shallow ocean, coast, beach, grassland, steppe, desert, forest, tropical forest, mountain,
  snow, glacier, swamp/wetland, river, lake, volcanic (+ others).
- R2.3 Seeded procedural generation: noise, plates, rainfall, erosion approximation, river routing to sea/lakes,
  climate classification, resource distribution; plausible continents.
- R2.4 Dynamics: seasons, vegetation regrowth, drought, wildfire, floods, storms, earthquakes, volcanoes,
  erosion/desertification, pollution, climate change — with causal societal effects (drought → yields → prices →
  migration → legitimacy → diplomacy).
- R2.5 Resources: food, timber, stone, freshwater, fertile land, ores, coal, oil, gas, uranium, rare metals...;
  extraction costs, depletion/renewal, transport, tech dependencies; uneven distribution by biome/geology.

## R3 Population & individuals
- R3.1 Individuals (when practical): id, name, species, age, parents/descendants, household, settlement, civ,
  occupation, health, education, skills, traits, genes, culture, religion, status, achievements.
- R3.2 Birth, aging, death, households, education, migration, occupation, mobility, disease, inheritance.
- R3.3 Population responds to food, mortality, health, conflict, migration, living standards; demographic transition.
- R3.4 Notable people (rulers, inventors, generals, prophets, explorers) with biographies built from real events.
- R3.5 Multi-resolution: individuals at small scale, cohorts at large scale; no millions of pathfinding agents.

## R4 Civilizations & culture
- R4.1 Civs emerge from populations/settlements; persistent identity across government/border changes.
- R4.2 Civ state: name, color, emblem, founding, population, territory, settlements, capital, government, leader,
  laws, cultures/languages, religions, technology, military, economy, resources, relations, stability,
  legitimacy, prosperity, infrastructure, timeline.
- R4.3 Expand, merge, divide, federate, revolt, colonize, go extinct (kept in history).
- R4.4 Cultures spread, change, blend, diverge, survive conquest; language related to but distinct from culture.
- R4.5 Readable generated names; explanations for important events.

## R5 Religion
- R5.1 Religions emerge under social conditions; founders, myths, doctrines, institutions, leaders, sacred sites,
  temples, conversion, missionaries, syncretism, schisms, reform, tolerance, state religion, secularization,
  pluralism, conflict, diplomacy effects; cross borders; survive founding civ.
- R5.2 No rule "religious = aggressive". Player can found religions, spread, sacred sites, tolerance laws.

## R6 Government & politics
- R6.1 Forms: tribal council, chiefdom, monarchy, empire, city-state, republic, democracy, oligarchy, theocracy,
  federation, authoritarian (+ others), modeled as institution vectors separate from labels.
- R6.2 Succession, elections, factions, legitimacy, corruption, state capacity, taxation, spending, reform, unrest,
  coups, revolutions, independence, secession, integration, constitutions, collapse, transitions.
- R6.3 Political movements from economic/social composition; no single endpoint.
- R6.4 International organizations, alliances, customs unions, blocs, spheres; rivalries without war.

## R7 Technology
- R7.1 Branching dependency graph + institutional/economic/educational/resource/environmental constraints.
- R7.2 Research depends on knowledge, population, education, specialists, institutions, materials, surplus,
  infrastructure, trade/diffusion, investment, conflict, openness, chance, adoption costs.
- R7.3 Discovery separate from adoption; purchase/transfer possible; diffusion via trade, education, migration,
  espionage, alliance, conquest.
- R7.4 15 descriptive eras (Prehistoric → Speculative); mixed-era civs; realism modes; divergence; collapse and
  knowledge loss (non-monotonic).

## R8 Cities, transport, economy
- R8.1 Visible era-specific settlements; urban form from population, housing, space, terrain, transport, jobs,
  income, infrastructure, regulation, tech, trade, risk; same city evolves; historic sites persist; functional buildings.
- R8.2 Transport networks (trails → roads → rail → highways → air → future) with real cost/speed effects on trade,
  settlement and military; visible traffic at close zoom, aggregated at distance.
- R8.3 Sectors from foraging to advanced manufacturing; production, consumption, savings, investment, labor,
  capital, taxation, spending, trade with accounting identities; GDP, per-capita, productivity, trade balance,
  inflation, unemployment, revenue, spending, debt, inequality, resources, living standards.
- R8.4 Trade/globalization incl. sanctions, embargoes, tariffs, shocks; emergent crises & recovery.

## R9 War & diplomacy
- R9.1 Era-appropriate warfare with personnel, equipment, training, organization, tech, morale, supply, terrain,
  mobility, weather, fortifications, objectives, exhaustion; not a single strength comparison.
- R9.2 Systemic causes; threats, negotiation, declarations, alliances, treaties, concessions, transfers, ceasefires;
  not always total conquest; abstract nuclear deterrence & escalation with consequences; no weapon instructions.
- R9.3 Visible units/ships/aircraft with zoom abstraction; consequences (losses, damage, migration, fiscal, regime).
- R9.4 Persistent relations (history, trust, trade dependence, disputes, threats, culture/religion, commitments,
  government similarity, power, reputation); recognition, trade, NAP, defensive alliance, coalitions, territorial
  and peace negotiation, vassals, federations, isolation, embargoes, blocs, organizations.

## R10 Health, ecology, powers
- R10.1 Disease from density, mobility, sanitation, immunity, medicine, policy; outbreaks, endemic burden.
- R10.2 Ecosystems: plants, herbivores, predators; spawning, reproduction, predation, migration, extinction,
  adaptation, domestication, invasive species, habitat loss, recovery; genetics/subspecies over long timescales.
- R10.3 Optional fantasy races/creatures; human-only worlds supported.
- R10.4 God powers (terrain, life, civilization, religion/culture, technology, environment, destruction, advanced)
  that change simulation state; world laws (14 toggles/values listed in prompt §17).

## R11 Modern & future
- R11.1 Modern: global trade, markets, specialization, education & health systems, grids, communications, industrial
  agriculture, mass transit, institutions, deterrence, media/opinion, energy transition, regulation, orgs, crises.
- R11.2 Near-future: AI adoption, automation, robotics, renewables, storage, computing, space commerce, aging,
  displacement, AI governance, efficiency.
- R11.3 Far-future: automated production, off-world settlements, interplanetary trade, habitats, megastructures,
  new polities, post-scarcity with constraints, planetary/off-world divergence. Risks arise from modeled conditions.

## R12 History & analytics
- R12.1 Event log (foundings, inventions, transitions, wars, treaties, revolutions, crises, collapses, catastrophes,
  space milestones, extinctions) browsable by year/civ/category/location; selecting highlights location.
- R12.2 Causal explanations from recorded decision inputs only.
- R12.3 Snapshots/branching with seed + state for reproduction; optional template newspaper.
- R12.4 Global and per-civ statistics; time-series charts (selectable civs, multi-variable, era annotations,
  event markers, units); change decomposition from recorded flows.

## R13 UI
- R13.1 Map-dominant layout: top-left world/year/era, top-center playback, top-right menus, bottom tool dock in
  10 categories, side panel/sheet inspectors; original pixel icons.
- R13.2 Touch: pan, pinch, tap select, long-press inspect, drag painting, brush sizes/previews, undo, drawers,
  large targets, safe areas, portrait & landscape; reliable pan vs paint distinction; clear active tool.
- R13.3 Civ inspector tabs: overview, history, technology, military, economy, culture, diplomacy, statistics.
- R13.4 Overlays: political, population, technology, religion, culture, language, resources, economy, trade,
  military, diplomacy, pollution, climate, infrastructure, historical territory.

## R14 Art
- R14.1 Coherent palette, consistent pixel density, nearest-neighbor scaling, era-evolving buildings, small
  animations (water, vegetation, fire, smoke, construction, people, vehicles, ships, aircraft, military, machinery,
  weather, selection). Asset manifest with source/license/resolution/use.

## R15 Architecture & performance
- R15.1 TypeScript + Vite; renderer chosen after evaluation; lightweight UI; workers where appropriate; IndexedDB;
  documented serialization; tests & benchmarks; modular (no monolith).
- R15.2 Deterministic tick independent of frame rate; pause/speeds; explicit daily/monthly/annual time scales.
- R15.3 Seeded PRNG; seed + engine version + state reproduce outcomes; save/load must not alter the future.
- R15.4 Size presets small 128², medium 256²(target), large from profiling; responsive input; measured FPS/throughput/memory.

## R16 Persistence
- R16.1 Multiple slots, autosave, manual save, names, thumbnails, last played, year, seed, engine & format versions;
  graceful handling of interrupted writes, quota, corruption; export/import; branching; versioned schemas + migrations;
  round-trip tests.

## R17 Quality
- R17.1 Unit, integration (10 listed), statistical multi-seed, regression, property & stress, mobile interaction tests.
- R17.2 Prohibited: fake stats, decorative systems, scripted history disguised as emergent, nonfunctional controls,
  placeholder art presented as final, unrun tests reported as passing, unmeasured performance claims.
- R17.3 Deliverables: runnable app, source, build config, art + manifest, docs (architecture, data model, assumptions,
  limitations, instructions), tests, benchmarks, feature-status report (complete/partial/experimental/unimplemented).
