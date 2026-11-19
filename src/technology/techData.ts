/**
 * EPOCH technology dependency graph (data).
 *
 * Eras are descriptive groupings. Costs follow ~40 * 1.9^(era-1) * k so that
 * later eras need far larger research output (populations, education and
 * institutions grow by orders of magnitude). Realism: eras 1-11 historical;
 * 12-13 plausible (NOT inevitable — e.g. commercial fusion may never succeed in
 * reality); 14 mixed; 15 speculative (only with the speculative-tech law and
 * the "unrestricted" realism mode).
 *
 * `requires.features` means AT LEAST ONE listed feature must exist in the
 * civ's territory. `requires.resources` must ALL be accessible (own extraction
 * or imports) for adoption to progress.
 */
import type { TechDef, TechCategory, Caps, TechRequirement, Realism } from './types';
import type { BuildingKey } from '../civilizations/buildingTypes';

interface Opt {
  k?: number;
  req?: TechRequirement;
  unlock?: BuildingKey[];
  ay?: number;
  adv?: boolean;
  realism?: Realism;
}

const list: TechDef[] = [];

function t(id: string, name: string, era: number, category: TechCategory, prereqs: string[], effects: Partial<Caps>, description: string, o: Opt = {}): void {
  const cost = prereqs.length === 0 && era === 1 && (o.k ?? 1) === 0 ? 0 : Math.round(40 * Math.pow(1.9, era - 1) * (o.k ?? 1));
  list.push({
    id,
    name,
    era,
    category,
    prereqs,
    cost,
    realism: o.realism ?? (era <= 11 ? 'historical' : era <= 13 ? 'plausible' : era === 14 ? 'plausible' : 'speculative'),
    advancedWeapon: o.adv,
    requires: o.req,
    effects,
    unlocks: o.unlock ? { buildings: o.unlock } : undefined,
    adoptionYears: o.ay ?? Math.round(6 + era * 2.2),
    description,
  });
}

// ===================================================================== Era 1 — Prehistoric
t('fire_control', 'Control of Fire', 1, 'subsistence', [], { forage: 0.1, culturalOutput: 0.05 }, 'Cooking and warmth widen the foods people can eat and the lands they can live in.', { k: 0 });
t('stone_tools', 'Stone Tools', 1, 'materials', [], { forage: 0.1 }, 'Knapped flint and stone blades for cutting, scraping and hunting.', { k: 0 });
t('foraging', 'Foraging Lore', 1, 'subsistence', [], { forage: 0.2 }, 'Knowledge of edible plants, seasons and water sources.', { k: 0 });
t('organized_hunting', 'Organized Hunting', 1, 'subsistence', ['stone_tools'], { forage: 0.25, landTier: 1, militaryAttack: 0.05 }, 'Spears and cooperative hunts bring down large game — and arm the first warriors.', { k: 0.8 });
t('shelter', 'Shelter Building', 1, 'subsistence', ['stone_tools'], { housingTier: 1 }, 'Pole-and-thatch huts replace tents, letting groups stay longer in one place.', { k: 0.8, unlock: ['HUT'] });
t('fishing', 'Fishing', 1, 'subsistence', ['foraging'], { fishing: 1, forage: 0.1 }, 'Nets, hooks and weirs make rivers and coasts reliable food sources.', { k: 0.9, req: { features: ['coast', 'river'] }, unlock: ['FISHERY'] });
t('rafts', 'Rafts and Canoes', 1, 'maritime', ['fishing'], { navalTier: 1 }, 'Simple boats for crossing rivers and hugging coastlines.', { k: 1, req: { features: ['coast', 'river'] } });
t('spirituality', 'Spirituality', 1, 'culture', ['fire_control'], { culturalOutput: 0.1 }, 'Ritual, burial and sacred places bind communities together.', { k: 0.8, unlock: ['TEMPLE', 'MONUMENT'] });
t('oral_tradition', 'Oral Tradition', 1, 'culture', ['fire_control'], { culturalOutput: 0.1, research: 0.05 }, 'Stories, songs and genealogies carry knowledge across generations.', { k: 0.8 });
t('herbal_remedies', 'Herbal Remedies', 1, 'medicine', ['foraging'], { healthcare: 0.04, infantCare: 0.03 }, 'Healers learn which plants soothe illness and wounds.', { k: 1 });
t('tribal_council', 'Tribal Council', 1, 'civic', ['oral_tradition'], { adminCapacity: 0.1 }, 'Elders deliberate together; disputes are settled by custom.', { k: 1 });
t('tracking', 'Animal Tracking', 1, 'subsistence', ['organized_hunting'], { forage: 0.15, intelligence: 0.05 }, 'Reading signs of game also teaches scouts to read the land.', { k: 1.1 });

// ===================================================================== Era 2 — Agricultural
t('agriculture', 'Agriculture', 2, 'agriculture', ['foraging', 'stone_tools'], { farming: 1 }, 'Sowing and harvesting crops supports far denser populations than foraging.', { k: 1, unlock: ['FARM'] });
t('domestication', 'Animal Domestication', 2, 'agriculture', ['agriculture', 'tracking'], { herding: 1, forage: 0.05 }, 'Tamed goats, sheep and cattle provide meat, milk, wool and draft power — only where suitable wild animals live.', { k: 1, req: { features: ['domesticable'] }, unlock: ['PASTURE'] });
t('pottery', 'Pottery', 2, 'materials', ['fire_control', 'agriculture'], { foodPreservation: 0.12, crafts: 0.1 }, 'Fired clay vessels store grain and water and become the first manufactured goods.', { k: 0.9, unlock: ['WORKSHOP'] });
t('food_storage', 'Food Storage', 2, 'agriculture', ['pottery'], { foodPreservation: 0.18 }, 'Granaries buffer harvests against lean years.', { k: 1, unlock: ['GRANARY'] });
t('weaving', 'Weaving', 2, 'materials', ['agriculture'], { crafts: 0.12 }, 'Spun fibre and woven cloth create clothing and trade goods.', { k: 0.9 });
t('mudbrick', 'Mudbrick Construction', 2, 'materials', ['shelter', 'agriculture'], { housingTier: 2 }, 'Sun-dried bricks make durable permanent houses.', { k: 1, unlock: ['HOUSE'] });
t('carpentry', 'Carpentry', 2, 'materials', ['shelter'], { woodcutting: 0.25, construction: 0.1 }, 'Axes and joinery turn forests into timber.', { k: 0.9, unlock: ['LUMBER'] });
t('masonry', 'Masonry', 2, 'materials', ['mudbrick'], { quarrying: 1, construction: 0.1, fortification: 1 }, 'Cut stone for walls, foundations and monuments.', { k: 1.2, unlock: ['QUARRY'] });
t('palisades', 'Palisades', 2, 'military', ['carpentry'], { fortification: 1, militaryDefense: 0.1 }, 'Timber walls protect villages from raids.', { k: 0.9, unlock: ['WALL'] });
t('irrigation', 'Irrigation', 2, 'agriculture', ['agriculture'], { irrigation: 1, farming: 0.15 }, 'Canals bring river water to dry fields.', { k: 1.2, req: { features: ['river'] } });
t('sailing', 'Sailing', 2, 'maritime', ['rafts', 'weaving'], { navalTier: 2, fishing: 0.2, tradeEfficiency: 0.04 }, 'Sails let boats travel along coasts and carry cargo.', { k: 1.2, req: { features: ['coast', 'river'] }, unlock: ['HARBOR'] });
t('chieftainship', 'Chieftainship', 2, 'civic', ['tribal_council'], { adminCapacity: 0.2 }, 'A paramount chief commands several villages; a seat of power emerges.', { k: 1, unlock: ['PALACE'] });
t('barter', 'Barter Networks', 2, 'economy', ['pottery'], { markets: 0.1, tradeEfficiency: 0.04, roadTier: 1 }, 'Regular exchange of surplus goods along well-worn trails.', { k: 1 });
t('ancestor_cults', 'Ancestor Veneration', 2, 'culture', ['spirituality'], { culturalOutput: 0.1 }, 'Lineages and shrines tie families to land and to each other.', { k: 0.9 });

