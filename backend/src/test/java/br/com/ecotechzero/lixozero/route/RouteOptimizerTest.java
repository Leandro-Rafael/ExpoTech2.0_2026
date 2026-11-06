package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.route.RouteOptimizer.Plan;
import br.com.ecotechzero.lixozero.route.RouteOptimizer.Stop;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RouteOptimizerTest {

    private static final GeoPoint DEPOT = new GeoPoint(-23.6019, -46.7526);

    private static Stop stop(double lat, double lon, double kg) {
        return new Stop(UUID.randomUUID(), lat, lon, kg);
    }

    @Test
    void visitsEveryStopExactlyOnceAndRespectsCapacity() {
        Random random = new Random(42);
        List<Stop> stops = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            stops.add(stop(-23.62 + random.nextDouble() * 0.05, -46.79 + random.nextDouble() * 0.06, 20 + random.nextInt(60)));
        }
        Plan plan = RouteOptimizer.otimizar(DEPOT, stops, 300);

        Set<UUID> visited = new HashSet<>();
        plan.routes().forEach(r -> r.stops().forEach(s -> assertThat(visited.add(s.id())).isTrue()));
        assertThat(visited).hasSize(stops.size());
        plan.routes().forEach(r -> assertThat(r.loadKg()).isLessThanOrEqualTo(300));
        assertThat(plan.routes().size()).isGreaterThan(1);
    }

    @Test
    void optimizedIsNeverWorseThanNaiveOrder() {
        Random random = new Random(7);
        for (int round = 0; round < 20; round++) {
            List<Stop> stops = new ArrayList<>();
            for (int i = 0; i < 15; i++) {
                stops.add(stop(-23.65 + random.nextDouble() * 0.1, -46.80 + random.nextDouble() * 0.1, 10 + random.nextInt(40)));
            }
            Plan plan = RouteOptimizer.otimizar(DEPOT, stops, 200);
            assertThat(plan.totalDistanceKm()).isLessThanOrEqualTo(plan.naiveTotalDistanceKm() + 0.01);
            assertThat(plan.savingsPercent()).isBetween(0.0, 100.0);
        }
    }

    @Test
    void twoOptRemovesCrossingInZigZagOrder() {
        // Quatro cantos de um quadrado em ordem "cruzada": a rota ingênua forma um X
        List<Stop> stops = List.of(
                stop(-23.60, -46.74), stop(-23.62, -46.76), stop(-23.60, -46.76), stop(-23.62, -46.74));
        Plan plan = RouteOptimizer.otimizar(new GeoPoint(-23.61, -46.73), stops, 1000);
        assertThat(plan.routes()).hasSize(1);
        assertThat(plan.totalDistanceKm()).isLessThan(plan.naiveTotalDistanceKm());
        assertThat(plan.savingsPercent()).isGreaterThan(10);
    }

    @Test
    void oversizedStopGetsItsOwnTrip() {
        List<Stop> stops = List.of(stop(-23.61, -46.75, 1500), stop(-23.611, -46.751, 50));
        Plan plan = RouteOptimizer.otimizar(DEPOT, stops, 1000);
        assertThat(plan.routes()).hasSize(2);
    }

    @Test
    void estimatesTimeFromSpeedAndServiceTime() {
        // 25 km a 25 km/h = 60 min + 4 paradas x 5 min = 80 min
        assertThat(RouteOptimizer.estimarMinutos(25, 4)).isEqualTo(80);
    }

    @Test
    void handlesEmptyInputAndInvalidCapacity() {
        assertThat(RouteOptimizer.otimizar(DEPOT, List.of(), 100).routes()).isEmpty();
        assertThatThrownBy(() -> RouteOptimizer.otimizar(DEPOT, List.of(stop(-23.6, -46.7, 1)), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Stop stop(double lat, double lon) {
        return stop(lat, lon, 10);
    }
}
