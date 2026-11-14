# WorldBox feature inventory

Research input for **EPOCH: Civilizations Unbound**. This is documentation only: no code, no assets, and no text copied from the game.

- **Research date:** 2026-11-14
- **Subject:** *WorldBox – God Simulator* (sold as "Super WorldBox" on Steam) by Maxim Karpenko, written in C# on Unity ([FAQ]).
- **Method:** I read the official version history at superworldbox.com ([CL], about 129 version entries from 0.3.x to 0.51.4), the official FAQ ([FAQ]) and homepage ([HOME]), and the Steam store page ([STEAM]). I also read the developer's Steam announcements, listed through the Steam News API ([SNEWS]); each announcement's title was checked on its steamcommunity.com page. Mechanics detail comes from the community Fandom wiki. Its page HTML sits behind a Cloudflare challenge, so I read the wiki pages through its public MediaWiki API (`api.php?action=parse`), which returns the same content. Revision IDs are listed in the source list.

## Confidence legend

| Label | Meaning |
|---|---|
| **official** | Stated by the developer: the superworldbox.com changelog or FAQ, the Steam store page, or a developer announcement on Steam. |
| **community-wiki** | Stated only on the Fandom wiki at the-official-worldbox-wiki.fandom.com. The wiki is titled "The Official Worldbox Wiki" and the official FAQ links to it for modding. Its main page, however, says it is "edited, maintained, and managed by players". Treat it as community-maintained. Many of its numbers were worked out by editors from game code ("may be outdated" or "may have incorrect information" appear on several pages) and can change between versions. |
| **official + wiki** | The feature's existence is official. The mechanics detail comes from the wiki. |
| **unverified** | I could not confirm it in a source I retrieved. |

Source links use short labels such as [CL] or [W-Plots], which resolve to full URLs in the source list at the end. A version number after [CL] (for example "[CL] 0.21.0") points to that entry on the single changelog page.

---

## 0. Version status (what is current)

| Item | Finding | Source | Confidence |
|---|---|---|---|
| Current versions by platform (changelog table, fetched 2026-11-14) | Android 0.51.4 and iOS 0.51.4. PC, macOS and Linux (Steam) 0.51.2. | [CL] | official |
| Most recent release | **0.51.4 "SteadyBox", 25 May 2026**: stability fixes. 0.51.3 "StableBox" (15 May 2026) was a security update plus translations. Both are mobile-only per the platform table. | [CL] | official |
| Most recent major content update | **0.51.0 "ArmyBox", 11 Sep 2025**: armies became meta objects, multi-toggle zone views, selecting metas from the map, selection history, past-name history, and iOS save-folder access. Hotfixes 0.51.1 and 0.51.2 followed on 12 Sep 2025. | [CL] 0.51.0, [S-ArmyBox] | official |
| Largest overhaul | **0.50.0 "Monolith Awakens"**: Steam open beta on 1 Apr 2025, full release announced with 0.50.5 on 12 Jun 2025. Added subspecies, genes, languages, religions, families, clan traits, unit possession, graphs, walls, new biomes and an "Ages upgrade". The changelog says it "took more than 2 years to develop". | [CL] 0.50.0–0.50.6, [S-050Announce], [S-Beta050], [S-0505] | official |
| Next update (announced, unreleased) | Dev update of 7 Jun 2026: the next update is "about 85% done". It will add **Meta Control**, a **ChessBox** world law, fog of war, a farm rework, and corpses that rot and can be resurrected. Not in the changelog as of 2026-11-14. | [S-MetaControl], [CL] | official (announcement) |
| Steam status | Released 2 Dec 2021 in Early Access. The store page still shows the Early Access block, with Steam's note that the developers last updated that block "over 14 months ago". Price $19.99. 96% of 30,207 English reviews positive (snapshot at retrieval). | [STEAM] | official (store page) |
| Origin | The developer's Early Access text says the idea dates to 2011, with a Flash prototype on Newgrounds in 2012. Work restarted in 2017 and the first Android release came in 2018. | [STEAM] | official |
| Multiplayer | "no plans" for multiplayer; designed as single-player. | [FAQ] | official |

---

## 1. Terrain creation and modification

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F01 | Terrain painting | Brushes paint deep ocean, close ocean, shallow water, sand, plain soil, forest soil, hills, mountains and summit tiles. The "World Shaping" tab holds 47 powers. Steam: "Use different tools and brushes to design and populate your world." | [W-Powers], [STEAM], [HOME] | official + wiki |
| F02 | Height and cleanup tools | Shovel up/down changes ground level. Finger copies the pixels under it. Vortex shuffles pixels. Sponge clears burned tiles, ruins and tornadoes. Sickle, Bucket, Pickaxe and Axe remove grass, liquids, ores and trees. Spade removes only the biome layer (added 0.14.0). Demolish removes buildings and roads. Life Eraser kills creatures only. | [W-Powers], [CL] 0.4.133, 0.14.0 | official + wiki |
| F03 | Wall tiles | Seven wall types: stone, wall of evil, ancient, wooden, green (grows stronger with time and rain), iron (spiked), and wall of light. Added in 0.50.0; made sturdier in 0.51.0. | [W-Powers], [CL] 0.50.0, 0.51.0 | official + wiki |
| F04 | Brush system | Many brush shapes ("12 more brush shapes" in 0.4.133). Circle brushes use Bresenham's algorithm (0.50.5). On PC, Alt+scroll changes the brush. | [CL] 0.4.133, 0.21.0, 0.50.5 | official |
| F05 | "Printer" stamps | An ant-like printer walks a pattern and stamps new landscape: hexagon, skull, labyrinth, spiral, star fort, "code", and others. | [W-Powers], [CL] 0.22.0 | official + wiki |
| F06 | Self-changing terrain | Water-side soil erodes to sand (Erosion law). Lava cools into rock (Eternal Lava law stops this). Shallow water can freeze, and ice breaks under walkers. Fire spreads through grass. Acid turns soil into wasteland. | [CL] 0.3.120, 0.4.129, 0.9.0, 0.12.02, [W-Laws] | official + wiki |
| F07 | Temperature tools | Hot and cold brushes burn or freeze units and heat lava. The hot brush no longer starts fires (since 0.12.02). | [CL] 0.7.0, 0.12.02 | official |
| F08 | Roads and bridges | Civilizations build roads. Roads on water or sand get a bridge skin (0.8.2). Roads outside village zones deteriorate (0.4.129). | [CL] 0.4.129, 0.8.2 | official |
| F09 | Zone and border editing | Scissors remove city zones. Paint expands a city. Border Brush (0.50.4) draws borders. The border bucket (0.51.0) will not paint over other cities. | [W-Powers], [CL] 0.50.4, 0.51.0 | official + wiki |
| F10 | Tile explosives and automata | TNT, delayed TNT, water bombs, landmines, fuses and fireworks. Two "Conway's Game of Life" cellular-automaton powers alter terrain. | [W-Powers], [W-Laws] | community-wiki |

## 2. Procedural world generation and map sizes

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F11 | Generator templates | 16 world types: Continent, Box World, Islands, Boring Plains, Donut, Toast, Pancake, Dormant Volcano, Cheese, Bad Apple, Chaos Pearl, Chaos Lasagna, Anthill, Checkerboard, Cubicles, Empty. | [W-MapCreation] | community-wiki |
| F12 | Advanced generation parameters | Official (0.21.0): random shapes, cubicle size, noise level plus "details" and "bonus" noise passes, random biomes, mountain edges, vegetation, resources, center lake or landmass, round or square edges, ring effect. Wiki editors, reading the code, describe three Perlin layers with alpha 1 / 0.2 / 0.1 and scale ×1 / ×4 / ×10; they caution this "may not be completely correct". | [CL] 0.21.0, [W-MapCreation] | official + wiki |
| F13 | Map size presets | Tiny 128², Small 192², Standard 256², Large 320², Huge 384², Gigantic 448², Titanic 512², and Iceberg 576² (PC only). Sizes go up in 64-tile units, from 2×2 to 9×9. Titanic was added in 0.12.02 and Iceberg (PC) in 0.13.0. Steam: "Generate worlds of different sizes". | [W-MapCreation], [CL] 0.12.02, 0.13.0, [STEAM] | official + wiki |
| F14 | Zone grid | All territorial "metas" expand through 8×8-tile zones. A new kingdom usually starts with 3×3 zones. | [W-Kingdoms] | community-wiki |
| F15 | Non-standard sizes and image-to-map | Community converters and mods make rectangular or larger maps. The wiki puts a practical ceiling at about 30×30 units with 16 GB RAM (a community claim). | [W-MapCreation] | community-wiki |
| F16 | Special maps and presentation | A special map appears on first launches (0.12.02). World previews show as a rotating globe (0.13.0). The wiki adds an April-1 map. | [CL] 0.12.02, 0.13.0, [W-MapCreation] | official + wiki |
| F17 | World "life DNA" seed | Gene DNA sequences are seeded by the world's creation hour in UTC, stored as "life DNA" in the save. | [W-Genes] | community-wiki |