// ===================================================================== Era 3 — Bronze & early urban
t('mining', 'Mining', 3, 'materials', ['masonry'], { mining: 1 }, 'Shafts and adits reach copper, tin, gold and other ores.', { k: 0.9, unlock: ['MINE'] });
t('copper_working', 'Copper Working', 3, 'materials', ['pottery', 'mining'], { metalTier: 1, crafts: 0.1, landTier: 1 }, 'Smelted copper makes the first metal tools — wherever copper can be obtained.', { k: 0.9, req: { resources: ['COPPER'] }, unlock: ['SMITHY'] });
t('bronze_working', 'Bronze Working', 3, 'materials', ['copper_working'], { metalTier: 2, landTier: 2, militaryAttack: 0.1, crafts: 0.1 }, 'Alloying copper with tin; scarce tin drives long-distance trade.', { k: 1.1, req: { resources: ['COPPER', 'TIN'] } });
t('writing', 'Writing', 3, 'science', ['chieftainship', 'pottery'], { literacy: 0.05, adminCapacity: 0.4, research: 0.2, communication: 0.2, culturalOutput: 0.1 }, 'Records of harvests, laws and myths; knowledge no longer dies with its keepers.', { k: 1, req: { minPopulation: 300 }, unlock: ['LIBRARY'] });
t('mathematics', 'Mathematics', 3, 'science', ['writing'], { research: 0.2, construction: 0.1, taxEfficiency: 0.1 }, 'Counting, measurement and geometry for building, trade and taxes.', { k: 1 });
t('the_wheel', 'The Wheel', 3, 'transport', ['carpentry', 'barter'], { landSpeed: 0.1, logistics: 0.1, tradeEfficiency: 0.05 }, 'Carts and potter\'s wheels.', { k: 1 });
t('code_of_laws', 'Code of Laws', 3, 'civic', ['writing'], { adminCapacity: 0.3, ruleOfLaw: 0.2 }, 'Written laws make justice predictable and the state stronger.', { k: 1, req: { minPopulation: 1000 } });
t('priesthood', 'Priesthood', 3, 'culture', ['ancestor_cults', 'writing'], { culturalOutput: 0.15, adminCapacity: 0.1 }, 'Professional clergy keep calendars, temples and sacred texts.', { k: 0.9 });
t('currency', 'Currency', 3, 'economy', ['barter', 'copper_working'], { currency: 1, markets: 0.2, taxEfficiency: 0.1 }, 'Standard tokens of value make markets and taxation easier.', { k: 1, unlock: ['MARKET'] });
t('horseback_riding', 'Horseback Riding', 3, 'military', ['domestication'], { cavalry: 1, landSpeed: 0.15, mobility: 0.2 }, 'Riding horses transforms travel and war — only where horses can be obtained.', { k: 1, req: { features: ['horses'], resources: ['HORSES'] } });
t('chariots', 'Chariots', 3, 'military', ['the_wheel', 'horseback_riding'], { militaryAttack: 0.12, mobility: 0.1 }, 'Fast war wagons dominate open battlefields.', { k: 1, req: { resources: ['HORSES'] } });
t('standing_army', 'Standing Army', 3, 'military', ['bronze_working', 'code_of_laws'], { militaryAttack: 0.1, militaryDefense: 0.1, adminCapacity: 0.1 }, 'Professional soldiers paid by the state.', { k: 1, unlock: ['BARRACKS'] });
t('astronomy', 'Astronomy', 3, 'science', ['mathematics', 'priesthood'], { research: 0.15, farming: 0.05 }, 'Calendars predict floods and seasons.', { k: 1.1 });
t('urban_planning', 'Urban Planning', 3, 'civic', ['mathematics', 'mudbrick'], { urbanCapacity: 0.2, construction: 0.1, sanitation: 0.05 }, 'Streets, drains and districts for the first cities.', { k: 1.1, unlock: ['PARK'] });

