package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.common.PontoGeografico;
import br.com.ecotechzero.lixozero.common.Textos;

import java.util.Map;
import java.util.UUID;

/**
 * Localização aproximada de uma residência para as coletas automáticas. Se a residência não informou
 * coordenadas, usamos o centro do bairro (tabela abaixo) ou o centro de Taboão da Serra, com um pequeno
 * deslocamento determinístico (~300 m) para que residências diferentes não fiquem no mesmo ponto.
 */
final class LocalizacaoResidencia {

    private static final PontoGeografico CENTRO_DA_CIDADE = new PontoGeografico(-23.6090, -46.7580);

    private static final Map<String, PontoGeografico> BAIRROS = Map.ofEntries(
            Map.entry("jardim maria rosa", new PontoGeografico(-23.6040, -46.7545)),
            Map.entry("parque pinheiros", new PontoGeografico(-23.6125, -46.7680)),
            Map.entry("centro", new PontoGeografico(-23.6225, -46.7835)),
            Map.entry("jardim record", new PontoGeografico(-23.6175, -46.7800)),
            Map.entry("vila iasi", new PontoGeografico(-23.6070, -46.7750)),
            Map.entry("jardim helena", new PontoGeografico(-23.6150, -46.7610)),
            Map.entry("parque laguna", new PontoGeografico(-23.6200, -46.7925)),
            Map.entry("jardim mituzi", new PontoGeografico(-23.6300, -46.7760)),
            Map.entry("jardim umarizal", new PontoGeografico(-23.6285, -46.7485)),
            Map.entry("jardim santa rosa", new PontoGeografico(-23.6100, -46.7470)),
            Map.entry("vila sonia", new PontoGeografico(-23.5935, -46.7395)),
            Map.entry("butanta", new PontoGeografico(-23.5745, -46.7185)),
            Map.entry("campo limpo", new PontoGeografico(-23.6385, -46.7605)),
            Map.entry("jardim bonfiglioli", new PontoGeografico(-23.5865, -46.7335)));

    private LocalizacaoResidencia() {
    }

    static PontoGeografico of(Household h) {
        if (h.getLatitude() != null && h.getLongitude() != null) {
            return new PontoGeografico(h.getLatitude(), h.getLongitude());
        }
        PontoGeografico base = BAIRROS.getOrDefault(Textos.semAcentos(h.getNeighborhood()).strip(), CENTRO_DA_CIDADE);
        UUID id = h.getId();
        double desvioLat = ((id.getMostSignificantBits() & 0xFF) / 255.0 - 0.5) * 0.006;
        double desvioLon = ((id.getLeastSignificantBits() & 0xFF) / 255.0 - 0.5) * 0.006;
        return new PontoGeografico(base.latitude() + desvioLat, base.longitude() + desvioLon);
    }

    static String endereco(Household h) {
        if (h.getAddress() != null && !h.getAddress().isBlank()) {
            return h.getAddress();
        }
        return "Residência " + h.getName() + " – " + h.getNeighborhood() + ", " + h.getCity();
    }
}