## 3. Biomes and environmental change

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F18 | Biome seeds and spreading biomes | 23 distinct biomes (29 counting special ones), planted with seeds and spreading over soil. Seeds include grass, savanna, birch, maple, swamp, jungle, corrupted, infernal, mushroom, candy, garlic, lemon, enchanted, arcane desert, rocklands, crystal, permafrost, flower, celestial, singularity swamp, paradox and clover. Biome seeds arrived in 0.12.02; more biomes were added in 0.14.0, 0.21.0 and 0.50.0. | [W-Biomes], [W-Powers], [CL] 0.12.02, 0.14.0, 0.21.0, 0.50.0 | official + wiki |
| F19 | Biome competition | The "Biomes Overgrowth" world law lets biomes overgrow each other (0.12.02). | [CL] 0.12.02, [W-Laws] | official |
| F20 | Biome effects on life | Animals spawn per biome, in biome-specific colors (0.12.02). Some biome tiles act on units: inferno ignites them, biomass slows them or causes madness, corrupted land curses, enchanted land blesses. Biome tooltips list which species spawn there and which traits the biome can grant (0.51.0). | [CL] 0.12.02, 0.51.0 | official |
| F21 | Biome adaptation | Desert, swamp and permafrost adaptation traits remove the slowdown in those biomes (0.51.0). Raining biome seeds on units gives their subspecies that biome's adaptation (0.50.1). Units do not settle biomes they are not adapted to (0.50.3). | [CL] 0.50.1, 0.50.3, 0.51.0 | official |
| F22 | Vegetation dynamics | Trees and plants spread from existing vegetation (0.14.0). World laws control tree, plant and fungus growth and speed, "Roots without Borders" (spread into any biome), High Flora Density, and Random Seeds. | [CL] 0.14.0, [W-Laws] | official + wiki |
| F23 | Terramorphing | A world law (on by default) under which some civilizations' buildings spread their species' native biome. | [W-Laws] | community-wiki |
| F24 | Clouds and weather | Rain, thunder, snow, acid, lava, ash, magic, rage, hell clouds and "cloud of life". Which clouds appear naturally depends on the current Age (0.21.0). | [W-Powers], [CL] 0.21.0 | official + wiki |
| F25 | Rite-driven biome change | After a completed magical rite, a religion with "transformation" traits converts nearby land, unless the Gaia's Covenant law is on. | [W-Plots] | community-wiki |

## 4. Animals, plants, ecosystems, creatures

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F26 | Large bestiary | 113 creature unlockables (wiki count). Steam lists animals plus demons, skeletons, zombies, tumors, cold ones, dragons, UFOs and Crabzilla. | [W-Knowledge], [STEAM] | official + wiki |
| F27 | Diets and food chains | Animals have diets: crops, berries, flowers, grass, insects, or each other when hungry (0.5.161). Steam: "Animals will look for food". Since 0.50.4 all cannibalistic creatures fight when hungry. Diet traits include lithotroph (eats minerals). | [CL] 0.5.161, 0.50.4, 0.50.6, [STEAM] | official |
| F28 | Pollination and plant–animal links | Bees pollinate flowers, which then spread. Butterflies turn into flowers when killed. Druids leave trails of flowers and grow trees. | [CL] 0.5.161, 0.9.0 | official |
| F29 | Hunting and mass-based drops | Villagers hunt animals aged 3 or older for food, bones and leather (0.5.155). Drops scale with the victim's weight (0.50.2). The wiki gives the formula: amount = base × (⌊mass ÷ drop-per-mass⌋ + 1), capped at 1–30. | [CL] 0.5.155, 0.50.2, [W-Genomes] | official + wiki |
| F30 | Population caps per subspecies | "Harmony" subspecies traits cap a subspecies at 50, 100, 500 or 1000 members, or leave it uncapped. Laws toggle animal babies and animal spawning. | [W-SubTraits], [W-Laws] | community-wiki |
| F31 | Herds, packs, alphas | Families can be of herd type, with an "alpha" (the oldest member), which changes their behavior decisions. | [W-Families] | community-wiki |
| F32 | Animal civilizations | Many animals have sapient forms that build civilizations, for example seals into Navy Seals in 0.51.0. All animal civs can build the full building set (0.50.5). The developer post: "Many new civilizations have been added". | [S-050Announce], [S-ArmyBox], [CL] 0.50.5 | official |

## 5. Civilizations, cities, kingdoms, borders

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F33 | Sapience gate | Only subspecies with the Prefrontal Cortex trait found or join kingdoms. Losing the trait removes that ability. | [W-Subspecies], [W-Kingdoms] | community-wiki |
| F34 | Kingdom founding | A civ unit spawned outside its race's borders makes a new city and kingdom (0.4.129). The founder becomes king and founds a clan. A culture and a language are created with the kingdom; a religion is not. | [CL] 0.4.129, [W-Clans], [W-Religions] | official + wiki |
| F35 | Villages and building tiers | Settlers start in tents, then build tiered houses, town halls, windmills, docks, barracks, temples, libraries, markets, wells, watch towers and statues. Building costs are partly in gold. | [CL] 0.5.155, 0.8.0, 0.10.0, [W-Economy] | official + wiki |
| F36 | Citizen jobs | Farmers, miners, metalsmiths (ore into metal), blacksmiths (items), warriors and others. Units carry tools such as hoes and pickaxes (0.9.0). | [CL] 0.5.155, 0.9.0 | official |
| F37 | Settlers and expansion | Kingdoms colonize farmable land away from their borders (0.4.129). The settler algorithm was reworked in 0.14.1 to settle further out. A "Kingdom Expansion" world law toggles this. | [CL] 0.4.129, 0.14.1, [W-Laws] | official |
| F38 | Zone-based borders | City zones grow from tiles that hold buildings. Disconnected zones are abandoned ("less border gore", 0.12.02). Cities under attack can lose zones. Abandoned villages decay. | [CL] 0.5.148, 0.6.187, 0.12.02, 0.51.0 | official |
| F39 | Over-expansion limit | Each kingdom has a soft "max cities" set by founding species and the king's stewardship and traits. Every city over the limit gives −25 loyalty to all cities. | [CL] 0.8.0, [W-Kingdoms] | official + wiki |
| F40 | Capitals | The king lives in the capital. Capitals get +1000 loyalty and never rebel. | [W-Loyalty], [W-Kingdoms] | community-wiki |
| F41 | Customization | Edit kingdom banners and colors (0.14.0) and generated mottos (0.10.0). Colors come from 88 color sets (0.22.0). | [CL] 0.10.0, 0.14.0, 0.22.0 | official |
| F42 | Multi-species cities and xenophobia | "Some species don't mind sharing a city with others. Some, however, are fiercely territorial." Since 0.50.3, only xenophobic cultures kill other species and destroy cities; others capture them. | [S-050Announce], [CL] 0.50.3 | official |

## 6. Individual units and character traits

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F43 | Stats and civil attributes | Combat stats plus four civil attributes: diplomacy, warfare (martial), stewardship and intelligence. These gate leadership, warrior caps, city limits and plots. | [CL] 0.8.0, 0.10.0, [W-Plots] | official + wiki |
| F44 | Levels and experience | Unit levels since 0.5.148. Kings and leaders gain yearly experience (0.5.149). Reading books gives experience (see F84). | [CL] 0.5.148, 0.5.149, [S-Languages] | official |
| F45 | Aging and lifespan | Races have maximum ages and grow-up times (0.4.141). Past max age a unit has a yearly chance to die: 13.13% since 0.21.0. Fertility falls near max age. Old-age deaths are spread through the year (0.50.1). Many traits change lifespan. | [CL] 0.4.141, 0.21.0, 0.50.1, 0.50.4 | official |
| F46 | Creature traits and trait editor | 116 creature traits (wiki count). Traits are unlocked by inspecting units and can be added or removed in a trait editor (0.14.0). Gamma, delta and omega "trait rains" apply chosen traits to an area (0.14.1). | [CL] 0.14.0, 0.14.1, [W-Knowledge] | official + wiki |
| F47 | Status effects | Timed statuses such as burning, frozen, poisoned, caffeinated, rage, enchanted, pregnant and egg. | [CL] 0.7.0, 0.12.02, 0.21.0, [W-Repro] | official + wiki |
| F48 | Needs and mood | Hunger and nutrition. Favorite foods, where eating them makes a unit happy and "Happy king happy kingdom" (0.8.0). Happiness runs from −100 to 100 and only species with the Amygdala trait have it. | [CL] 0.8.0, [W-Happiness] | official + wiki |
| F49 | Neuron ("Brain") AI | Each behavior is a "neuron" with a cooldown, a weight and a priority layer (idle up to immediate). Traits, statuses, subspecies, clans, cultures, languages, religions and items add neurons. The "Brain Screen" lets the player see and silence neurons. Neurons do not run for sleeping, stunned or possessed units. | [S-050Announce], [W-Neurons] | official + wiki |
| F50 | Emotions and social ties | Units "react to what happens to them": they get sad or angry, throw tantrums, and cry when family dies. They have lovers and one best friend; similar happiness raises the chance of becoming best friends. | [S-050Announce], [W-Happiness] | official + wiki |
| F51 | Spells | Spell system since 0.7.0: fire, shield, teleport, blood rain, lightning, tornado and curse. Religions and talents add more. | [CL] 0.7.0, [S-Religions] | official |
| F52 | Ruler personalities | King and leader "personalities" derive from their attributes and steer kingdom behavior (0.8.0). War chances depend on the king's warfare, personality and stewardship. | [CL] 0.8.0 | official |