// ===================================================================== Era 4 — Iron & classical
t('iron_working', 'Iron Working', 4, 'materials', ['bronze_working'], { metalTier: 3, landTier: 3, farming: 0.1, militaryAttack: 0.1 }, 'Abundant iron makes tools and weapons cheap — if iron ore is available.', { k: 1, req: { resources: ['IRON'] } });
t('alphabet', 'Alphabet', 4, 'communication', ['writing'], { literacy: 0.05, communication: 0.1, research: 0.1 }, 'A few dozen letters make literacy far easier to acquire.', { k: 0.9 });
t('philosophy', 'Philosophy', 4, 'science', ['alphabet', 'astronomy'], { research: 0.3, culturalOutput: 0.1, literacy: 0.03 }, 'Systematic inquiry into nature, ethics and government.', { k: 1 });
t('literature', 'Literature', 4, 'culture', ['alphabet'], { culturalOutput: 0.2, literacy: 0.05 }, 'Epics, histories and drama spread a shared culture.', { k: 0.9 });
t('engineering', 'Engineering', 4, 'science', ['mathematics', 'masonry'], { construction: 0.2, sanitation: 0.15, urbanCapacity: 0.2 }, 'Arches, aqueducts and arenas.', { k: 1.1, unlock: ['AQUEDUCT', 'ARENA'] });
t('roads', 'Paved Roads', 4, 'transport', ['engineering', 'the_wheel'], { roadTier: 2, landSpeed: 0.2, logistics: 0.2, tradeEfficiency: 0.08, communication: 0.3, adminCapacity: 0.2 }, 'Stone roads knit provinces together for trade, armies and messengers.', { k: 1.1 });
t('fortifications', 'Fortifications', 4, 'military', ['masonry', 'standing_army'], { fortification: 2, militaryDefense: 0.15 }, 'Stone walls and towers.', { k: 1, unlock: ['FORT'] });
t('siege_engines', 'Siege Engines', 4, 'military', ['engineering', 'standing_army'], { siege: 0.3 }, 'Catapults and rams breach walls.', { k: 1 });
t('coinage', 'Coinage', 4, 'economy', ['currency', 'iron_working'], { markets: 0.2, taxEfficiency: 0.15, tradeEfficiency: 0.04 }, 'Minted coins of guaranteed weight.', { k: 0.9, req: { anyResources: ['GOLD', 'COPPER', 'METAL'] } });
t('bureaucracy', 'Bureaucracy', 4, 'civic', ['code_of_laws', 'alphabet'], { adminCapacity: 0.5, taxEfficiency: 0.15, ruleOfLaw: 0.1 }, 'Salaried officials, censuses and archives extend the reach of the state.', { k: 1.1, req: { minPopulation: 5000 } });
t('republicanism', 'Republicanism', 4, 'civic', ['philosophy', 'code_of_laws'], { participation: 0.5, ruleOfLaw: 0.1 }, 'Citizens elect magistrates and debate in assemblies.', { k: 1 });
t('classical_medicine', 'Classical Medicine', 4, 'medicine', ['herbal_remedies', 'philosophy'], { healthcare: 0.07, infantCare: 0.05, lifespan: 0.03 }, 'Physicians observe, record and treat illness.', { k: 1, unlock: ['HOSPITAL'] });
t('shipbuilding', 'Shipbuilding', 4, 'maritime', ['sailing', 'carpentry'], { navalTier: 3, navalPower: 0.2, tradeEfficiency: 0.05 }, 'Keeled sailing ships and war galleys.', { k: 1, req: { features: ['coast'] } });
t('postal_relay', 'Postal Relays', 4, 'communication', ['roads', 'horseback_riding'], { communication: 0.3, adminCapacity: 0.2 }, 'Mounted couriers carry orders across an empire in days.', { k: 0.9 });
t('cavalry_tactics', 'Cavalry Tactics', 4, 'military', ['horseback_riding', 'iron_working'], { mobility: 0.15, militaryAttack: 0.1 }, 'Disciplined horsemen screen, flank and pursue.', { k: 1, req: { resources: ['HORSES'] } });

// ===================================================================== Era 5 — Medieval & feudal
t('feudalism', 'Feudalism', 5, 'civic', ['bureaucracy', 'fortifications'], { adminCapacity: 0.2, militaryDefense: 0.1 }, 'Land in return for military service; local lords hold castles.', { k: 1 });
t('heavy_plow', 'Heavy Plow', 5, 'agriculture', ['iron_working', 'domestication'], { farming: 0.25, farmMechanization: 0.1 }, 'Iron ploughs turn heavy fertile soils.', { k: 1 });
t('crop_rotation', 'Crop Rotation', 5, 'agriculture', ['heavy_plow'], { farming: 0.2, farmMechanization: 0.05 }, 'Three-field rotation keeps soils fertile.', { k: 1 });
t('castles', 'Castles', 5, 'military', ['feudalism'], { fortification: 3, militaryDefense: 0.2 }, 'Stone keeps and curtain walls.', { k: 1 });
t('stirrup', 'Stirrup and Heavy Cavalry', 5, 'military', ['cavalry_tactics', 'feudalism'], { landTier: 4, militaryAttack: 0.15 }, 'Armoured knights dominate battlefields.', { k: 1, req: { resources: ['HORSES'] } });
t('guilds', 'Guilds', 5, 'economy', ['coinage', 'urban_planning'], { crafts: 0.2, housingTier: 3, markets: 0.15 }, 'Craft associations train apprentices and build dense town quarters.', { k: 1, unlock: ['TOWNHOUSE'] });
t('watermills', 'Water and Windmills', 5, 'energy', ['engineering'], { energyTier: 1, crafts: 0.15, farming: 0.05 }, 'Mechanical power for grinding, sawing and fulling.', { k: 1, unlock: ['MILL'] });
t('monasticism', 'Monasticism', 5, 'culture', ['priesthood', 'literature'], { literacy: 0.03, research: 0.1, culturalOutput: 0.1 }, 'Monasteries preserve books and learning.', { k: 0.9 });
t('universities', 'Universities', 5, 'science', ['philosophy', 'monasticism'], { research: 0.4, literacy: 0.05 }, 'Corporations of scholars teach law, medicine and natural philosophy.', { k: 1.1, req: { minPopulation: 20000 }, unlock: ['UNIVERSITY'] });
t('banking', 'Banking', 5, 'economy', ['guilds', 'mathematics'], { banking: 1, finance: 0.2, markets: 0.1 }, 'Deposits, loans and bills of exchange; states can borrow.', { k: 1.1, unlock: ['BANK'] });
t('compass', 'Magnetic Compass', 5, 'maritime', ['shipbuilding', 'astronomy'], { tradeEfficiency: 0.06, navalPower: 0.05 }, 'Reliable bearings at sea.', { k: 0.9 });
t('crossbows', 'Crossbows', 5, 'military', ['iron_working', 'mathematics'], { militaryAttack: 0.12, militaryDefense: 0.08 }, 'Powerful missile weapons for townsmen and garrisons.', { k: 0.9 });
t('steelmaking', 'Crucible Steel', 5, 'materials', ['iron_working', 'watermills'], { metalTier: 4, crafts: 0.1 }, 'High-quality steel for tools and blades.', { k: 1.1, req: { resources: ['IRON'] } });
t('heraldry_chivalry', 'Chivalric Codes', 5, 'culture', ['feudalism', 'literature'], { culturalOutput: 0.1 }, 'Courtly culture, tournaments and codes of conduct.', { k: 0.8 });

