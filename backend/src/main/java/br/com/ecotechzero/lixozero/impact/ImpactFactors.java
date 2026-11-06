package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.category.CategoryCode;

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
public final class ImpactFactors {

    public static final double KG_CO2_POR_ARVORE_ANO = 22.0;

    private static final Map<CategoryCode, Double> ENERGIA_KWH_POR_KG = Map.of(
            CategoryCode.PAPEL, 4.1, CategoryCode.PLASTICO, 5.8, CategoryCode.VIDRO, 0.42, CategoryCode.METAL, 4.5,
            CategoryCode.ELETRONICO, 3.0, CategoryCode.ORGANICO, 0.1, CategoryCode.REJEITO, 0.0);

    private static final Map<CategoryCode, Double> AGUA_LITROS_POR_KG = Map.of(
            CategoryCode.PAPEL, 26.0, CategoryCode.PLASTICO, 2.5, CategoryCode.VIDRO, 1.5, CategoryCode.METAL, 6.0,
            CategoryCode.ELETRONICO, 3.0, CategoryCode.ORGANICO, 0.0, CategoryCode.REJEITO, 0.0);

    private ImpactFactors() {
    }

    public static double energiaKwh(CategoryCode codigo, double kg) {
        return ENERGIA_KWH_POR_KG.getOrDefault(codigo, 0.0) * kg;
    }

    public static double aguaLitros(CategoryCode codigo, double kg) {
        return AGUA_LITROS_POR_KG.getOrDefault(codigo, 0.0) * kg;
    }

    public static double arvores(double co2Kg) {
        return co2Kg / KG_CO2_POR_ARVORE_ANO;
    }
}