## 7. Genetics, inheritance, subspecies, evolution

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F53 | Subspecies as meta-objects | "Whenever a new creature is created, it will be assigned to a subspecies", viewable and customizable like other metas. A creature spawned far from members of its species starts a new subspecies; one spawned nearby joins theirs. | [S-Subspecies], [CL] 0.50.0, [W-Subspecies] | official + wiki |
| F54 | Subspecies traits, including brain traits | 204 subspecies traits (wiki), editable in a trait editor; editing marks the subspecies "GMO". Brain traits gate behavior: Prefrontal Cortex (sapient), Advanced Hippocampus (memory, needed for culture and religion), Amygdala (emotions), Wernicke's Area (language). | [S-Cultures2024], [W-Subspecies], [W-SubTraits] | official + wiki |
| F55 | Reproduction strategies | Egg-laying or pregnancy. Sexual or hermaphroditic. Asexual parthenogenesis, budding, fission, vegetative, spore and "divine". Combat-based "soulborne" and "metamorph". Each method has its own cooldown and conditions, such as nutrition ≥50, housing and the subspecies cap. | [W-Repro], [S-050Announce] | official + wiki |
| F56 | Genes and chromosomes | A gene editor (0.50.0) sets a subspecies' base stats. Chromosomes are 6 loci wide and come in Tiny 12, Small 18, Medium 24 or Big 30 loci. Genes whose edge colors match their neighbors "synergize"; a fully matched gene turns gold and doubles its bonus. Harmful genes or amplifiers halve neighbors. Mutagenic genes raise the mutation rate. A fully synergized chromosome shows as gold (0.50.5). | [CL] 0.50.0, 0.50.5, [W-Genes] | official + wiki |
| F57 | Trait inheritance | Parents' traits enter a pool weighted by each trait's birth rate plus inherit rate. Each child tries to take 25% of the pool size. The wiki flags this as possibly incorrect. Officially, inheritance was adjusted so "babies won't receive almost all parent's traits" (0.50.5). | [CL] 0.50.5, [W-Repro] | official + wiki |
| F58 | Mutation on subspecies split | A new subspecies copies its parent's traits and chromosomes. With Y = rand(0..mutation+1)+1, it then gets Y+1 random gene mutations, Y traits added and Y traits removed. Trait rarity weights the pools (normal +10 down to legendary +1). | [W-Genes], [W-SubTraits] | community-wiki |
| F59 | Phenotypes | Several phenotypes per subspecies (0.50.5), which change with the biome during evolution events. | [CL] 0.50.5, [W-Monolith] | official + wiki |
| F60 | Monolith evolution ("uplift") | Officially, Monoliths "can alter genes and species traits, sometimes granting consciousness where there was none, allowing new civilizations to emerge". Per the wiki, during the in-game "Monolith" month a monolith tries to evolve up to 3 creatures within about 10 tiles into a new subspecies. There is a 50% chance of switching to the species' evolved form (for example fox into Slypaw). The subspecies gains the Uplifted and the four brain traits, and has a 10% chance of a biome trait. | [S-050Announce], [W-Monolith] | official + wiki |
| F61 | Rite of Ascension | A clan-chief plot that puts the whole clan through an evolution event. The new subspecies' name ends in "Ascentus". | [W-Plots], [W-Monolith], [CL] 0.50.1 | official + wiki |
| F62 | Taxonomy | Each species has species, genus, family, order, class, phylum and kingdom ranks. Taxonomy became a separate element of the subspecies window in 0.51.0. | [W-Taxonomy], [CL] 0.51.0 | official + wiki |
| F63 | Genetics sandbox laws | Gene Spaghetti (77.7% of genes randomized), Mutant Box (1–3 random traits on new subspecies), and Evolution Events on or off. The first two were added in 0.50.4. | [CL] 0.50.4, [W-Laws] | official + wiki |
| F64 | Developer intent: biomes drive evolution | "biomes could play a significant role in the simulation of evolution of your species in the world"; biome-specific food influences traits. | [S-Subspecies] | official |

## 8. Families, bloodlines, dynasties, clans

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F65 | Families | Made when creatures reproduce. Parents head the family; children leave when they reproduce. Each family has a name, a banner and origin families. "Family ties will affect relationships between characters." Hungry families of cannibal species may prey on other families. | [S-Families], [CL] 0.50.0, [W-Families] | official + wiki |
| F66 | Genealogy | The unit window shows generation and genealogy: siblings, children, parents, grandparents. Family history traces ancestral lines. | [S-Families], [W-Powers] | official + wiki |
| F67 | Clans (royal bloodlines) | Since 0.21.0: "Kings and leaders can start new bloodlines, called Clans", which feed diplomacy and loyalty. Clans have levels, small bonuses and a motto. Only clan members can become kings or leaders. Related clans ally more readily, and cities whose leader shares the king's clan are more loyal. | [CL] 0.21.0, [S-Clans2023] | official |
| F68 | Culture-dependent succession | Culture traits set succession rules, replacing the old "only-primogeniture" system, and can be combined. Per the wiki the default heir is the oldest member; options include youngest (Ultimogeniture) and merit by diplomacy, warfare, renown or money. A king is crowned 1–4 months after the old one dies. | [S-Clans2024], [W-Clans], [W-Kings] | official + wiki |
| F69 | Succession crises | If the royal clan has no heir and the kingdom has several cities, it fractures. A "Shattered Crown" culture splits the kingdom among the heirs. "Unbroken Chain" picks a king from the city leaders instead. | [W-Clans], [W-Rebellions] | community-wiki |
| F70 | Clan traits | A clan trait editor (29 clan traits per the wiki). Some traits depend on species or birth biome. Examples: Masters of Propaganda (+20 loyalty) and Silver Tongues (+20 opinion). | [S-Clans2024], [W-Knowledge], [W-Loyalty], [W-Opinions] | official + wiki |
| F71 | Renown | A prestige stat. Wars build renown (0.50.4), and so do alliances (0.51.0). Plots need thresholds: 60 renown to form an alliance, 50 to start a war (0.50.5). | [CL] 0.50.4, 0.50.5, 0.51.0 | official |