// ===================================================================== Era 6 — Renaissance & exploration
t('printing', 'Printing Press', 6, 'communication', ['universities', 'steelmaking'], { literacy: 0.15, research: 0.4, mediaReach: 0.3, communication: 0.5, culturalOutput: 0.2 }, 'Cheap books spread literacy, science and dissent.', { k: 1 });
t('gunpowder', 'Gunpowder', 6, 'military', ['crossbows', 'steelmaking'], { landTier: 5, siege: 0.3, militaryAttack: 0.15 }, 'Pike-and-shot armies and siege cannon make old walls obsolete.', { k: 1 });
t('muskets', 'Muskets and Linear Tactics', 6, 'military', ['gunpowder'], { landTier: 6, militaryAttack: 0.12 }, 'Drilled musketeers firing in volleys.', { k: 1.1 });
t('bastion_forts', 'Bastion Fortresses', 6, 'military', ['gunpowder', 'castles'], { fortification: 4, militaryDefense: 0.15 }, 'Angled star forts resist cannon.', { k: 1 });
t('navigation', 'Ocean Navigation', 6, 'maritime', ['compass', 'astronomy', 'shipbuilding'], { navalTier: 4, tradeEfficiency: 0.08, navalPower: 0.15 }, 'Ocean-going ships and charts open distant shores to trade and colonies.', { k: 1.2, req: { features: ['coast'] } });
t('cartography', 'Cartography', 6, 'science', ['navigation', 'printing'], { intelligence: 0.1, logistics: 0.1 }, 'Accurate maps of coasts and continents.', { k: 0.9 });
t('double_entry', 'Double-Entry Bookkeeping', 6, 'economy', ['banking', 'printing'], { finance: 0.15, taxEfficiency: 0.1, adminCapacity: 0.3 }, 'Rigorous accounts for merchants and treasuries.', { k: 0.9 });
t('joint_stock', 'Joint-Stock Companies', 6, 'economy', ['double_entry', 'navigation'], { finance: 0.3, markets: 0.25, tradeEfficiency: 0.05 }, 'Pooled capital finances voyages and enterprises.', { k: 1.1 });
t('scientific_method', 'Scientific Method', 6, 'science', ['printing', 'philosophy'], { research: 0.8, diffusion: 0.2 }, 'Experiment and peer correspondence accelerate discovery.', { k: 1.2, req: { minPopulation: 50000 } });
t('optics', 'Optics', 6, 'science', ['scientific_method'], { research: 0.2, navalPower: 0.05, intelligence: 0.05 }, 'Lenses, telescopes and microscopes.', { k: 0.9 });
t('anatomy', 'Anatomy', 6, 'medicine', ['classical_medicine', 'scientific_method'], { healthcare: 0.05, infantCare: 0.04 }, 'Dissection and observation correct ancient errors.', { k: 1 });
t('humanism', 'Humanism and Schools', 6, 'culture', ['printing'], { literacy: 0.1, culturalOutput: 0.15 }, 'Grammar schools and classical learning spread beyond the clergy.', { k: 1, unlock: ['SCHOOL'] });
t('constitutionalism', 'Constitutionalism', 6, 'civic', ['republicanism', 'printing'], { participation: 0.3, ruleOfLaw: 0.2, adminCapacity: 0.2 }, 'Written constitutions and parliaments limit rulers.', { k: 1 });
t('centralized_state', 'Centralized State', 6, 'civic', ['double_entry', 'bureaucracy'], { adminCapacity: 0.4, taxEfficiency: 0.15 }, 'Standing administrations, standardized taxes and censuses.', { k: 1 });
t('colonial_agriculture', 'Plantation Agriculture', 6, 'agriculture', ['navigation', 'crop_rotation'], { farming: 0.1 }, 'Cash crops grown for distant markets.', { k: 0.9, unlock: ['PLANTATION'] });
t('espionage', 'Espionage', 6, 'military', ['centralized_state', 'cartography'], { intelligence: 0.3 }, 'Spies, ciphers and diplomatic intelligence.', { k: 0.9 });
t('shaft_mining', 'Shaft Mining and Coal', 6, 'materials', ['mining', 'watermills'], { deepMining: 1, mining: 0.2 }, 'Deep shafts drained by pumps reach coal seams and rich ores.', { k: 1 });

// ===================================================================== Era 7 — Early industrial
t('steam_engine', 'Steam Engine', 7, 'energy', ['shaft_mining', 'scientific_method'], { energyTier: 2, deepMining: 0.3, crafts: 0.2 }, 'Coal-fired engines pump mines and power machines — only with coal and iron.', { k: 1.1, req: { resources: ['COAL', 'IRON'] } });
t('factory_system', 'Factory System', 7, 'industry', ['steam_engine', 'weaving'], { industry: 1, automation: 0.05, housingTier: 4, urbanCapacity: 0.3 }, 'Mechanized mills and factories; workers crowd into new industrial quarters.', { k: 1.1, unlock: ['FACTORY', 'TENEMENT'] });
t('coke_smelting', 'Coke Smelting', 7, 'materials', ['steam_engine', 'steelmaking'], { metalTier: 4, industry: 0.2 }, 'Coal coke replaces charcoal; iron becomes cheap and plentiful.', { k: 0.9, req: { resources: ['COAL', 'IRON'] } });
t('railways', 'Railways', 7, 'transport', ['steam_engine', 'coke_smelting'], { railTier: 1, landSpeed: 0.5, logistics: 0.4, tradeEfficiency: 0.15, mobility: 0.2, adminCapacity: 0.2 }, 'Iron rails move goods, people and armies at unheard-of speeds.', { k: 1.2, req: { resources: ['COAL', 'IRON'] }, ay: 45, unlock: ['STATION', 'WAREHOUSE'] });
t('steamships', 'Steamships', 7, 'maritime', ['steam_engine', 'navigation'], { navalTier: 5, tradeEfficiency: 0.1, navalPower: 0.2 }, 'Ships no longer wait for the wind.', { k: 1, req: { resources: ['COAL'] } });
t('vaccination', 'Vaccination', 7, 'medicine', ['anatomy', 'scientific_method'], { healthcare: 0.1, infantCare: 0.2, diseaseControl: 0.2 }, 'Immunization prevents smallpox-like epidemics.', { k: 1 });
t('sanitation', 'Public Sanitation', 7, 'medicine', ['engineering', 'vaccination'], { sanitation: 0.4, diseaseControl: 0.15, healthcare: 0.05 }, 'Sewers and clean water end the urban death trap.', { k: 1.1 });
t('telegraph', 'Telegraph', 7, 'communication', ['railways', 'scientific_method'], { communication: 1, adminCapacity: 0.5, intelligence: 0.1 }, 'Messages cross continents in minutes.', { k: 1, req: { anyResources: ['COPPER', 'METAL'] } });
t('mass_education', 'Mass Education', 7, 'culture', ['humanism', 'printing'], { literacy: 0.3, research: 0.2 }, 'Compulsory schooling for all children.', { k: 1.1, ay: 40 });
t('rifles', 'Rifled Firearms', 7, 'military', ['muskets', 'coke_smelting'], { landTier: 7, militaryAttack: 0.15 }, 'Accurate rifles and breech-loaders.', { k: 1 });
t('political_economy', 'Political Economy', 7, 'economy', ['joint_stock', 'printing'], { markets: 0.2, finance: 0.1 }, 'Theories of markets, labour and trade shape policy.', { k: 0.9 });
t('seed_drill', 'Agricultural Revolution', 7, 'agriculture', ['crop_rotation', 'scientific_method'], { farming: 0.3, farmMechanization: 0.1 }, 'Selective breeding, seed drills and new rotations.', { k: 1 });
t('macadam_roads', 'Macadam Roads', 7, 'transport', ['roads', 'steam_engine'], { roadTier: 3, landSpeed: 0.1, logistics: 0.1 }, 'Graded, paved roads for carriages and freight.', { k: 0.9 });
t('mass_media', 'Mass-Circulation Newspapers', 7, 'communication', ['telegraph', 'mass_education'], { mediaReach: 0.5, culturalOutput: 0.2 }, 'Cheap daily papers shape public opinion.', { k: 0.9 });

