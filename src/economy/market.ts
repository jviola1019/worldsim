/**
 * National market & public finance (yearly).
 *
 * Accounting: GDP is measured by expenditure, GDP = C + I + G + NX + dInv,
 * where C (household consumption), I (construction investment), G
 * (government purchases), NX (net exports from trade) are each MEASURED from
 * recorded flows, and dInv is the change in the value of national stocks.
 * The identity therefore holds exactly; inventory change is the only
 * residual-like term and is reported as such.
 *
 * Prices respond to scarcity (use vs production + stocks). Strategic ACCESS
 * per good (0..1) feeds technology adoption. The treasury collects taxes
 * (scaled by state capacity, tax efficiency and corruption) and spends
 * according to the budget; with banking, deficits become debt (interest
 * rising with debt/GDP); with central banking, deficits can be monetized,
 * causing inflation. Credit cycles can produce financial crises.
 */
import type { Sim } from '../sim/context';
import type { Civ } from '../sim/types';
import { GOODS, GOOD_COUNT, Good } from '../world/resources';
import { BALANCE } from '../config/balance';
import { clamp, clamp01, gini } from '../core/math';
import { logEvent } from '../history/events';

export function stockValue(civ: Civ): number {
  let v = 0;
  for (let g = 0; g < GOOD_COUNT; g++) if (g !== Good.ENERGY) v += civ.stock[g] * civ.prices[g];
  return v;
}

