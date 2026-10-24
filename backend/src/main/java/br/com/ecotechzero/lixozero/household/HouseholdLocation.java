package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.common.Text;

import java.util.Map;
import java.util.UUID;

/**
 * Localização aproximada de uma residência para as coletas automáticas. Se a residência não informou
 * coordenadas, usamos o centro do bairro (tabela abaixo) ou o centro de Taboão da Serra, com um pequeno
 * deslocamento determinístico (~300 m) para que residências diferentes não fiquem no mesmo ponto.
 */
final class HouseholdLocation {

    private static final GeoPoint CITY_CENTER = new GeoPoint(-23.6090, -46.7580);

    private static final Map<String, GeoPoint> NEIGHBORHOODS = Map.ofEntries(
            Map.entry("jardim maria rosa", new GeoPoint(-23.6040, -46.7545)),
            Map.entry("parque pinheiros", new GeoPoint(-23.6125, -46.7680)),
            Map.entry("centro", new GeoPoint(-23.6225, -46.7835)),
            Map.entry("jardim record", new GeoPoint(-23.6175, -46.7800)),
            Map.entry("vila iasi", new GeoPoint(-23.6070, -46.7750)),
            Map.entry("jardim helena", new GeoPoint(-23.6150, -46.7610)),
            Map.entry("parque laguna", new GeoPoint(-23.6200, -46.7925)),
            Map.entry("jardim mituzi", new GeoPoint(-23.6300, -46.7760)),
            Map.entry("jardim umarizal", new GeoPoint(-23.6285, -46.7485)),
            Map.entry("jardim santa rosa", new GeoPoint(-23.6100, -46.7470)),
            Map.entry("vila sonia", new GeoPoint(-23.5935, -46.7395)),
            Map.entry("butanta", new GeoPoint(-23.5745, -46.7185)),
            Map.entry("campo limpo", new GeoPoint(-23.6385, -46.7605)),
            Map.entry("jardim bonfiglioli", new GeoPoint(-23.5865, -46.7335)));

    private HouseholdLocation() {
    }

    static GeoPoint of(Household h) {
        if (h.getLatitude() != null && h.getLongitude() != null) {
            return new GeoPoint(h.getLatitude(), h.getLongitude());
        }
        GeoPoint base = NEIGHBORHOODS.getOrDefault(Text.fold(h.getNeighborhood()).strip(), CITY_CENTER);
        UUID id = h.getId();
        double jitterLat = ((id.getMostSignificantBits() & 0xFF) / 255.0 - 0.5) * 0.006;
        double jitterLon = ((id.getLeastSignificantBits() & 0xFF) / 255.0 - 0.5) * 0.006;
        return new GeoPoint(base.latitude() + jitterLat, base.longitude() + jitterLon);
    }

    static String address(Household h) {
        if (h.getAddress() != null && !h.getAddress().isBlank()) {
            return h.getAddress();
        }
        return "Residência " + h.getName() + " – " + h.getNeighborhood() + ", " + h.getCity();
    }
}