// ===================================================================== Era 8 — Late industrial
t('electric_power', 'Electric Power', 8, 'energy', ['telegraph', 'steam_engine'], { electrification: 1, energyTier: 3, industry: 0.2 }, 'Generators and grids electrify factories and homes.', { k: 1.2, req: { anyResources: ['COPPER', 'METAL'] }, ay: 50, unlock: ['POWER_FOSSIL'] });
t('bessemer_steel', 'Industrial Steel', 8, 'materials', ['coke_smelting', 'railways'], { metalTier: 5, industry: 0.2, construction: 0.2 }, 'Mass-produced steel for rails, bridges and skyscraper frames.', { k: 1, req: { resources: ['IRON', 'COAL'] }, unlock: ['STEEL_MILL'] });
t('telephone', 'Telephone', 8, 'communication', ['electric_power'], { communication: 0.8, adminCapacity: 0.4 }, 'Voice over wires.', { k: 0.9 });
t('petroleum_drilling', 'Petroleum Drilling', 8, 'energy', ['steam_engine', 'bessemer_steel'], { oilExtraction: 1 }, 'Wells tap oil and gas deposits.', { k: 1, unlock: ['OIL_WELL'] });
t('refining', 'Petroleum Refining', 8, 'industry', ['petroleum_drilling'], { energyTier: 4, industry: 0.1 }, 'Kerosene, gasoline and lubricants, from crude oil or as synthetic fuel from coal.', { k: 1, req: { anyResources: ['OIL', 'COAL'] }, unlock: ['REFINERY'] });
t('internal_combustion', 'Internal Combustion Engine', 8, 'energy', ['refining'], { landSpeed: 0.2, logistics: 0.2 }, 'Light powerful engines burning oil.', { k: 1, req: { anyResources: ['OIL', 'COAL'] } });
t('automobiles', 'Automobiles', 8, 'transport', ['internal_combustion'], { landSpeed: 0.3, housingTier: 6, logistics: 0.2 }, 'Cars and trucks reshape cities; suburbs spread along roads.', { k: 1, req: { anyResources: ['OIL', 'COAL'] }, ay: 40, unlock: ['SUBURB'] });
t('assembly_line', 'Assembly Line', 8, 'industry', ['electric_power', 'bessemer_steel'], { industry: 0.4, automation: 0.1 }, 'Mass production makes consumer goods cheap.', { k: 1 });
t('chemical_fertilizer', 'Chemical Fertilizer', 8, 'agriculture', ['scientific_method', 'electric_power'], { farming: 1.4 }, 'Synthetic nitrogen dramatically raises yields.', { k: 1.1 });
t('germ_theory', 'Germ Theory', 8, 'medicine', ['vaccination', 'optics'], { healthcare: 0.15, infantCare: 0.2, diseaseControl: 0.2 }, 'Microbes cause disease; hygiene and antisepsis save millions.', { k: 1 });
t('reinforced_concrete', 'Reinforced Concrete', 8, 'materials', ['bessemer_steel'], { housingTier: 5, construction: 0.3 }, 'Steel-reinforced concrete allows tall, dense apartment blocks.', { k: 1, unlock: ['APARTMENT'] });
t('machine_guns', 'Machine Guns', 8, 'military', ['rifles', 'assembly_line'], { landTier: 8, militaryDefense: 0.2 }, 'Industrial firepower; trench warfare.', { k: 1 });
t('modern_fortification', 'Modern Fortification', 8, 'military', ['machine_guns', 'reinforced_concrete'], { fortification: 5, militaryDefense: 0.15 }, 'Concrete bunkers and defensive lines.', { k: 0.9 });
t('ironclads', 'Steel Navies', 8, 'military', ['steamships', 'bessemer_steel'], { navalPower: 0.3, navalTier: 5 }, 'Armoured steam warships and naval bases.', { k: 1, unlock: ['NAVAL_BASE'] });
t('labor_movement', 'Labour Movements', 8, 'civic', ['factory_system', 'mass_media'], { participation: 0.3, welfare: 0.2 }, 'Unions and workers\' parties demand rights and a voice.', { k: 0.9 });
t('universal_suffrage', 'Universal Suffrage', 8, 'civic', ['labor_movement', 'constitutionalism'], { participation: 0.5 }, 'All adults gain the vote.', { k: 1 });
t('industrial_research', 'Industrial Research Labs', 8, 'science', ['electric_power', 'mass_education'], { research: 0.8 }, 'Corporate and state laboratories turn science into products.', { k: 1.1, req: { minPopulation: 200000 }, unlock: ['LAB'] });
t('electric_rail', 'Electric Rail and Metros', 8, 'transport', ['electric_power', 'railways'], { railTier: 2, landSpeed: 0.1 }, 'Electric trains, trams and underground metros.', { k: 1 });

// ===================================================================== Era 9 — Early modern
t('flight', 'Powered Flight', 9, 'transport', ['internal_combustion', 'industrial_research'], { airTier: 1, mobility: 0.1 }, 'Aeroplanes for reconnaissance, mail and war.', { k: 1, req: { anyResources: ['OIL', 'COAL'] } });
t('military_aviation', 'Military Aviation', 9, 'military', ['flight'], { airPower: 0.4, militaryAttack: 0.1 }, 'Fighters and bombers; air bases.', { k: 1, unlock: ['AIRBASE'] });
t('commercial_aviation', 'Commercial Aviation', 9, 'transport', ['flight', 'radio'], { airTier: 2, tradeEfficiency: 0.05 }, 'Airliners and airports connect distant cities.', { k: 1, unlock: ['AIRPORT'] });
t('radio', 'Radio', 9, 'communication', ['telephone', 'industrial_research'], { communication: 1, mediaReach: 0.6, intelligence: 0.1 }, 'Broadcasts reach every household.', { k: 1 });
t('antibiotics', 'Antibiotics', 9, 'medicine', ['germ_theory', 'industrial_research'], { healthcare: 0.2, infantCare: 0.25, lifespan: 0.15, diseaseControl: 0.2 }, 'Penicillin and successors cure bacterial infections.', { k: 1.1 });
t('mechanized_agriculture', 'Mechanized Agriculture', 9, 'agriculture', ['internal_combustion', 'chemical_fertilizer'], { farmMechanization: 0.5, farming: 0.3 }, 'Tractors and harvesters: a few farmers feed whole cities.', { k: 1, ay: 35 });
t('armored_warfare', 'Armored Warfare', 9, 'military', ['machine_guns', 'internal_combustion'], { landTier: 9, mobility: 0.3, militaryAttack: 0.15 }, 'Tanks and motorized infantry.', { k: 1, unlock: ['MILITARY_BASE'] });
t('highways', 'Highways', 9, 'transport', ['automobiles', 'reinforced_concrete'], { roadTier: 4, landSpeed: 0.2, logistics: 0.2 }, 'Limited-access motorways.', { k: 1, ay: 35 });
t('skyscrapers', 'Skyscrapers', 9, 'materials', ['reinforced_concrete', 'electric_power'], { housingTier: 7, urbanCapacity: 0.4 }, 'Steel frames and elevators let cities grow upward.', { k: 1, unlock: ['TOWER'] });
t('plastics', 'Plastics', 9, 'industry', ['refining', 'industrial_research'], { industry: 0.2, crafts: 0.1 }, 'Cheap synthetic materials.', { k: 0.9, req: { resources: ['OIL'] } });
t('radar', 'Radar', 9, 'military', ['radio'], { intelligence: 0.2, airPower: 0.2, navalPower: 0.1 }, 'Detecting aircraft and ships beyond sight.', { k: 0.9 });
t('welfare_state', 'Welfare State', 9, 'civic', ['universal_suffrage', 'labor_movement'], { welfare: 1 }, 'Pensions, unemployment insurance and public health care.', { k: 1 });
t('central_banking', 'Central Banking', 9, 'economy', ['political_economy', 'banking'], { centralBanking: 1, finance: 0.3 }, 'A central bank manages money and credit (and can print it).', { k: 1 });
t('hydroelectricity', 'Hydroelectric Power', 9, 'energy', ['electric_power', 'reinforced_concrete'], { energyTier: 3 }, 'Dams turn rivers into electricity.', { k: 0.9, unlock: ['HYDRO'] });
t('corporate_finance', 'Corporate Finance', 9, 'economy', ['central_banking', 'telephone'], { finance: 0.3, markets: 0.2 }, 'Stock markets, corporate offices and central business districts.', { k: 1, unlock: ['OFFICE'] });
t('modern_contraception', 'Modern Contraception', 9, 'medicine', ['germ_theory', 'industrial_research'], { contraception: 0.35 }, 'Reliable family planning.', { k: 1 });
t('water_treatment', 'Water Treatment', 9, 'medicine', ['sanitation', 'germ_theory'], { sanitation: 0.3, diseaseControl: 0.1, infantCare: 0.05 }, 'Chlorinated piped water.', { k: 0.9 });
t('aircraft_carriers', 'Aircraft Carriers', 9, 'military', ['military_aviation', 'ironclads'], { navalPower: 0.3, airPower: 0.1, navalTier: 6 }, 'Floating airfields project power across oceans.', { k: 1 });

