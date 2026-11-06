/**
 * Simulador de cenários (igual ao ScenarioSimulator do back-end): projeta ano a ano, do ano atual até 2050,
 * a geração de lixo e a taxa de reciclagem subindo linearmente até a meta em `targetYear` (e mantida depois).
 */
import type { SimulationInput, SimulationResult, SimulationYear } from '@/api/types';
import { CO2_KG_POR_ARVORE_ANO } from './impact';
import { arredondar } from './random';

const CO2_T_POR_T_RECICLADA = 0.9;
const CAPACIDADE_CAMINHAO_T = 10;
const EMPREGOS_POR_1000_T = 2;
const ANO_HORIZONTE = 2050;

export function simular(entrada: SimulationInput, anoBase: number): SimulationResult {
  const gerado = (entrada.population * entrada.kgPerCapitaDay * 365) / 1000;
  const intervalo = Math.max(1, entrada.targetYear - anoBase);
  const anos: SimulationYear[] = [];
  let aterroEvitado = 0;
  let co2Evitado = 0;
  let ultimoExtra = 0;
  for (let ano = anoBase; ano <= ANO_HORIZONTE; ano++) {
    const decorrido = ano - anoBase;
    const geracao = gerado * (1 + entrada.annualGrowthRate) ** decorrido;
    const progresso = Math.min(1, decorrido / intervalo);
    const taxa = entrada.currentRecyclingRate + (entrada.targetRecyclingRate - entrada.currentRecyclingRate) * progresso;
    const base = geracao * entrada.currentRecyclingRate;
    const cenario = geracao * taxa;
    const extra = cenario - base;
    const co2 = extra * CO2_T_POR_T_RECICLADA;
    aterroEvitado += extra;
    co2Evitado += co2;
    ultimoExtra = extra;
    anos.push({
      year: ano,
      generatedTons: arredondar(geracao),
      recyclingRate: arredondar(taxa, 4),
      recycledTonsBaseline: arredondar(base),
      recycledTonsScenario: arredondar(cenario),
      landfillTonsBaseline: arredondar(geracao - base),
      landfillTonsScenario: arredondar(geracao - cenario),
      co2AvoidedTonsScenario: arredondar(co2),
    });
  }
  return {
    years: anos,
    totals: {
      landfillAvoidedTons: arredondar(aterroEvitado),
      co2AvoidedTons: arredondar(co2Evitado),
      treesEquivalent: Math.round((co2Evitado * 1000) / CO2_KG_POR_ARVORE_ANO),
      truckloadsAvoided: Math.round(aterroEvitado / CAPACIDADE_CAMINHAO_T),
      jobsCreated: Math.round((Math.max(0, ultimoExtra) / 1000) * EMPREGOS_POR_1000_T),
    },
  };
}
