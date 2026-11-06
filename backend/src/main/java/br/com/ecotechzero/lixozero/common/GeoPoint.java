package br.com.ecotechzero.lixozero.common;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** Coordenada geográfica (WGS84). */
public record GeoPoint(
        @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude) {

    private static final double RAIO_TERRA_KM = 6371.0088;

    /**
     * Distância em km pela fórmula de Haversine (distância sobre a superfície da esfera terrestre).
     */
    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    public double distanciaKm(GeoPoint outro) {
        return haversineKm(latitude, longitude, outro.latitude, outro.longitude);
    }
}