// ===================================================================== Era 10 — Atomic & space age
t('nuclear_fission', 'Nuclear Fission', 10, 'science', ['industrial_research', 'radio'], { uraniumMining: 1, research: 0.2 }, 'Splitting the atom.', { k: 1.1 });
t('nuclear_power', 'Nuclear Power', 10, 'energy', ['nuclear_fission', 'electric_power'], { nuclearPower: 1, energyTier: 5 }, 'Reactors generate vast electricity without combustion — if uranium is available.', { k: 1.1, req: { resources: ['URANIUM'] }, unlock: ['POWER_NUCLEAR'] });
t('nuclear_weapons', 'Nuclear Weapons', 10, 'military', ['nuclear_fission'], { nuclearWeapons: 1 }, 'Strategic weapons of mass destruction; deterrence and catastrophic risk.', { k: 1.3, adv: true, req: { resources: ['URANIUM'], minPopulation: 1000000 } });
t('jet_engines', 'Jet Engines', 10, 'transport', ['flight', 'bessemer_steel'], { airTier: 3, airPower: 0.3 }, 'Jet airliners and fighters.', { k: 1, req: { anyResources: ['OIL', 'COAL'] } });
t('rocketry', 'Rocketry', 10, 'space', ['jet_engines', 'nuclear_fission'], { spaceTier: 1, missiles: 0.3 }, 'Liquid-fuel rockets reach the edge of space.', { k: 1.1, req: { minPopulation: 1000000 }, unlock: ['SPACEPORT'] });
t('ballistic_missiles', 'Strategic Missiles', 10, 'military', ['rocketry', 'nuclear_weapons'], { missiles: 0.7 }, 'Intercontinental delivery of strategic weapons; silos and deterrence doctrines.', { k: 1.1, adv: true, unlock: ['SILO'] });
t('satellites', 'Satellites', 10, 'space', ['rocketry', 'transistors'], { spaceTier: 2, communication: 0.6, intelligence: 0.3 }, 'Orbiting satellites for communication, weather and reconnaissance.', { k: 1 });
t('crewed_spaceflight', 'Crewed Spaceflight', 10, 'space', ['satellites'], { spaceTier: 3, culturalOutput: 0.2 }, 'Humans in orbit.', { k: 1.1 });
t('transistors', 'Transistors and Early Computers', 10, 'computing', ['radio', 'industrial_research'], { computing: 0.5, research: 0.6, adminCapacity: 0.6 }, 'Electronic computation.', { k: 1 });
t('green_revolution', 'Green Revolution', 10, 'agriculture', ['mechanized_agriculture', 'chemical_fertilizer'], { farming: 2.0, farmMechanization: 0.1 }, 'High-yield crop varieties and irrigation multiply harvests.', { k: 1 });
t('television', 'Television', 10, 'communication', ['radio', 'transistors'], { mediaReach: 0.6, culturalOutput: 0.2, communication: 0.6 }, 'Mass visual media.', { k: 0.9 });
t('international_organizations', 'International Organizations', 10, 'civic', ['telephone', 'universal_suffrage'], { internationalOrgs: 1 }, 'Permanent bodies for diplomacy, standards and collective security.', { k: 1 });
t('containerization', 'Containerization', 10, 'transport', ['highways', 'steamships'], { tradeEfficiency: 0.15, logistics: 0.3, navalTier: 6 }, 'Standard shipping containers slash transport costs.', { k: 0.9 });
t('family_planning', 'Family Planning Programs', 10, 'medicine', ['modern_contraception', 'television'], { contraception: 0.35 }, 'Widespread access to contraception and smaller families.', { k: 0.9 });
t('emission_controls', 'Emission Controls', 10, 'industry', ['refining', 'industrial_research'], { pollutionControl: 0.25 }, 'Scrubbers, filters and cleaner engines.', { k: 0.9 });
t('high_speed_rail', 'High-Speed Rail', 10, 'transport', ['electric_rail', 'jet_engines'], { railTier: 3, landSpeed: 0.2 }, 'Trains above 250 km/h link major cities.', { k: 1 });
t('combined_arms', 'Combined Arms Doctrine', 10, 'military', ['armored_warfare', 'radar'], { landTier: 10, militaryAttack: 0.15, militaryDefense: 0.15 }, 'Integrated infantry, armour, artillery and air support.', { k: 1 });
t('rare_earth_processing', 'Rare Metal Processing', 10, 'materials', ['nuclear_fission', 'bessemer_steel'], { rareExtraction: 1, metalTier: 6 }, 'Extracting and refining lithium, rare earths and specialty alloys.', { k: 1 });

