package br.com.ecotechzero.lixozero.route;

import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.common.Numbers;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;
import java.util.UUID;

/**
 * Otimizador de rotas de coleta (problema de roteamento de veículos com capacidade, CVRP), em Java puro.
 * <p>
 * O problema exato é NP-difícil; usamos heurísticas clássicas que dão ótimos resultados na prática:
 * <ol>
 *   <li><b>Matriz de distâncias</b> (double[][]) pré-calculada com Haversine: índice 0 = garagem (depósito),
 *       índices 1..n = paradas. Cada consulta de distância passa a custar O(1).</li>
 *   <li><b>Vizinho mais próximo com capacidade</b>: a partir da posição atual, uma {@link PriorityQueue}
 *       (min-heap por distância) entrega a parada ainda não visitada mais próxima que cabe no caminhão.
 *       Quando nenhuma cabe, o caminhão volta à garagem e uma nova viagem começa. Complexidade O(n² log n).</li>
 *   <li><b>2-opt</b>: melhora cada viagem invertendo trechos sempre que isso encurta o percurso
 *       (remove "cruzamentos" da rota) até não haver mais ganho.</li>
 * </ol>
 * Para medir o ganho, comparamos com uma rota "ingênua": paradas na ordem em que as solicitações
 * foram criadas, dividindo por capacidade na mesma ordem. Escolhemos sempre o melhor dos dois planos,
 * então a economia nunca é negativa.
 */
public final class RouteOptimizer {

    /** Velocidade média urbana de um caminhão de coleta (km/h). */
    public static final double AVERAGE_SPEED_KMH = 25;
    /** Tempo médio de atendimento em cada parada (minutos). */
    public static final double SERVICE_MINUTES_PER_STOP = 5;
    private static final int MAX_TWO_OPT_PASSES = 50;

    private RouteOptimizer() {
    }

    /** Parada a visitar (a ordem da lista de entrada = ordem de criação das solicitações). */
    public record Stop(UUID id, double latitude, double longitude, double kg) {
    }

    public record PlannedRoute(List<Stop> stops, double distanceKm, double naiveDistanceKm, int estimatedMinutes, double loadKg) {
    }

    public record Plan(List<PlannedRoute> routes, double totalDistanceKm, double naiveTotalDistanceKm, double savingsPercent) {
    }

    public static Plan optimize(GeoPoint depot, List<Stop> stops, double capacityKg) {
        if (capacityKg <= 0) {
            throw new IllegalArgumentException("A capacidade do veículo deve ser positiva");
        }
        if (stops.isEmpty()) {
            return new Plan(List.of(), 0, 0, 0);
        }
        double[][] dist = distanceMatrix(depot, stops);

        // Plano ingênuo: ordem de criação, dividida por capacidade na mesma ordem
        List<List<Integer>> naiveTrips = splitInOrder(stops, capacityKg);
        double naiveTotal = naiveTrips.stream().mapToDouble(t -> tourLength(dist, t)).sum();

        // Plano otimizado: vizinho mais próximo (com PriorityQueue) + 2-opt em cada viagem
        List<List<Integer>> optimized = nearestNeighbour(dist, stops, capacityKg);
        optimized.replaceAll(trip -> twoOpt(dist, trip));
        double optimizedTotal = optimized.stream().mapToDouble(t -> tourLength(dist, t)).sum();

        // Garantia: se a divisão em ordem + 2-opt for ainda melhor, usamos ela
        List<List<Integer>> naiveImproved = new ArrayList<>(naiveTrips.stream().map(t -> twoOpt(dist, t)).toList());
        double naiveImprovedTotal = naiveImproved.stream().mapToDouble(t -> tourLength(dist, t)).sum();
        if (naiveImprovedTotal < optimizedTotal) {
            optimized = naiveImproved;
            optimizedTotal = naiveImprovedTotal;
        }

        List<PlannedRoute> routes = new ArrayList<>();
        for (List<Integer> trip : optimized) {
            List<Stop> ordered = trip.stream().map(i -> stops.get(i - 1)).toList();
            // rota ingênua desta viagem: as mesmas paradas na ordem de criação
            List<Integer> inCreationOrder = trip.stream().sorted().toList();
            double km = tourLength(dist, trip);
            double load = ordered.stream().mapToDouble(Stop::kg).sum();
            routes.add(new PlannedRoute(ordered, Numbers.round2(km), Numbers.round2(tourLength(dist, inCreationOrder)),
                    estimateMinutes(km, ordered.size()), Numbers.round2(load)));
        }
        double savings = naiveTotal <= 0 ? 0 : (naiveTotal - optimizedTotal) / naiveTotal * 100;
        return new Plan(routes, Numbers.round2(optimizedTotal), Numbers.round2(naiveTotal), Numbers.round(Math.max(0, savings), 1));
    }

