package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.category.CodigoCategoria;

import java.util.Map;

/**
 * Fatores de conversão usados nos indicadores ambientais (valores médios de literatura, para fins educativos):
 * <ul>
 *   <li><b>CO2 evitado</b>: vem de cada categoria (co2FactorKg, kg CO2e por kg), cadastrado no banco.</li>
 *   <li><b>Árvores equivalentes</b>: uma árvore em crescimento absorve ~22 kg de CO2 por ano (EPA/Arbor Day).</li>
 *   <li><b>Energia economizada</b> (kWh por kg reciclado): papel 4,1; plástico 5,8; vidro 0,42; metal 4,5
 *       (média latas de alumínio/aço); eletrônico 3,0; orgânico 0,1 (compostagem); rejeito 0.</li>
 *   <li><b>Água economizada</b> (litros por kg): papel 26; plástico 2,5; vidro 1,5; metal 6; eletrônico 3; demais 0.</li>
 * </ul>
 */
public final class FatoresImpacto {

    public static final double KG_CO2_POR_ARVORE_ANO = 22.0;

    private static final Map<CodigoCategoria, Double> ENERGIA_KWH_POR_KG = Map.of(
            CodigoCategoria.PAPEL, 4.1, CodigoCategoria.PLASTICO, 5.8, CodigoCategoria.VIDRO, 0.42, CodigoCategoria.METAL, 4.5,
            CodigoCategoria.ELETRONICO, 3.0, CodigoCategoria.ORGANICO, 0.1, CodigoCategoria.REJEITO, 0.0);

    private static final Map<CodigoCategoria, Double> AGUA_LITROS_POR_KG = Map.of(
            CodigoCategoria.PAPEL, 26.0, CodigoCategoria.PLASTICO, 2.5, CodigoCategoria.VIDRO, 1.5, CodigoCategoria.METAL, 6.0,
            CodigoCategoria.ELETRONICO, 3.0, CodigoCategoria.ORGANICO, 0.0, CodigoCategoria.REJEITO, 0.0);

    private FatoresImpacto() {
    }

    public static double energiaKwh(CodigoCategoria codigo, double kg) {
        return ENERGIA_KWH_POR_KG.getOrDefault(codigo, 0.0) * kg;
    }

    public static double aguaLitros(CodigoCategoria codigo, double kg) {
        return AGUA_LITROS_POR_KG.getOrDefault(codigo, 0.0) * kg;
    }

    public static double arvores(double co2Kg) {
        return co2Kg / KG_CO2_POR_ARVORE_ANO;
    }
}