// ===================================================================== Era 11 — Digital
t('microprocessors', 'Microprocessors', 11, 'computing', ['transistors', 'rare_earth_processing'], { computing: 1, research: 0.5, automation: 0.05 }, 'Integrated circuits put computers everywhere; rare metals make fabs far more productive.', { k: 1.1, unlock: ['CHIP_FAB'] });
t('internet', 'Internet', 11, 'communication', ['microprocessors', 'satellites'], { communication: 1.5, research: 0.8, literacy: 0.1, adminCapacity: 0.6, mediaReach: 0.8, computing: 0.5 }, 'A global network of computers.', { k: 1.1, unlock: ['DATA_CENTER'] });
t('mobile_telecom', 'Mobile Telecommunications', 11, 'communication', ['internet'], { communication: 0.8, markets: 0.1 }, 'Phones in every pocket.', { k: 0.9 });
t('industrial_robots', 'Industrial Robots', 11, 'industry', ['microprocessors', 'assembly_line'], { automation: 0.15, robotics: 0.2 }, 'Programmable machines take over repetitive factory work.', { k: 1 });
t('biotechnology', 'Biotechnology', 11, 'medicine', ['antibiotics', 'microprocessors'], { biotech: 1, healthcare: 0.08, farming: 0.2, lifespan: 0.1 }, 'Genetic engineering of crops, medicines and diagnostics.', { k: 1.1 });
t('solar_power', 'Solar Power', 11, 'energy', ['microprocessors', 'electric_power'], { renewables: 1 }, 'Photovoltaic panels generate electricity from sunlight.', { k: 1, unlock: ['SOLAR'] });
t('wind_power', 'Modern Wind Power', 11, 'energy', ['electric_power', 'jet_engines'], { renewables: 0.3 }, 'Large wind turbines.', { k: 0.9, unlock: ['WIND'] });
t('lithium_batteries', 'Lithium Batteries', 11, 'energy', ['microprocessors'], { energyStorage: 0.4 }, 'Dense rechargeable storage — requires rare metals.', { k: 1, req: { resources: ['RARE'] } });
t('global_finance', 'Global Finance', 11, 'economy', ['corporate_finance', 'internet'], { finance: 0.5, markets: 0.3, tradeEfficiency: 0.05 }, 'Instant worldwide capital markets — and contagious crises.', { k: 1 });
t('satellite_navigation', 'Satellite Navigation', 11, 'space', ['satellites', 'microprocessors'], { logistics: 0.2, mobility: 0.1, intelligence: 0.1 }, 'Precise positioning anywhere.', { k: 0.9 });
t('precision_weapons', 'Precision Weapons', 11, 'military', ['combined_arms', 'satellite_navigation'], { militaryAttack: 0.25, airPower: 0.2, missiles: 0.2 }, 'Guided munitions and networked forces.', { k: 1 });
t('environmental_regulation', 'Environmental Regulation', 11, 'civic', ['emission_controls', 'television'], { pollutionControl: 0.3, energyEfficiency: 0.2 }, 'Laws limit pollution and protect ecosystems.', { k: 0.9 });
t('space_stations', 'Space Stations', 11, 'space', ['crewed_spaceflight', 'microprocessors'], { spaceTier: 4, research: 0.2 }, 'Permanent crewed outposts in orbit.', { k: 1.1 });
t('machine_learning', 'Machine Learning', 11, 'computing', ['internet'], { ai: 0.3, research: 0.3, computing: 0.3 }, 'Statistical algorithms that learn from data.', { k: 1 });

// ===================================================================== Era 12 — Near future (plausible)
t('advanced_ai', 'Advanced AI', 12, 'computing', ['machine_learning', 'microprocessors'], { ai: 1, automation: 0.2, research: 1.5, adminCapacity: 0.8 }, 'AI systems match experts in many tasks; jobs and governance change.', { k: 1.2 });
t('general_robotics', 'General Robotics', 12, 'industry', ['advanced_ai', 'industrial_robots'], { robotics: 0.5, automation: 0.2, farmMechanization: 0.05, construction: 0.3 }, 'Dexterous robots in warehouses, farms and construction sites.', { k: 1.1, unlock: ['ROBOT_FACTORY'] });
t('grid_storage', 'Grid-Scale Storage', 12, 'energy', ['lithium_batteries', 'solar_power'], { energyStorage: 0.6, renewables: 0.3, energyTier: 6 }, 'Batteries and storage smooth renewable supply.', { k: 1 });
t('smart_grids', 'Smart Grids', 12, 'energy', ['grid_storage', 'internet'], { energyEfficiency: 0.2, renewables: 0.2 }, 'Software-managed demand and supply.', { k: 0.9 });
t('synthetic_biology', 'Synthetic Biology', 12, 'medicine', ['biotechnology', 'advanced_ai'], { biotech: 0.5, farming: 0.3, healthcare: 0.05 }, 'Designed organisms for food, fuels and medicines; vertical farms.', { k: 1.1, unlock: ['GREENHOUSE'] });
t('gene_therapy', 'Gene Therapy', 12, 'medicine', ['biotechnology'], { healthcare: 0.07, lifespan: 0.15, infantCare: 0.05 }, 'Correcting genetic disease.', { k: 1 });
t('autonomous_vehicles', 'Autonomous Vehicles', 12, 'transport', ['advanced_ai', 'satellite_navigation'], { logistics: 0.3, tradeEfficiency: 0.05, landSpeed: 0.1 }, 'Self-driving freight and transit.', { k: 1 });
t('reusable_rockets', 'Reusable Rockets', 12, 'space', ['space_stations', 'advanced_ai'], { spaceTier: 4, orbitalIndustry: 0.3 }, 'Launch costs fall by an order of magnitude.', { k: 1 });
t('carbon_capture', 'Carbon Capture', 12, 'energy', ['environmental_regulation', 'synthetic_biology'], { carbonCapture: 0.5, pollutionControl: 0.1 }, 'Removing carbon from flue gas and air (costly).', { k: 1 });
t('autonomous_weapons', 'Autonomous Weapons', 12, 'military', ['advanced_ai', 'precision_weapons'], { landTier: 11, autonomousWeapons: 1, militaryAttack: 0.2 }, 'Drone swarms and robotic combat systems — and new escalation risks.', { k: 1.1 });
t('precision_fermentation', 'Precision Fermentation', 12, 'agriculture', ['synthetic_biology'], { farming: 0.4, foodPreservation: 0.2 }, 'Proteins and fats brewed by microbes.', { k: 0.9 });
t('quantum_computing', 'Quantum Computing', 12, 'computing', ['advanced_ai'], { computing: 1, research: 0.8 }, 'Machines that exploit quantum states — useful for some problems.', { k: 1.2 });
t('maglev', 'Maglev Rail', 12, 'transport', ['high_speed_rail', 'quantum_computing'], { railTier: 4, landSpeed: 0.2 }, 'Magnetically levitated trains.', { k: 0.9 });
t('digital_democracy', 'Digital Participation', 12, 'civic', ['internet', 'universal_suffrage'], { participation: 0.3, adminCapacity: 0.3 }, 'Continuous consultation and transparent digital government.', { k: 0.9 });
t('agri_robotics', 'Agricultural Robotics', 12, 'agriculture', ['general_robotics'], { farmMechanization: 0.05, farming: 0.2 }, 'Robots plant, weed and harvest.', { k: 0.9 });

