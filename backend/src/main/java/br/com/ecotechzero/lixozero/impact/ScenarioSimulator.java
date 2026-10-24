package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationInput;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationResult;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationTotals;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationYear;

import java.util.ArrayList;
import java.util.List;

/**
 * Simulador de cenários até 2050 (determinístico: mesma entrada, mesmo resultado).
 * <ul>
 *   <li>Geração anual (t) = população x kg/hab/dia x 365 / 1000, crescendo à taxa anual informada.</li>
 *   <li>Linha de base: a taxa de reciclagem atual se mantém.</li>
 *   <li>Cenário: a taxa sobe linearmente da atual até a meta no ano-alvo e se mantém depois.</li>
 *   <li>co2AvoidedTonsScenario = CO2 evitado A MAIS que a linha de base (t recicladas extras x 0,9 tCO2e/t,
 *       média ponderada da composição típica dos recicláveis no Brasil).</li>
 *   <li>Árvores = CO2 / 22 kg por árvore/ano; caminhões = toneladas desviadas do aterro / 10 t por caminhão compactador;
 *       empregos ≈ 2 postos por 1.000 t/ano de reciclagem adicional (estimativa do setor de triagem).</li>
 * </ul>
 */
public final class ScenarioSimulator {

    public static final double CO2_TONS_PER_RECYCLED_TON = 0.9;
    public static final double TRUCK_CAPACITY_TONS = 10;
    public static final double JOBS_PER_1000_TONS = 2;
    public static final int HORIZON_YEAR = 2050;

    private ScenarioSimulator() {
    }

    public static SimulationResult simulate(SimulationInput in, int baseYear) {
        double generated = in.population() * in.kgPerCapitaDay() * 365 / 1000.0;
        int span = Math.max(1, in.targetYear() - baseYear);
        List<SimulationYear> years = new ArrayList<>();
        double landfillAvoided = 0, co2Avoided = 0, lastExtraRecycled = 0;

        for (int year = baseYear; year <= HORIZON_YEAR; year++) {
            int elapsed = year - baseYear;
            double gen = generated * Math.pow(1 + in.annualGrowthRate(), elapsed);
            double progress = Math.min(1.0, (double) elapsed / span);
            double rate = in.currentRecyclingRate() + (in.targetRecyclingRate() - in.currentRecyclingRate()) * progress;
            double recycledBase = gen * in.currentRecyclingRate();
            double recycledScenario = gen * rate;
            double extra = recycledScenario - recycledBase;
            double co2 = extra * CO2_TONS_PER_RECYCLED_TON;
            landfillAvoided += extra;
            co2Avoided += co2;
            lastExtraRecycled = extra;
            years.add(new SimulationYear(year, Numbers.round2(gen), Numbers.round(rate, 4), Numbers.round2(recycledBase),
                    Numbers.round2(recycledScenario), Numbers.round2(gen - recycledBase), Numbers.round2(gen - recycledScenario),
                    Numbers.round2(co2)));
        }
        SimulationTotals totals = new SimulationTotals(
                Numbers.round2(landfillAvoided),
                Numbers.round2(co2Avoided),
                Math.round(co2Avoided * 1000 / ImpactFactors.CO2_KG_PER_TREE_YEAR),
                Math.round(landfillAvoided / TRUCK_CAPACITY_TONS),
                Math.round(Math.max(0, lastExtraRecycled) / 1000 * JOBS_PER_1000_TONS));
        return new SimulationResult(years, totals);
    }
}
