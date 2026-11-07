package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.SimulationInput;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.SimulationResult;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.SimulationTotals;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.SimulationYear;

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
public final class SimuladorCenarios {

    public static final double TONELADAS_CO2_POR_TONELADA_RECICLADA = 0.9;
    public static final double CAPACIDADE_CAMINHAO_TONELADAS = 10;
    public static final double EMPREGOS_POR_1000_TONELADAS = 2;
    public static final int ANO_HORIZONTE = 2050;

    private SimuladorCenarios() {
    }

    public static SimulationResult simular(SimulationInput entrada, int anoBase) {
        double gerado = entrada.population() * entrada.kgPerCapitaDay() * 365 / 1000.0;
        int intervalo = Math.max(1, entrada.targetYear() - anoBase);
        List<SimulationYear> anos = new ArrayList<>();
        double aterroEvitado = 0, co2Evitado = 0, ultimoRecicladoExtra = 0;

        for (int ano = anoBase; ano <= ANO_HORIZONTE; ano++) {
            int decorridos = ano - anoBase;
            double geracao = gerado * Math.pow(1 + entrada.annualGrowthRate(), decorridos);
            double progresso = Math.min(1.0, (double) decorridos / intervalo);
            double taxa = entrada.currentRecyclingRate() + (entrada.targetRecyclingRate() - entrada.currentRecyclingRate()) * progresso;
            double recicladoBase = geracao * entrada.currentRecyclingRate();
            double recicladoCenario = geracao * taxa;
            double extra = recicladoCenario - recicladoBase;
            double co2 = extra * TONELADAS_CO2_POR_TONELADA_RECICLADA;
            aterroEvitado += extra;
            co2Evitado += co2;
            ultimoRecicladoExtra = extra;
            anos.add(new SimulationYear(ano, Numeros.arredondar2(geracao), Numeros.arredondar(taxa, 4), Numeros.arredondar2(recicladoBase),
                    Numeros.arredondar2(recicladoCenario), Numeros.arredondar2(geracao - recicladoBase), Numeros.arredondar2(geracao - recicladoCenario),
                    Numeros.arredondar2(co2)));
        }
        SimulationTotals totais = new SimulationTotals(
                Numeros.arredondar2(aterroEvitado),
                Numeros.arredondar2(co2Evitado),
                Math.round(co2Evitado * 1000 / FatoresImpacto.KG_CO2_POR_ARVORE_ANO),
                Math.round(aterroEvitado / CAPACIDADE_CAMINHAO_TONELADAS),
                Math.round(Math.max(0, ultimoRecicladoExtra) / 1000 * EMPREGOS_POR_1000_TONELADAS));
        return new SimulationResult(anos, totais);
    }
}