// ===================================================================== Era 13 — Advanced future (plausible, uncertain)
t('fusion_power', 'Commercial Fusion', 13, 'energy', ['grid_storage', 'quantum_computing'], { fusionPower: 1, energyTier: 7 }, 'Fusion reactors producing net power — plausible but uncertain; real-world success is not assured.', { k: 1.3, unlock: ['FUSION'] });
t('lights_out_manufacturing', 'Lights-Out Manufacturing', 13, 'industry', ['general_robotics', 'advanced_ai'], { automation: 0.2, industry: 0.5 }, 'Fully automated factories run without workers.', { k: 1 });
t('orbital_industry', 'Orbital Industry', 13, 'space', ['reusable_rockets', 'general_robotics'], { orbitalIndustry: 1, spaceTier: 4 }, 'Manufacturing and power generation in orbit.', { k: 1.1 });
t('lunar_base', 'Lunar Base', 13, 'space', ['orbital_industry'], { spaceTier: 5 }, 'A permanent outpost on the Moon.', { k: 1.1 });
t('advanced_materials', 'Advanced Materials', 13, 'materials', ['quantum_computing', 'rare_earth_processing'], { metalTier: 7, construction: 0.3, housingTier: 8 }, 'Engineered nanomaterials enable arcologies and lighter machines.', { k: 1, unlock: ['ARCOLOGY'] });
t('brain_interfaces', 'Brain-Computer Interfaces', 13, 'computing', ['advanced_ai', 'gene_therapy'], { communication: 0.5, research: 0.4 }, 'Direct neural links to machines.', { k: 1 });
t('life_extension', 'Life Extension', 13, 'medicine', ['gene_therapy', 'synthetic_biology'], { lifeExtension: 1, lifespan: 0.25 }, 'Slowing biological aging (if achievable).', { k: 1.2 });
t('ai_governance', 'AI-Assisted Governance', 13, 'civic', ['advanced_ai', 'digital_democracy'], { adminCapacity: 0.8, ruleOfLaw: 0.1 }, 'Policy simulation and administration by AI under human oversight — with new risks of dependency.', { k: 1 });
t('exoskeletons', 'Powered Exoskeletons', 13, 'military', ['general_robotics', 'autonomous_weapons'], { landTier: 12, militaryDefense: 0.2 }, 'Armoured powered suits for soldiers and workers.', { k: 1 });

// ===================================================================== Era 14 — Spacefaring
t('closed_ecosystems', 'Closed-Loop Habitats', 14, 'space', ['lunar_base', 'synthetic_biology'], { orbitalIndustry: 0.3 }, 'Self-sustaining life support recycles air, water and food.', { k: 1, realism: 'plausible' });
t('offworld_settlement', 'Off-World Settlements', 14, 'space', ['closed_ecosystems', 'fusion_power'], { offworld: 1, spaceTier: 6 }, 'Permanent colonies on other worlds with their own economies.', { k: 1.2, realism: 'plausible' });
t('asteroid_mining', 'Asteroid Mining', 14, 'space', ['orbital_industry', 'general_robotics'], { rareExtraction: 0.5, orbitalIndustry: 0.5 }, 'Metals and volatiles harvested from asteroids.', { k: 1.1, realism: 'plausible' });
t('interplanetary_logistics', 'Interplanetary Logistics', 14, 'space', ['offworld_settlement', 'asteroid_mining'], { tradeEfficiency: 0.05, logistics: 0.3 }, 'Regular cargo routes between worlds.', { k: 1, realism: 'speculative' });
t('orbital_habitats', 'Orbital Habitats', 14, 'space', ['closed_ecosystems', 'advanced_materials'], { offworld: 0.5, housingTier: 8 }, 'Rotating space stations house thousands.', { k: 1.1, realism: 'speculative' });
t('space_solar', 'Space-Based Solar Power', 14, 'energy', ['orbital_industry', 'grid_storage'], { renewables: 0.5, energyTier: 7 }, 'Orbital collectors beam power to the surface.', { k: 1, realism: 'speculative' });
t('planetary_defense', 'Planetary Defense', 14, 'space', ['asteroid_mining', 'precision_weapons'], { militaryDefense: 0.1 }, 'Detecting and deflecting hazardous asteroids.', { k: 0.9, realism: 'plausible' });

// ===================================================================== Era 15 — Speculative
t('general_ai', 'Artificial General Intelligence', 15, 'computing', ['ai_governance', 'quantum_computing'], { ai: 2, research: 3, automation: 0.05 }, 'Speculative: machine intelligence equal to or beyond human generality.', { k: 1.2 });
t('molecular_manufacturing', 'Molecular Manufacturing', 15, 'industry', ['advanced_materials', 'general_ai'], { industry: 1, construction: 0.5, crafts: 0.5 }, 'Speculative: atomically precise fabrication.', { k: 1.1 });
t('orbital_megastructures', 'Orbital Megastructures', 15, 'space', ['orbital_habitats', 'molecular_manufacturing'], { spaceTier: 7, orbitalIndustry: 1 }, 'Speculative: space elevators and vast orbital constructs.', { k: 1.2, unlock: ['MEGASTRUCTURE'] });
t('terraforming', 'Terraforming', 15, 'space', ['offworld_settlement', 'molecular_manufacturing'], { offworld: 1, carbonCapture: 0.5 }, 'Speculative: reshaping other planets to support life.', { k: 1.2 });
t('mind_uploading', 'Mind Uploading', 15, 'computing', ['general_ai', 'brain_interfaces'], { lifeExtension: 1 }, 'Speculative: transferring minds to machines.', { k: 1.2 });
t('interstellar_probes', 'Interstellar Probes', 15, 'space', ['orbital_megastructures', 'fusion_power'], { culturalOutput: 0.3 }, 'Speculative: self-replicating probes to other stars.', { k: 1.1 });
t('post_scarcity', 'Post-Scarcity Economics', 15, 'economy', ['molecular_manufacturing', 'general_ai'], { markets: 0.5, welfare: 1 }, 'Speculative: abundance of manufactured goods — land, energy and status remain scarce.', { k: 1 });
t('antimatter', 'Antimatter Propulsion', 15, 'space', ['interstellar_probes'], { logistics: 0.5 }, 'Speculative: extremely energetic propulsion.', { k: 1.2 });

export const TECHS: readonly TechDef[] = list;
export const TECH_BY_ID: ReadonlyMap<string, TechDef> = new Map(list.map((x) => [x.id, x]));
export const STARTING_TECHS: readonly string[] = ['fire_control', 'stone_tools', 'foraging'];
export const ERA_NAMES: readonly string[] = [
  '', 'Prehistoric', 'Agricultural', 'Bronze & Early Urban', 'Iron & Classical', 'Medieval', 'Renaissance & Exploration',
  'Early Industrial', 'Late Industrial', 'Early Modern', 'Atomic & Space', 'Digital', 'Near Future', 'Advanced Future',
  'Spacefaring', 'Speculative',
];