## 9. Languages and cultures

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F72 | Cultures as meta-objects | Introduced in 0.10.0 (founded at a village bonfire and spreading across zones) and reworked into trait-based metas in 0.50. Cultures shape clothing skins, opinions and loyalty. A culture is deleted when no units and no books carry it. | [CL] 0.10.0, 0.22.0, [W-Cultures] | official + wiki |
| F73 | Culture traits | 77 traits on the Culture Traits page, 78 on the Knowledge page. New cultures get 1–3 random traits. Examples: Dense Dwellings (2× houses per zone), Hive Society (3×), weapon preferences, succession rules, xenophobia. | [S-Cultures2024], [W-CultureTraits], [W-Knowledge] | official + wiki |
| F74 | Onomastics (naming) | A culture tab controls naming templates for units, family last names, clans and cities. | [S-050Announce] | official |
| F75 | Languages | A meta-object added in 0.50.0. Officially, languages "will influence opinions, loyalty, and now, learning" and cross borders and species. Per the wiki, a language is created with a kingdom or by plot (requires Wernicke's Area). | [S-Languages], [CL] 0.50.0, [W-Languages] | official + wiki |
| F76 | Conversion model | Culture, language and religion spread through talk, books and dreams. When two units talk, each side's affiliation goes into a "pot", with extra entries if it matches their city's or kingdom's; one draw decides. Books weigh 3–6 entries; the Stylish Writing trait doubles that. Dream Weavers convert sleepers at 50%. A player-possessed unit converts at 50%. The True Roots culture trait blocks conversion. | [S-Languages], [S-Religions], [W-Cultures], [W-Languages], [W-Religions] | official + wiki |
| F77 | Schisms (meta splits) | An ambitious or inspired leader with enough intelligence can split a culture, language or religion by plot (a language needs ≥1000 speakers). Since 0.50.5, splits need a long-lived, populous origin. Splits do not happen in capitals (0.50.3). | [CL] 0.50.3, 0.50.5, [W-Cultures], [W-Languages] | official + wiki |
| F78 | Cultural memory | "Even if a civilization is wiped out, their legacy can survive through their books." Reading a dead culture's books can revive it in a new city. | [S-Languages] | official |

## 10. Religions

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F79 | Religion as meta-object | Added in 0.50.0. Spreads through conversations, books and "unusual means" (dreams). A species needs Advanced Hippocampus to develop one. The Steam Early Access text had listed a "religion system" as planned. | [S-Religions], [CL] 0.50.0, [STEAM] | official |
| F80 | Founding conditions | Created only by plot. The founder must be a king or leader with ≥8 intelligence, a culture of ≥50 members, and a language. A city's religion follows its leader, and a kingdom's follows its king. | [W-Religions] | community-wiki |
| F81 | Traits, spells, rites | Religions "provide followers with passive traits, spells, and mystical rites (as new plots)". Their magic depends on the species and biome of origin, and "Some rituals can bring disaster to the world itself". There are 40 religion traits. Rites are wrathful, summoning or merciful; wrathful and summoning rites only appear during wars. | [S-Religions], [W-Plots], [W-Knowledge] | official + wiki |
| F82 | Divine-blood rulers | "Usually, only those of divine blood - the rulers and chosen few - are allowed to use such magic." The player can take that power back. A Magic Rites world law toggles rites (0.50.1). | [S-Religions], [CL] 0.50.1 | official |

## 11. Technology and knowledge (and whether there are tech eras)

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F83 | Legacy culture tech tree (0.10–0.22) | "Culture system and Knowledges! Cultures would now develop as the time goes, unlock buildings, features and bonuses", with about 50 knowledges. Intelligence sped research, and so did coffee given to leaders. The wiki now marks this page as an **old feature**: knowledge gain, culture levels up to about 59–63, common and rare knowledges, and rare-knowledge slots per race (humans 6, elves 5, dwarves 5, orcs 3). | [CL] 0.10.0, 0.12.02, [W-CultureDev] | official (historic) + wiki |
| F84 | Learning through books | "Clan members can write books, and others can read them". Books give experience, so "non-warrior characters [can] level up ... without combat". | [S-Languages], [W-Books] | official + wiki |
| F85 | Material and building tiers | Crafting takes the best affordable material tier, from wood, stone, copper, bronze and silver up through iron, steel and mythril to adamantine. Houses run from tier 1 to 6 and town halls from 1 to 3. | [W-Crafting], [W-Equipment], [W-Economy] | community-wiki |
| F86 | Knowledge archive (player level) | In 0.50+, "Knowledge" means the player's archive of 774 unlockables across worlds (creatures, items, genes, and creature, subspecies, culture, language, clan and religion traits, plus plots), shown with a 4-D "knowledge cube". | [W-Knowledge] | community-wiki |
| F87 | No technological eras | WorldBox's **Ages are environmental and mood eras, not technology eras** (see §16). I found no official mention of stone, iron or industrial ages, and nothing official on whether a tech tree survives in 0.50+. | [S-Ages], [CL] 0.21.0, [W-CultureDev] | official (Ages); current tech tree **unverified** |

## 12. Economy and resources

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F88 | Resource types and mining | Wood, stone, ore and common metals, silver, mythril, adamantine, gold, gems, bones, leather, dragon scales, herbs, and biome foods. Since 0.14.0, high-rank metals are actual resources that must be mined. Mines and deposits exist; a meteorite can leave adamantine. | [CL] 0.5.155, 0.8.0, 0.14.0, [W-Crafting] | official + wiki |
| F89 | Farming | Farmers plant and harvest wheat (0.3.120). Rain speeds wheat. Windmills are tiered, and losing one loses the wheat (0.14.0). In Dark, Ice and Despair ages, growing wheat has a 50% chance to die at each stage. | [CL] 0.3.120, 0.14.0, [W-Ages] | official + wiki |
| F90 | Foods with effects | Berries, bread, fish, meat, sushi, jam, burger, pie, tea, cider and more, with race-specific foods. Foods can grant traits or statuses: peppers set units on fire, mushrooms cause madness. | [CL] 0.8.0, 0.14.0 | official |
| F91 | Currency layers | Officially, gold became currency in 0.5.155: cities collect it yearly and spend it on warriors, upkeep and items. Per the wiki today, gold is a village resource capped at 999; units carry "loot" and "money". Eating city food costs 5 coins. Thieves steal. Units give gifts. Plots cost money. | [CL] 0.5.155, [W-Economy] | official + wiki |
| F92 | Taxes and tributes | Citizens pay tax to the city leader and leaders pay tribute to the king, at 20%, 50% or 70% set by the kingdom's traits (only 4 kingdom traits exist). Paying lowers happiness. | [W-Economy], [W-KTraits] | community-wiki |
| F93 | Supply within a kingdom | Cities send surplus to needy cities in the same kingdom (0.8.0). Per the wiki: give when stock >30 (wheat >100, gold >600) to a city holding <10 (wheat <20), in lots of 10 (gold 100). The cooldown depends on the leader's traits. | [CL] 0.8.0, [W-Economy] | official + wiki |
| F94 | Trading boats; no trade between kingdoms | Trading boats "move between docks and generate gold" (0.6.187). Per the wiki, about 5 gold per dock visit and no goods moved. "Kingdoms do not trade with each other." The wiki also quotes the developer calling trading "half baked" (via Reddit, which I did not retrieve). | [CL] 0.6.187, [W-Economy], [W-Trading] | official + wiki |
| F95 | Markets | A building added in 0.50 with no observed effect yet, per the wiki. | [W-Markets] | community-wiki |

## 13. Armies, warfare, conquest

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F96 | Warrior recruitment | Warriors are hired up to a share of the adult population, raised by the leader's warfare stat, barracks (halves the hiring cooldown), gold >10 and enough food. The wiki marks this section "may be outdated". Food shortages cut soldier numbers (0.21.0). | [CL] 0.8.0, 0.21.0, [W-Armies] | official + wiki |
| F97 | Armies as meta objects | Since 0.51.0, "Armies are now a meta object: favorite, select, and overview them! Captains now rally troops more effectively." The squad and general system dates from 0.8.0. An army does not attack below 70% of its maximum size (wiki). | [S-ArmyBox], [CL] 0.8.0, 0.51.0, [W-Armies] | official + wiki |
| F98 | City capture | Capture has a timer (0.8.0). Per the wiki, "occupying force" counts +1 per soldier, leader or king and +10 per watch tower. Progress sticks at 5% until defenders are cleared. Captured citizens change kingdom; a king flees (0.51.0). A city with nobody inside that cannot be captured is destroyed (0.50.4). | [CL] 0.8.0, 0.50.4, 0.51.0, [W-War] | official + wiki |
| F99 | Combat model | Weapons have range, area of effect, crit chance and attack rate (0.5.167). Hits can strike several targets. Ranged weapons lose 50% range at night (0.21.0). Hammers can stun (0.50.5). Units knocked back. | [CL] 0.5.167, 0.21.0, 0.50.5 | official |
| F100 | Defensive buildings | Watch towers "Protec but They Also Attac" (0.10.0). They stop capture and alert armies. | [CL] 0.10.0, [W-Armies] | official + wiki |
| F101 | Naval logistics | Docks and transport boats move armies and colonists across oceans (0.6.187). Boats can shoot. | [CL] 0.6.187 | official |
| F102 | Wars as named objects | Each war has a name, sides, duration and casualties. A war ends when the main sides are defeated, through diplomacy, or by player action. War lines show on the minimap. War types include a Spite total war. Wars can be sorted by renown, duration, army size and more (0.50.4). | [S-Wars], [CL] 0.21.0, 0.50.4 | official |
| F103 | Civilians in war | Same-species civilians stay out of fights unless the "Angry Villagers" law is on or a culture trait makes them fight. Cross-species invaders face villagers. | [CL] 0.9.0, [W-War] | official + wiki |

## 14. Diplomacy, alliances, rebellions, kingdom wars

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F104 | Diplomacy baseline | Since 0.5.148, kingdoms are at war or peace, cities have relations ratings, and revolutions happen. Wars between same-race kingdoms are allowed. | [CL] 0.5.148 | official |
| F105 | Opinion model | Each kingdom keeps its own opinion of every other. Factors: the king's diplomacy; −100 toward the "supreme" kingdom; touching borders −25, non-touching +25; "far lands" +60; at war −500; common enemies +50; same species +15, different species −10 (needs Amygdala); territory; peace time up to +20; power gap; matched or opposed ruler traits. The values changed across versions (see 0.21.1). | [W-Opinions], [CL] 0.21.1 | official + wiki |
| F106 | Plans and plots (intent system) | "royal clan members will first create a plan before making any major moves ... These plans will take time to come to fruition, and players will be able to track their progress." Per the wiki there are 28 plot types. Progress rises by 1 + intelligence per check, and plots cost money and need renown. | [S-Diplomacy], [W-Plots] | official + wiki |
| F107 | Alliances | Non-aggression pacts with stat boosts. A too-dominant kingdom makes others more likely to ally. Levels (0.21.0): L1 +5 max warriors, L2 +1 tower limit, L3 +10% armor, L4 +10% damage, L5 +1 max level. The supreme kingdom cannot found one; per the wiki, power = soldiers×2 + cities×5 + 1. | [S-Alliances], [CL] 0.21.0, [W-Alliances] | official + wiki |
| F108 | Peace talks | A plot that ends a war with both sides surviving. | [W-Plots], [S-Diplomacy] | official + wiki |
| F109 | Loyalty model | City loyalty to the crown: up to +50 when the kingdom is the weaker side in a war, trait effects (Pacifist +50 ... Madness −100), matched or opposed traits between king and leader, same clan, distance from the capital, over-expansion, and different language, culture or religion. | [CL] 0.21.0, 0.50.2, [W-Loyalty] | official + wiki |
| F110 | Rebellions (five kinds) | A classic rebellion plot needs a non-capital city with loyalty <0, ≥10 warriors and a kingdom ≥15 years old. The other four: "Lies" rite (inflicted), the Inspiration power (inspired), fracturing (no heir), and shattering (Shattered Crown). | [CL] 0.5.148, [W-Rebellions], [W-War] | official + wiki |
| F111 | Player diplomacy powers | Spite (a kingdom starts total war against all others), Friendship (peace), Inspiration (force a rebellion), Whisper of War (incite war), Discord (break an alliance), Unity (form an alliance). | [S-Wars], [CL] 0.21.0, [W-Powers] | official + wiki |

## 15. Possession, control and observation

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F112 | Unit possession | Added in 0.50.0 ("Unit possession!"). The possessed unit moves, attacks, kicks, steals (also equipment since 0.51.0), yells and can shoot from boats. Strong-minded units swear but can still be possessed (0.50.6). Per the wiki, a possessed unit talking to others converts their language, culture or religion at 50%. | [CL] 0.50.0, 0.50.6, 0.51.0, [W-Languages] | official + wiki |
| F113 | Spectate and follow | Spectator mode follows a unit and switches to its killer when it dies (0.8.0). F follows the unit near the cursor (0.21.0). | [CL] 0.8.0, 0.21.0 | official |
| F114 | Crabzilla | The player becomes a giant crab with lasers. | [STEAM], [CL] 0.5.167 | official |
| F115 | Divine magnet, flick, force | Pick up and drop creatures (0.5.161), throw them, or knock them around. | [CL] 0.5.161, [W-Powers] | official + wiki |
| F116 | Map layers and zone views | Layers for kingdoms, cities, cultures, religions, languages, clans, families, subspecies, alliances, armies and wars. Multi-toggle switches between kingdom, city and individual-unit ("fluid") borders (0.51.0). Minimap icons for kings, armies, boats and battles. | [CL] 0.21.0, 0.51.0, [W-Powers] | official + wiki |
| F117 | Selection tools | Select metas from the map, multi-unit selection, selection history with a back button, and Ctrl+0–9 hotkeys bound to units or metas (0.51.0). Nameplates and tooltips. | [S-ArmyBox], [CL] 0.51.0 | official |
| F118 | Time controls | Pause, 0.5× slow motion up to 4× speed (0.21.0). One game month is 7 s at 1× (0.21.0). | [CL] 0.21.0 | official |

## 16. World ages / eras and changing conditions

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F119 | Ten Ages | Hope (the default), Sun, Dark (a long night of 200–300 years), Tears, Moon, Chaos, Wonders (magic), Ice (long winter), Ash ("life is fading") and Despair. Ages shift kings' mood toward war or peace, fertility, food growth, clouds and disasters. The developers chose Ages over day/night or seasons because "time moves quickly". | [S-Ages], [CL] 0.21.0 | official |
| F120 | Age clock | Since 0.50, "World Ages can now be arranged like seasons" by drag and drop (0.50.5). Per the wiki, ages last at least 30 years and with default slots Hope fills about 53% of game time. | [S-050Announce], [CL] 0.50.5, [W-Ages] | official + wiki |
| F121 | Age-specific effects | Each age speeds certain biomes (Sun: desert and savanna; Chaos: infernal). Age-tied disasters: heatwave in Sun, snow clouds in Despair that turn babies into cold ones, hellspawn only in Chaos, UFOs only in Moon (0.21.1). Per the wiki: drought kills trees in Sun, frost in Ice and Despair, and global rain puts out fires in Tears. | [CL] 0.21.0, 0.21.1, [W-Ages] | official + wiki |
| F122 | Special months | "special months" (0.21.0). The month of "Monolith", equivalent to April, triggers monolith evolution. | [CL] 0.21.0, [W-Monolith] | official + wiki |

## 17. Natural disasters and destructive powers

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F123 | Destruction arsenal | Steam lists "Lightning, tornadoes, acid rain, nukes, meteorites, plague, dragons and even UFOs". The wiki's Destruction tab has 37 powers: grenade, bomb, napalm, atomic bomb, antimatter bomb, Tsar Bomba, bowling ball, heat-ray, meteorite, Infinity Coin ("removes 50% of creatures", 0.4.141), grey goo, robot Santa, crab bomb and others. | [STEAM], [W-Powers], [CL] 0.4.141 | official + wiki |
| F124 | Nature powers | Lightning in three sizes (only the player gets the huge one), earthquake, tornado (grows and moves, 0.6.187), rain, fire, acid, lava, volcano, and water and acid geysers. | [W-Powers], [CL] 0.6.187, 0.22.0 | official + wiki |
| F125 | Random disaster system | "Natural Disasters" and "Other Disasters" laws. Per the wiki, a disaster is picked from a pool weighted by its rate, then rolls its own chance to fire (earthquake 0.4). Eligibility depends on population, city count and the current Age. Officially, chances "now fully depends on a world age" (0.21.0). | [CL] 0.9.0, 0.21.0, [W-Disasters] | official + wiki |
| F126 | Fire and lava | Grass burns and fire spreads, and villagers try to put fires out (0.4.129). Lava burns neighboring tiles and cools into rock. Fires die out fast in the Age of Tears. | [CL] 0.3.120, 0.4.129, 0.21.0 | official |
| F127 | Epidemics | Plague (0.4.141). Per the wiki, an infected unit at each tick has a 5% chance to try to spread within 6 tiles, and each unit in range then has a 50% chance to catch it. Dense rat populations (>10) seed plague. Immunity traits let outbreaks become endemic. Zombie infection spreads by combat; mush spores and tumor infection spread differently. | [CL] 0.4.141, [W-Plague], [W-Diseases] | official + wiki |
| F128 | Gaia's Covenant | A world law that turns off terrain damage from explosions, fire and disasters (0.50.0). | [W-Laws] | community-wiki |

## 18. Fantastical creatures and supernatural events

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F129 | Monsters and magical beings | Demons, cold ones, bandits, necromancers, evil and white mages (0.7.0), plague doctors and druids (0.9.0), aliens and UFOs (0.10.0), fire elementals (0.21.0), bioblobs, cybercore assimilators and super pumpkins (0.12.02), ghosts (0.12.02, which can form civilizations since 0.51.0), golden brain (0.5.149), hypercube (0.50.5) and dragons. | [CL] (listed versions), [STEAM] | official |
| F130 | Undead and zombification | Infected units turn into zombies that keep their host's gear and traits (0.6.187). Most species have zombie versions (0.13.0). Skeletons have subspecies (0.50.4). | [CL] 0.6.187, 0.13.0, 0.50.4 | official |
| F131 | Metamorphosis | Under Rage in the Age of Chaos, units may "unleash their inner demons" (0.21.0). A "metamorphed" trait is given on such transformations (0.51.1). Transformed units keep their genealogy, lovers and loot (0.50.1). | [CL] 0.21.0, 0.50.1, 0.51.1 | official |
| F132 | Desire objects and mind control | Golden Egg, Ethereal Harp and Alien Mold attract creatures. A computer chip or "Evil Computer" turns creatures into obedient servants. | [W-Powers] | community-wiki |
| F133 | Spawner towers | Flame towers spawn demons and ice towers spawn cold ones (0.5.161). Towers spawn adults (0.50.1). | [CL] 0.5.161, 0.50.1 | official |
| F134 | Forbidden Knowledge ritual | Per the wiki, sacrificing more than 314 elves (or a "pure" subspecies) into lava unlocks everything for that world and disables achievements there. Officially, a "forbidden setting" was added in 0.50.2. | [CL] 0.50.2, 0.50.5, [W-Laws] | official + wiki |

## 19. Statistics, history, favorites

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F135 | World and game statistics | World stats: population, beasts, infected, deaths by cause (age, hunger, eaten, plague, other), trees, houses, islands. Cross-world game stats: playtime, meteorites launched, creatures created. | [CL] 0.4.141, [W-Stats] | official + wiki |
| F136 | Graphs and population pyramids | "stat graphs ... for every meta object: wars, alliances, kingdoms, cities, cultures, families, clans, subspecies and more". Population pyramids. A chart comparison window. Time scales of 50,000 and 100,000 years. Renown, money and migration tracking. Breakdowns by subspecies, culture, language and religion (0.51.0). | [S-Families], [S-Cultures2024], [CL] 0.50.4, 0.50.5, 0.51.0 | official |
| F137 | World history log | Logged events filterable by kings, favorites, cities, kingdoms, wars, clans and disasters. Major events can show on screen. | [CL] 0.8.0, 0.50.5, [W-History], [W-Powers] | official + wiki |
| F138 | Favorites | Favorite units (0.4.129), favorite items with holder tracking (0.50), and favorite meta objects. An "Interesting Units" tab finds notable characters. | [CL] 0.4.129, 0.50.4, [S-050Announce], [S-Families] | official |
| F139 | Past rulers and name history | Past kings, leaders, chiefs and captains. Renames are kept as history and propagate to books, wars and religions (0.51.0). | [CL] 0.50.5, 0.51.0, [S-ArmyBox] | official |
| F140 | Achievements and discovery | Steam achievements (0.14.0). "Eye of Insight" reveals creatures that carry undiscovered traits. | [CL] 0.14.0, [W-Powers] | official + wiki |

## 20. World laws and sandbox configuration

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F141 | World laws | About 48 toggles (wiki list) covering diplomacy, rebellions, armies, hunger, old age, civ and animal babies, migrants, flora and fungi growth, lava, cold, disasters, evolution, genetics and more. The first 5 laws came in 0.4.129. Laws can be reordered (0.50.5). The Grin Reaper law was removed in 0.51.0. | [CL] 0.4.129, 0.9.0, 0.14.0, 0.50.4, 0.51.0, [W-Laws] | official + wiki |
| F142 | Editors for every meta | Trait editors for units, subspecies, cultures, languages, religions, clans and kingdoms. Gene editor. A plot editor to force unlocked plots. Neuron toggles. Banner and color customization. | [S-050Announce], [S-Cultures2024], [S-Clans2024], [W-Plots] | official + wiki |
| F143 | Equipment editor | Reforge, transmutation and divine reforge reroll item modifiers (1, 5 and 30 tries). | [W-Crafting] | community-wiki |
| F144 | Settings and debug menu | Performance options: preload assets, autosave toggle, graphs toggle (0.50.6), 30 fps lock (0.22.0). A large debug menu, for example showing plague infection zones (0.14.0). | [CL] 0.14.0, 0.22.0, 0.50.6, [W-Debug] | official + wiki |
| F145 | Architect identity | The player can set an "Architect's Name" and one of nine colors or moods, which currently only tint UI highlights. | [W-Laws] | community-wiki |

## 21. Saving, loading, sharing

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F146 | Save slots | The save and load button on the main toolbar. Officially, "More saves" came in 0.50.0. Per the wiki, 60 slots in four named "planes" of 15 (30 in 0.22). | [FAQ], [CL] 0.50.0, [W-MapCreation] | official + wiki |
| F147 | Autosaves | Since 0.13.0, an autosave "every few minutes" and an autosave of the current world when another world is loaded. Per the wiki: every 5 min, 30 autosave slots, at most 5 per world. Autosave can be turned off (0.50.6). | [CL] 0.13.0, 0.50.6, [W-MapCreation] | official + wiki |
| F148 | Save format | Per the wiki: `map.wbox` is zlib-compressed JSON (since 0.7.0); `map.wbax` autosaves are uncompressed; plus `map.meta`, `preview.png` and `preview_small.png` (Workshop). The JSON holds world stats, world laws and tile arrays. | [W-MapCreation] | community-wiki |
| F149 | Steam Workshop | "Share your worlds with your friends in the Steam Workshop" (0.13.0). Uploading needs the Steam version. | [CL] 0.13.0, [STEAM], [W-MapInstall] | official + wiki |
| F150 | Steam Cloud | "The Steam version comes with cloud saves". Steam Cloud is listed as a store feature. Unlock progress syncs between PCs (fixed in 0.50.2 and 0.50.4). | [FAQ], [STEAM], [CL] 0.50.2, 0.50.4 | official |
| F151 | Manual map sharing | The FAQ links a map-sharing tutorial. iOS users can copy saves through the Files app (0.51.0). The community shares maps on Discord and GameBanana. | [FAQ], [CL] 0.51.0, [W-MapInstall] | official + wiki |
| F152 | Modding | Mods are community-made and not supported on mobile (FAQ). Code hooks for modders appear in changelogs, such as custom_data fields and asset libraries (0.21.0), and mods loaded as `_memload.dll` (0.21.1). | [FAQ], [CL] 0.21.0, 0.21.1 | official |

## 22. Additional verified features not in the list above

| # | Feature | What it is / how it works | Sources | Confidence |
|---|---|---|---|---|
| F153 | Books | Clan members write books by plot. Per the wiki this needs ≥3 intelligence, level ≥10 and 200 money. Books are stored in libraries and town halls; the limit was cut in 0.51.0, and the wiki gives 5 and 3 slots. A book carries one trait each from the writer's mind, language, religion and culture, gives readers experience, and can convert them. | [S-Languages], [CL] 0.51.0, [W-Books] | official + wiki |
| F154 | Item system | Inventory items (0.5.155) graded junk, normal, rare or legendary, made by blacksmiths. Killers loot better gear. An item generator with graded modifiers (0.14.0). Legendary items get generated names that can include kings, kingdoms or enemies, and weapons remember their kill count. Durability and repair (wiki). | [CL] 0.5.155, 0.14.0, [W-Equipment] | official + wiki |
| F155 | Loot rain | A power that showers units with chosen item types and can also remove cursed items. | [S-050Announce], [CL] 0.51.0 | official |
| F156 | Auto-tester | 0.50.3: "removed auto-tester tab from debug menu in builds". The wiki says an unused "Auto Tester" option in code "quickly tests various game functions"; editors could not get it working. | [CL] 0.50.3, [W-Debug], [W-History] | official (existence and removal) + wiki |
| F157 | Boats | Transport, trading and fishing boats (0.6.187). Fishing docks (0.14.0). Ships break ice (0.21.0). | [CL] 0.6.187, 0.14.0, 0.21.0 | official |
| F158 | Procedural music | "new procedural music system. Music depends on what is currently on screen" (0.21.0). | [CL] 0.21.0 | official |
| F159 | "Dust" memory powers | Make creatures forget their kingdom, culture, religion, language, or family and loved ones. | [W-Powers], [CL] 0.50.4 | official + wiki |
| F160 | Reproduction powers | "Smooth Jazz" (an asexual birth) and "Clone Rain" (clones count as children). Offspring get the "Miracle Born" trait. | [S-Cultures2024], [W-Repro] | official + wiki |
| F161 | Handsome migrants | A world law and status that sends migrants into cities. They take the city's culture, religion and language (0.50.3) and avoid cities without food (0.51.0). | [CL] 0.50.2, 0.50.3, 0.51.0 | official |
| F162 | Localization | The developer says the game "has been already translated into 33 languages". The changelog tracks completion per language (for example 0.51.0 and 0.51.3). | [STEAM], [CL] 0.51.0, 0.51.3 | official |
| F163 | Kingdom traits | Only 4 kingdom traits, all about tax and tribute rates. | [W-KTraits] | community-wiki |

### Announced but not released (as of 2026-11-14)

| # | Feature | What the developer says | Source | Confidence |
|---|---|---|---|---|
| F164 | Meta Control | "lock in on different meta types": kingdom, city, culture, religion, language, clan, subspecies, army, alliance, family. Fog of war lifts around that meta's units, and the player can order them to "build structures, chop trees". "play as a pack of wolves ... Or even as a religion." | [S-MetaControl] | official (announcement) |
| F165 | ChessBox mode | A world law that "restricts some of your god powers during control mode". | [S-MetaControl] | official (announcement) |
| F166 | Fog of war in diplomacy | "Kingdoms need to meet each other first before they can start wars." | [S-MetaControl] | official (announcement) |
| F167 | Corpses and resurrection; farm rework | "corpses rotting away, which you can resurrect yourself", plus a farm rework. | [S-MetaControl] | official (announcement) |

### Searched for but not verified

- **"Collections" as a meta feature:** not found in the changelog, the developer announcements or the wiki pages I read. The closest verified ideas are the Knowledge archive (F86) and the Favorites lists (F138). **Unverified.**
- **A tech tree in 0.50+:** the wiki marks the culture-knowledge system as an "old feature". No official text I read says whether it was removed or replaced. **Unverified.**
- **The developer's Reddit remark that trading is "half baked":** quoted on the wiki; the Reddit thread was not retrieved. **Unverified at source.**
- **Exact formulas** (inheritance, mutation, capture, opinion, loyalty values) come from wiki editors reading game code. They are useful as design references, not as authoritative specs, and can drift between versions.

---

## 23. Features worth replicating in EPOCH (design notes)

1. **One meta-object model for every social entity** (F53, F65, F67, F72, F75, F79, F97, F102, F106). Kingdoms, cities, cultures, languages, religions, clans, families, subspecies, armies, alliances, wars and plots all share the same parts: name and name history, banner, founder, stats, graphs, a map layer, favorites and a trait editor. That gives one consistent UI and data schema, which suits a TypeScript ECS and mobile list views.
2. **Spreading ideas through a weighted pot** (F76). Culture, language and religion spread through conversation, books and dreams using a cheap weighted draw that is biased toward the local majority. It is emergent, easy to tune, and maps onto conformity-biased transmission and Axelrod-style models (see simulation-grounding.md).
3. **Visible intent ("Plots")** (F106). Major AI decisions such as wars, alliances, rebellions, schisms and rites show up as progress bars before they fire. This is the main hook for player intervention and for emergent narrative.
4. **Utility AI the player can inspect** (F49). A brain screen with weighted neurons that can be silenced is a strong tool both for debugging and for player-facing storytelling.
5. **Genetics as a light puzzle** (F56–F60). Chromosome adjacency synergy, mutation when a subspecies splits, adaptation to biomes, and "uplift" events turn evolution into something the player can see and edit without real population genetics.
6. **Ages as switchable world regimes** (F119–F121). A configurable "age clock" changes disasters, crops, fertility and rulers' mood. EPOCH could split these into environmental eras and separate, grounded technology eras, which WorldBox lacks (F87).
7. **World laws for every subsystem** (F141). A toggle per subsystem gives a sandbox, test harnesses (an auto-tester, F156) and difficulty settings.
8. **Possession, and later meta control with fog of war** (F112, F164–F166). These bridge god-game observation and direct play, which suits short mobile sessions.
9. **Books as cultural memory that outlives civilizations** (F78, F153). A cheap way to make collapse and rediscovery stories happen.
10. **Rich observation tools** (F135–F139). Graphs and population pyramids for every meta, a filterable world log, past rulers, and name history. These are what make long runs readable.

**Gaps EPOCH could fill, per the sources:** WorldBox has no trade between kingdoms and markets with no effect (F94, F95), no grounded technology progression (F87), and borders made of blunt zones. These are the areas where the grounding document's gravity-model trade, market access, diffusion lags and state capacity could set EPOCH apart.

---

## Sources

**Official (developer or platform)**

- [CL]: https://superworldbox.com/changelog (title "WorldBox - Changelog and Game Updates (0.51.4)", retrieved 2026-11-14)
- [FAQ]: https://superworldbox.com/faq
- [HOME]: https://superworldbox.com/
- [STEAM]: https://store.steampowered.com/app/1206560/WorldBox__God_Simulator/
- [SNEWS]: https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=1206560&count=100&maxlength=0 (Steam Web API listing of 66 news items. Developer posts are authored by "WorldBob"; titles were checked on steamcommunity.com.)
- [S-MetaControl] "Dev Update: Meta Control and ChessBox", 2026-06-07: https://steamcommunity.com/games/1206560/announcements/detail/669491979075191190
- [S-ArmyBox] "0.51.0 - ArmyBox", 2025-09-11: https://steamcommunity.com/games/1206560/announcements/detail/523101526048114584
- [S-0505] "Monoliths have awakened! Update 0.50.5 is live!", 2025-06-12: https://steamcommunity.com/games/1206560/announcements/detail/523093274068519301
- [S-Beta050] "Awakening the Monolith - Open Beta 0.50 is live!", 2025-04-01: https://steamcommunity.com/games/1206560/announcements/detail/523086940514289535
- [S-050Announce] "WorldBox Update — 0.50: Monolith Awakens. Open Steam Beta Starts April 1", 2025-03-12: https://steamcommunity.com/games/1206560/announcements/detail/509574242369537673
- [S-Religions] "SneakBox: Religions, Naps, Divine Power, and GMO Fire Turtles?", 2025-02-05: https://steamcommunity.com/games/1206560/announcements/detail/503942206557519978
- [S-Languages] "SneakBox: Languages, books, small talk and learning", 2024-12-01: https://steamcommunity.com/games/1206560/announcements/detail/4453592738017838143
- [S-Clans2024] "SneakBox: Royal Clans and their bloody business!", 2024-10-15: https://steamcommunity.com/games/1206560/announcements/detail/4545912358019453883
- [S-Cultures2024] "SneakBox: Cultures and Subspecies traits, genes, new ui, and some gifs", 2024-08-12: https://steamcommunity.com/games/1206560/announcements/detail/4372517795037234445
- [S-Families] "Families, Genealogy, Graphs", 2023-12-26: https://steamcommunity.com/games/1206560/announcements/detail/3890611710917417279
- [S-Subspecies] "Species, Subspecies, Biomes and you!", 2023-12-04: https://steamcommunity.com/games/1206560/announcements/detail/3905246507035128779
- [S-Ages] "New mechanic: Ages!", 2023-03-02: https://steamcommunity.com/games/1206560/announcements/detail/3691300790682839632
- [S-Diplomacy] "Diplomacy is changing", 2023-02-20: https://steamcommunity.com/games/1206560/announcements/detail/3631627017371418796
- [S-Alliances] "Upcoming new mechanic: Alliances", 2023-02-09: https://steamcommunity.com/games/1206560/announcements/detail/3631626193502166546
- [S-Wars] "Expanded Wars Mechanic", 2023-01-30: https://steamcommunity.com/games/1206560/announcements/detail/3672157322353811983
- [S-Clans2023] "Upcoming new mechanic: Clans and Bloodlines", 2023-01-20: https://steamcommunity.com/games/1206560/announcements/detail/3672156687251117721

**Community wiki** (Fandom, "The Official Worldbox Wiki", player-maintained; read through `https://the-official-worldbox-wiki.fandom.com/api.php`; revision IDs in parentheses)

- [W-Main] (rev 22905): https://the-official-worldbox-wiki.fandom.com/wiki/The_Official_Worldbox_Wiki
- [W-MapCreation] (23237): https://the-official-worldbox-wiki.fandom.com/wiki/Map_Creation
- [W-MapInstall] (22899): https://the-official-worldbox-wiki.fandom.com/wiki/Map_Installation_and_Uploading
- [W-Biomes] (22818): https://the-official-worldbox-wiki.fandom.com/wiki/Category:Biomes
- [W-Powers] (22581): https://the-official-worldbox-wiki.fandom.com/wiki/Powers
- [W-Subspecies] (21202): https://the-official-worldbox-wiki.fandom.com/wiki/Subspecies
- [W-SubTraits] (23068): https://the-official-worldbox-wiki.fandom.com/wiki/Subspecies_Traits
- [W-Genes] (22502): https://the-official-worldbox-wiki.fandom.com/wiki/Gene_Editor
- [W-Genomes] (22193): https://the-official-worldbox-wiki.fandom.com/wiki/Creature_Genomes_and_Stats
- [W-Repro] (23232): https://the-official-worldbox-wiki.fandom.com/wiki/Reproduction
- [W-Monolith] (22205): https://the-official-worldbox-wiki.fandom.com/wiki/Monolith_and_Evolution
- [W-Taxonomy] (22255): https://the-official-worldbox-wiki.fandom.com/wiki/Creature_Taxonomy_and_Collectives
- [W-Families] (23034): https://the-official-worldbox-wiki.fandom.com/wiki/Families
- [W-Clans] (23220): https://the-official-worldbox-wiki.fandom.com/wiki/Clans
- [W-Kings] (23242): https://the-official-worldbox-wiki.fandom.com/wiki/Kings_and_Leaders
- [W-Languages] (21005): https://the-official-worldbox-wiki.fandom.com/wiki/Languages
- [W-Cultures] (22902): https://the-official-worldbox-wiki.fandom.com/wiki/Cultures
- [W-CultureTraits] (23223): https://the-official-worldbox-wiki.fandom.com/wiki/Culture_Traits
- [W-CultureDev] (21067, marked "old feature"): https://the-official-worldbox-wiki.fandom.com/wiki/Culture_Development
- [W-Religions] (23166): https://the-official-worldbox-wiki.fandom.com/wiki/Religions
- [W-Knowledge] (22308): https://the-official-worldbox-wiki.fandom.com/wiki/Knowledge
- [W-Ages] (22385): https://the-official-worldbox-wiki.fandom.com/wiki/Ages
- [W-Economy] (22956): https://the-official-worldbox-wiki.fandom.com/wiki/Economy
- [W-Trading] (19078, marked old): https://the-official-worldbox-wiki.fandom.com/wiki/Trading_Mechanics
- [W-Markets] (21661): https://the-official-worldbox-wiki.fandom.com/wiki/Markets
- [W-Crafting] (22236): https://the-official-worldbox-wiki.fandom.com/wiki/Equipment_Crafting
- [W-Equipment] (23233): https://the-official-worldbox-wiki.fandom.com/wiki/Equipment
- [W-Armies] (22888): https://the-official-worldbox-wiki.fandom.com/wiki/Armies
- [W-War] (23241): https://the-official-worldbox-wiki.fandom.com/wiki/War
- [W-Alliances] (21073): https://the-official-worldbox-wiki.fandom.com/wiki/Alliances
- [W-Kingdoms] (21745): https://the-official-worldbox-wiki.fandom.com/wiki/Kingdoms
- [W-KTraits] (21616): https://the-official-worldbox-wiki.fandom.com/wiki/Kingdom_Traits
- [W-Opinions] (23184): https://the-official-worldbox-wiki.fandom.com/wiki/Kingdom_Opinions
- [W-Loyalty] (23163): https://the-official-worldbox-wiki.fandom.com/wiki/Loyalty
- [W-Rebellions] (23156): https://the-official-worldbox-wiki.fandom.com/wiki/Rebellions
- [W-Plots] (23243): https://the-official-worldbox-wiki.fandom.com/wiki/Plots
- [W-Books] (23182): https://the-official-worldbox-wiki.fandom.com/wiki/Books
- [W-Laws] (23227): https://the-official-worldbox-wiki.fandom.com/wiki/World_Laws
- [W-History] (22328): https://the-official-worldbox-wiki.fandom.com/wiki/World_History
- [W-Stats] (23048): https://the-official-worldbox-wiki.fandom.com/wiki/World_and_Game_Statistics
- [W-Debug] (23064): https://the-official-worldbox-wiki.fandom.com/wiki/Debug_Menu
- [W-Disasters] (22398): https://the-official-worldbox-wiki.fandom.com/wiki/Disasters
- [W-Neurons] (22821): https://the-official-worldbox-wiki.fandom.com/wiki/Neurons
- [W-Happiness] (23222): https://the-official-worldbox-wiki.fandom.com/wiki/Happiness
- [W-Plague] (23070): https://the-official-worldbox-wiki.fandom.com/wiki/Plague
- [W-Diseases] (23130): https://the-official-worldbox-wiki.fandom.com/wiki/Diseases

[CL]: https://superworldbox.com/changelog
[FAQ]: https://superworldbox.com/faq
[HOME]: https://superworldbox.com/
[STEAM]: https://store.steampowered.com/app/1206560/WorldBox__God_Simulator/
[SNEWS]: https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=1206560&count=100&maxlength=0
[S-MetaControl]: https://steamcommunity.com/games/1206560/announcements/detail/669491979075191190
[S-ArmyBox]: https://steamcommunity.com/games/1206560/announcements/detail/523101526048114584
[S-0505]: https://steamcommunity.com/games/1206560/announcements/detail/523093274068519301
[S-Beta050]: https://steamcommunity.com/games/1206560/announcements/detail/523086940514289535
[S-050Announce]: https://steamcommunity.com/games/1206560/announcements/detail/509574242369537673
[S-Religions]: https://steamcommunity.com/games/1206560/announcements/detail/503942206557519978
[S-Languages]: https://steamcommunity.com/games/1206560/announcements/detail/4453592738017838143
[S-Clans2024]: https://steamcommunity.com/games/1206560/announcements/detail/4545912358019453883
[S-Cultures2024]: https://steamcommunity.com/games/1206560/announcements/detail/4372517795037234445
[S-Families]: https://steamcommunity.com/games/1206560/announcements/detail/3890611710917417279
[S-Subspecies]: https://steamcommunity.com/games/1206560/announcements/detail/3905246507035128779
[S-Ages]: https://steamcommunity.com/games/1206560/announcements/detail/3691300790682839632
[S-Diplomacy]: https://steamcommunity.com/games/1206560/announcements/detail/3631627017371418796
[S-Alliances]: https://steamcommunity.com/games/1206560/announcements/detail/3631626193502166546
[S-Wars]: https://steamcommunity.com/games/1206560/announcements/detail/3672157322353811983
[S-Clans2023]: https://steamcommunity.com/games/1206560/announcements/detail/3672156687251117721
[W-Main]: https://the-official-worldbox-wiki.fandom.com/wiki/The_Official_Worldbox_Wiki
[W-MapCreation]: https://the-official-worldbox-wiki.fandom.com/wiki/Map_Creation
[W-MapInstall]: https://the-official-worldbox-wiki.fandom.com/wiki/Map_Installation_and_Uploading
[W-Biomes]: https://the-official-worldbox-wiki.fandom.com/wiki/Category:Biomes
[W-Powers]: https://the-official-worldbox-wiki.fandom.com/wiki/Powers
[W-Subspecies]: https://the-official-worldbox-wiki.fandom.com/wiki/Subspecies
[W-SubTraits]: https://the-official-worldbox-wiki.fandom.com/wiki/Subspecies_Traits
[W-Genes]: https://the-official-worldbox-wiki.fandom.com/wiki/Gene_Editor
[W-Genomes]: https://the-official-worldbox-wiki.fandom.com/wiki/Creature_Genomes_and_Stats
[W-Repro]: https://the-official-worldbox-wiki.fandom.com/wiki/Reproduction
[W-Monolith]: https://the-official-worldbox-wiki.fandom.com/wiki/Monolith_and_Evolution
[W-Taxonomy]: https://the-official-worldbox-wiki.fandom.com/wiki/Creature_Taxonomy_and_Collectives
[W-Families]: https://the-official-worldbox-wiki.fandom.com/wiki/Families
[W-Clans]: https://the-official-worldbox-wiki.fandom.com/wiki/Clans
[W-Kings]: https://the-official-worldbox-wiki.fandom.com/wiki/Kings_and_Leaders
[W-Languages]: https://the-official-worldbox-wiki.fandom.com/wiki/Languages
[W-Cultures]: https://the-official-worldbox-wiki.fandom.com/wiki/Cultures
[W-CultureTraits]: https://the-official-worldbox-wiki.fandom.com/wiki/Culture_Traits
[W-CultureDev]: https://the-official-worldbox-wiki.fandom.com/wiki/Culture_Development
[W-Religions]: https://the-official-worldbox-wiki.fandom.com/wiki/Religions
[W-Knowledge]: https://the-official-worldbox-wiki.fandom.com/wiki/Knowledge
[W-Ages]: https://the-official-worldbox-wiki.fandom.com/wiki/Ages
[W-Economy]: https://the-official-worldbox-wiki.fandom.com/wiki/Economy
[W-Trading]: https://the-official-worldbox-wiki.fandom.com/wiki/Trading_Mechanics
[W-Markets]: https://the-official-worldbox-wiki.fandom.com/wiki/Markets
[W-Crafting]: https://the-official-worldbox-wiki.fandom.com/wiki/Equipment_Crafting
[W-Equipment]: https://the-official-worldbox-wiki.fandom.com/wiki/Equipment
[W-Armies]: https://the-official-worldbox-wiki.fandom.com/wiki/Armies
[W-War]: https://the-official-worldbox-wiki.fandom.com/wiki/War
[W-Alliances]: https://the-official-worldbox-wiki.fandom.com/wiki/Alliances
[W-Kingdoms]: https://the-official-worldbox-wiki.fandom.com/wiki/Kingdoms
[W-KTraits]: https://the-official-worldbox-wiki.fandom.com/wiki/Kingdom_Traits
[W-Opinions]: https://the-official-worldbox-wiki.fandom.com/wiki/Kingdom_Opinions
[W-Loyalty]: https://the-official-worldbox-wiki.fandom.com/wiki/Loyalty
[W-Rebellions]: https://the-official-worldbox-wiki.fandom.com/wiki/Rebellions
[W-Plots]: https://the-official-worldbox-wiki.fandom.com/wiki/Plots
[W-Books]: https://the-official-worldbox-wiki.fandom.com/wiki/Books
[W-Laws]: https://the-official-worldbox-wiki.fandom.com/wiki/World_Laws
[W-History]: https://the-official-worldbox-wiki.fandom.com/wiki/World_History
[W-Stats]: https://the-official-worldbox-wiki.fandom.com/wiki/World_and_Game_Statistics
[W-Debug]: https://the-official-worldbox-wiki.fandom.com/wiki/Debug_Menu
[W-Disasters]: https://the-official-worldbox-wiki.fandom.com/wiki/Disasters
[W-Neurons]: https://the-official-worldbox-wiki.fandom.com/wiki/Neurons
[W-Happiness]: https://the-official-worldbox-wiki.fandom.com/wiki/Happiness
[W-Plague]: https://the-official-worldbox-wiki.fandom.com/wiki/Plague
[W-Diseases]: https://the-official-worldbox-wiki.fandom.com/wiki/Diseases