export function civEconomyYearly(sim: Sim, civ: Civ, exportsValue: number, importsValue: number): void {
  const w = sim.w;
  const acc = civ.acc;
  const pop = Math.max(1, civ.population);
  const prevStockValue = (sim.cache[`stockv:${civ.id}`] as number | undefined) ?? stockValue(civ);
  // --- prices & access
  for (let g = 0; g < GOOD_COUNT; g++) {
    const def = GOODS[g];
    const supply = acc.prod[g] + civ.stock[g] * 0.25 + 1;
    const demand = acc.use[g] + 1;
    const target = def.basePrice * clamp(Math.pow(demand / supply, 0.5), 0.3, 5);
    civ.prices[g] += (target - civ.prices[g]) * BALANCE.priceAdjust;
    const need = Math.max(1, pop * 0.0004);
    civ.access[g] = clamp01((acc.prod[g] + civ.stock[g] * 0.3) / need);
    // storage losses
    if (def.storable) civ.stock[g] *= 1 - def.spoilage * (g === Good.FOOD ? 1 - clamp01(civ.caps.foodPreservation) * 0.7 : 1);
  }
  civ.stock[Good.ENERGY] = 0; // electricity is not storable
  // --- government
  const capacity = clamp01(0.15 + civ.inst.capacity * 0.6 + civ.caps.adminCapacity * 0.05);
  const cons = acc.cons;
  const inv = acc.inv;
  const servicesVA = acc.services;
  const baseIncome = cons + inv + servicesVA * 0.4;
  const revenue = Math.max(0, civ.taxRate * baseIncome * capacity * (1 + civ.caps.taxEfficiency * 0.3) * (1 - civ.corruption * 0.6));
  let spending = revenue;
  // borrowing when the treasury is short and the state can borrow
  if (civ.caps.banking > 0 && civ.treasury < revenue * 0.2) spending = revenue * 1.12;
  const interest = civ.debt * (0.03 + BALANCE.debtPremium * (civ.debt / Math.max(1, baseIncome)) + (1 - civ.inst.ruleOfLaw) * 0.02);
  civ.treasury += revenue - spending - interest;
  if (civ.treasury < 0) {
    if (civ.caps.centralBanking > 0 && civ.debt > baseIncome * 0.9) {
      // monetize: print money
      civ.moneySupply += -civ.treasury;
      civ.treasury = 0;
    } else if (civ.caps.banking > 0) {
      civ.debt += -civ.treasury;
      civ.treasury = 0;
    } else {
      spending += civ.treasury; // cannot borrow: spending is cut
      civ.treasury = 0;
    }
  }
  if (civ.treasury > revenue * 2 && civ.debt > 0) {
    const pay = Math.min(civ.debt, civ.treasury - revenue);
    civ.debt -= pay;
    civ.treasury -= pay;
  }
  // debt crisis
  const debtRatio = civ.debt / Math.max(1, baseIncome);
  if (debtRatio > 1.4 && interest > revenue * 0.35 && civ.crisis <= 0) {
    civ.crisis = 3;
    civ.legitimacy = clamp01(civ.legitimacy - 0.12);
    civ.debt *= 0.6; // default / restructuring
    logEvent(sim, { type: 'debt_crisis', cat: 'economy', title: `${civ.name} defaulted on its debts`, civs: [civ.id], importance: 3, causes: [{ label: `Debt at ${Math.round(debtRatio * 100)}% of output`, weight: debtRatio }, { label: 'Interest exceeding a third of revenue', weight: interest / Math.max(1, revenue) }] });
  }
  // money & inflation (quantity-theory style)
  const prevGdp = civ.econ.gdp;
  if (civ.caps.currency > 0) {
    if (civ.moneySupply <= 0) civ.moneySupply = Math.max(1, baseIncome * 0.5);
    const growthM = civ.moneySupply / Math.max(1, (sim.cache[`m:${civ.id}`] as number | undefined) ?? civ.moneySupply) - 1;
    const growthY = prevGdp > 0 ? baseIncome / prevGdp - 1 : 0;
    civ.inflation = clamp(civ.inflation * 0.5 + (growthM - growthY) * 0.5 + (civ.crisis > 0 ? 0.02 : 0), -0.2, 3);
    civ.priceLevel *= 1 + civ.inflation;
    sim.cache[`m:${civ.id}`] = civ.moneySupply;
    civ.moneySupply *= 1 + Math.max(0, growthY) * 0.9; // accommodate real growth
  }
  // credit cycle (financial instability)
  if (civ.caps.finance > 0.2) {
    const growth = prevGdp > 0 ? baseIncome / prevGdp - 1 : 0;
    civ.credit = clamp(civ.credit + (growth > 0.02 ? 0.06 : -0.04) * (0.5 + civ.caps.finance), 0, 2);
    if (civ.credit > 1.4 && growth < 0.01 && civ.crisis <= 0 && sim.rng.chance(0.35)) {
      civ.crisis = 2;
      civ.credit = 0.3;
      logEvent(sim, { type: 'financial_crisis', cat: 'economy', title: `A financial crisis struck ${civ.name}`, civs: [civ.id], importance: 3, causes: [{ label: 'Credit boom leaving high leverage', weight: 0.6 }, { label: 'Slowing growth', weight: 0.4 }] });
    }
  }
  if (civ.crisis > 0) civ.crisis--;
  // --- national accounts (expenditure side)
  const sv = stockValue(civ);
  sim.cache[`stockv:${civ.id}`] = sv;
  const dInv = sv - prevStockValue;
  const G = spending;
  const NX = exportsValue - importsValue;
  const crisisDrag = civ.crisis > 0 ? 0.92 : 1;
  const gdp = Math.max(0, (cons + inv + G + NX + dInv) * crisisDrag);
  const e = civ.econ;
  e.growth = prevGdp > 0 ? gdp / prevGdp - 1 : 0;
  e.gdp = gdp;
  e.gdpPerCapita = gdp / pop;
  e.consumption = cons;
  e.investment = inv + dInv;
  e.government = G;
  e.exports = exportsValue;
  e.imports = importsValue;
  e.revenue = revenue;
  e.spending = spending + interest;
  e.unemployment = acc.workers > 0 ? acc.unemployed / acc.workers : 0;
  e.energyUse = acc.energyUse + acc.use[Good.ENERGY];
  e.emissions = acc.emissions;
  e.laborProductivity = acc.workers > 0 ? (gdp / acc.workers) * 12 : 0;
  // sectors: agriculture, resources, industry, construction, services
  const P = civ.prices;
  const val = (gs: number[]) => gs.reduce((a, g) => a + acc.prod[g] * P[g], 0);
  e.sectors = [
    val([Good.FOOD]),
    val([Good.WOOD, Good.STONE, Good.COPPER, Good.TIN, Good.IRON, Good.GOLD, Good.COAL, Good.OIL, Good.GAS, Good.URANIUM, Good.RARE, Good.HORSES]),
    val([Good.METAL, Good.GOODS, Good.LUXURY, Good.MACHINERY, Good.ARMS, Good.ELECTRONICS, Good.ENERGY]),
    inv,
    servicesVA,
    0,
  ];
  // living standards & inequality (stylized: concentration rises with land/capital elites, falls with welfare & participation)
  let ls = 0;
  const pros: number[] = [];
  for (const sid of civ.settlements) {
    const s = w.settlements.get(sid);
    if (!s) continue;
    ls += s.prosperity * s.pop;
    pros.push(s.prosperity);
  }
  e.livingStandard = civ.population > 0 ? ls / civ.population : 1;
  e.inequality = clamp(0.3 + 0.25 * (1 - civ.inst.participation) * (civ.caps.currency > 0 ? 1 : 0.3) + 0.1 * civ.caps.finance - 0.25 * civ.inst.welfare + gini(pros) * 0.5, 0.15, 0.75);
  // reset accumulators
  acc.prod.fill(0);
  acc.use.fill(0);
  acc.cons = 0;
  acc.inv = 0;
  acc.va = 0;
  acc.services = 0;
  acc.workers = 0;
  acc.unemployed = 0;
  acc.foodNeed = 0;
  acc.foodShort = 0;
  acc.energyUse = 0;
  acc.emissions = 0;
}