    /** Tempo estimado = deslocamento na velocidade média + tempo de serviço em cada parada. */
    public static int estimateMinutes(double distanceKm, int stopCount) {
        return (int) Math.round(distanceKm / AVERAGE_SPEED_KMH * 60 + stopCount * SERVICE_MINUTES_PER_STOP);
    }

    static double[][] distanceMatrix(GeoPoint depot, List<Stop> stops) {
        int n = stops.size() + 1;
        double[] lat = new double[n];
        double[] lon = new double[n];
        lat[0] = depot.latitude();
        lon[0] = depot.longitude();
        for (int i = 1; i < n; i++) {
            lat[i] = stops.get(i - 1).latitude();
            lon[i] = stops.get(i - 1).longitude();
        }
        double[][] d = new double[n][n];
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                d[i][j] = d[j][i] = GeoPoint.haversineKm(lat[i], lon[i], lat[j], lon[j]);
            }
        }
        return d;
    }

    /**
     * Heurística do vizinho mais próximo respeitando a capacidade.
     * Paradas maiores que a capacidade do veículo são atendidas sozinhas numa viagem exclusiva.
     */
    static List<List<Integer>> nearestNeighbour(double[][] dist, List<Stop> stops, double capacityKg) {
        int n = stops.size();
        boolean[] visited = new boolean[n + 1];
        int remaining = n;
        List<List<Integer>> trips = new ArrayList<>();
        while (remaining > 0) {
            List<Integer> trip = new ArrayList<>();
            double load = 0;
            int current = 0; // começa na garagem
            while (true) {
                final int from = current;
                PriorityQueue<Integer> candidates = new PriorityQueue<>(Comparator.comparingDouble(i -> dist[from][i]));
                for (int i = 1; i <= n; i++) {
                    if (!visited[i] && (load + stops.get(i - 1).kg() <= capacityKg || (trip.isEmpty()))) {
                        candidates.add(i);
                    }
                }
                Integer next = candidates.poll();
                if (next == null) {
                    break; // nada mais cabe: volta para a garagem
                }
                visited[next] = true;
                remaining--;
                trip.add(next);
                load += stops.get(next - 1).kg();
                current = next;
                if (load >= capacityKg) {
                    break;
                }
            }
            trips.add(trip);
        }
        return trips;
    }

    /** Divide as paradas por capacidade mantendo a ordem original (plano de referência). */
    static List<List<Integer>> splitInOrder(List<Stop> stops, double capacityKg) {
        List<List<Integer>> trips = new ArrayList<>();
        List<Integer> trip = new ArrayList<>();
        double load = 0;
        for (int i = 1; i <= stops.size(); i++) {
            double kg = stops.get(i - 1).kg();
            if (!trip.isEmpty() && load + kg > capacityKg) {
                trips.add(trip);
                trip = new ArrayList<>();
                load = 0;
            }
            trip.add(i);
            load += kg;
        }
        if (!trip.isEmpty()) {
            trips.add(trip);
        }
        return trips;
    }

    /**
     * 2-opt: para cada par de arestas (a-b) e (c-d) da rota fechada garagem -> ... -> garagem,
     * testa trocá-las por (a-c) e (b-d), o que equivale a inverter o trecho b..c.
     * Aplica a troca sempre que a distância total diminui, repetindo até não haver melhoria.
     */
    static List<Integer> twoOpt(double[][] dist, List<Integer> trip) {
        if (trip.size() < 3) {
            return new ArrayList<>(trip);
        }
        // tour completo com a garagem (0) nas pontas
        int[] tour = new int[trip.size() + 2];
        for (int i = 0; i < trip.size(); i++) {
            tour[i + 1] = trip.get(i);
        }
        boolean improved = true;
        int passes = 0;
        while (improved && passes++ < MAX_TWO_OPT_PASSES) {
            improved = false;
            for (int i = 1; i < tour.length - 2; i++) {
                for (int j = i + 1; j < tour.length - 1; j++) {
                    int a = tour[i - 1], b = tour[i], c = tour[j], d = tour[j + 1];
                    double delta = dist[a][c] + dist[b][d] - dist[a][b] - dist[c][d];
                    if (delta < -1e-9) {
                        reverse(tour, i, j);
                        improved = true;
                    }
                }
            }
        }
        List<Integer> result = new ArrayList<>(trip.size());
        for (int i = 1; i < tour.length - 1; i++) {
            result.add(tour[i]);
        }
        return result;
    }

    /** Comprimento da rota fechada: garagem -> paradas -> garagem. */
    static double tourLength(double[][] dist, List<Integer> trip) {
        if (trip.isEmpty()) {
            return 0;
        }
        double total = dist[0][trip.getFirst()];
        for (int i = 0; i < trip.size() - 1; i++) {
            total += dist[trip.get(i)][trip.get(i + 1)];
        }
        return total + dist[trip.getLast()][0];
    }

    private static void reverse(int[] tour, int from, int to) {
        while (from < to) {
            int tmp = tour[from];
            tour[from++] = tour[to];
            tour[to--] = tmp;
        }
    }
}
