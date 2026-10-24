package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.collection.CollectionSource;
import br.com.ecotechzero.lixozero.common.GeoPoint;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Ao cancelar uma solicitação já agendada, a rota recalcula distância, tempo e carga. */
class RouteCancellationTest {

    @Test
    void removingAStopRecalculatesRouteMetrics() {
        GeoPoint depot = new GeoPoint(-23.60, -46.75);
        CollectionRoute route = new CollectionRoute("Rota teste", null, LocalDate.now(), depot.latitude(), depot.longitude());
        CollectionRequest a = request(-23.61, -46.76, 10);
        CollectionRequest far = request(-23.80, -46.95, 20); // parada distante
        CollectionRequest c = request(-23.62, -46.77, 30);
        route.addStop(a);
        RouteStop farStop = route.addStop(far);
        route.addStop(c);
        double before = RouteOptimizer.closedTourKm(depot, List.of(point(a), point(far), point(c)));
        route.setMetrics(before, before, RouteOptimizer.estimateMinutes(before, 3), 60);

        route.removeStop(farStop);

        double expected = RouteOptimizer.closedTourKm(depot, List.of(point(a), point(c)));
        assertThat(route.getStops()).hasSize(2);
        assertThat(route.getStops()).extracting(RouteStop::getSequence).containsExactly(1, 2);
        assertThat(route.getTotalDistanceKm()).isCloseTo(expected, org.assertj.core.data.Offset.offset(0.01));
        assertThat(route.getTotalDistanceKm()).isLessThan(before);
        assertThat(route.getEstimatedMinutes()).isEqualTo(RouteOptimizer.estimateMinutes(route.getTotalDistanceKm(), 2));
        assertThat(route.getLoadKg()).isEqualTo(40);
        assertThat(route.getNaiveDistanceKm()).isGreaterThanOrEqualTo(route.getTotalDistanceKm());

        // última parada removida: rota vazia com métricas zeradas
        route.removeStop(route.getStops().get(0));
        route.removeStop(route.getStops().get(0));
        assertThat(route.getTotalDistanceKm()).isZero();
        assertThat(route.getLoadKg()).isZero();
        assertThat(route.getEstimatedMinutes()).isZero();
    }

    private static CollectionRequest request(double lat, double lon, double kg) {
        return new CollectionRequest(CollectionSource.USER, "Rua Teste, 123", lat, lon, Set.of(CategoryCode.PLASTICO), kg);
    }

    private static GeoPoint point(CollectionRequest r) {
        return new GeoPoint(r.getLatitude(), r.getLongitude());
    }
}
