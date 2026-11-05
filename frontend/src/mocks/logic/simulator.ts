/**
 * Simulador de cenários (igual ao ScenarioSimulator do back-end): projeta ano a ano, do ano atual até 2050,
 * a geração de lixo e a taxa de reciclagem subindo linearmente até a meta em `targetYear` (e mantida depois).
 */
import type { SimulationInput, SimulationResult, SimulationYear } from '@/api/types';
import { CO2_KG_PER_TREE_YEAR } from './impact';
import { round } from './random';

const CO2_TONS_PER_RECYCLED_TON = 0.9;
const TRUCK_CAPACITY_TONS = 10;
const JOBS_PER_1000_TONS = 2;
const HORIZON_YEAR = 2050;

export function simulate(input: SimulationInput, baseYear: number): SimulationResult {
  const generated = (input.population * input.kgPerCapitaDay * 365) / 1000;
  const span = Math.max(1, input.targetYear - baseYear);
  const years: SimulationYear[] = [];
  let landfillAvoided = 0;
  let co2Avoided = 0;
  let lastExtra = 0;
  for (let year = baseYear; year <= HORIZON_YEAR; year++) {
    const elapsed = year - baseYear;
    const gen = generated * (1 + input.annualGrowthRate) ** elapsed;
    const progress = Math.min(1, elapsed / span);
    const rate = input.currentRecyclingRate + (input.targetRecyclingRate - input.currentRecyclingRate) * progress;
    const base = gen * input.currentRecyclingRate;
    const scenario = gen * rate;
    const extra = scenario - base;
    const co2 = extra * CO2_TONS_PER_RECYCLED_TON;
    landfillAvoided += extra;
    co2Avoided += co2;
    lastExtra = extra;
    years.push({
      year,
      generatedTons: round(gen),
      recyclingRate: round(rate, 4),
      recycledTonsBaseline: round(base),
      recycledTonsScenario: round(scenario),
      landfillTonsBaseline: round(gen - base),
      landfillTonsScenario: round(gen - scenario),
      co2AvoidedTonsScenario: round(co2),
    });
  }
  return {
    years,
    totals: {
      landfillAvoidedTons: round(landfillAvoided),
      co2AvoidedTons: round(co2Avoided),
      treesEquivalent: Math.round((co2Avoided * 1000) / CO2_KG_PER_TREE_YEAR),
      truckloadsAvoided: Math.round(landfillAvoided / TRUCK_CAPACITY_TONS),
      jobsCreated: Math.round((Math.max(0, lastExtra) / 1000) * JOBS_PER_1000_TONS),
    },
  };
}
