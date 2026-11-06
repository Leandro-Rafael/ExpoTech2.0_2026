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
 * <p>
 * Em palavras simples: o caminhão sempre vai para a casa mais perto que ainda cabe na carga, volta quando
 * enche, e no fim a gente "desembaraça" o caminho para não ficar indo e voltando.
 */
public final class RouteOptimizer {

    /** Velocidade média urbana de um caminhão de coleta (km/h). */
    public static final double VELOCIDADE_MEDIA_KMH = 25;
    /** Tempo médio de atendimento em cada parada (minutos). */
    public static final double MINUTOS_ATENDIMENTO_POR_PARADA = 5;
    private static final int MAXIMO_PASSADAS_DOIS_OPT = 50;

    private RouteOptimizer() {
    }

    /** Parada a visitar (a ordem da lista de entrada = ordem de criação das solicitações). */
    public record Stop(UUID id, double latitude, double longitude, double kg) {
    }

    public record PlannedRoute(List<Stop> stops, double distanceKm, double naiveDistanceKm, int estimatedMinutes, double loadKg) {
    }

    public record Plan(List<PlannedRoute> routes, double totalDistanceKm, double naiveTotalDistanceKm, double savingsPercent) {
    }

    public static Plan otimizar(GeoPoint garagem, List<Stop> paradas, double capacidadeKg) {
        if (capacidadeKg <= 0) {
            throw new IllegalArgumentException("A capacidade do veículo deve ser positiva");
        }
        if (paradas.isEmpty()) {
            return new Plan(List.of(), 0, 0, 0);
        }
        // 1. Calcula uma vez a distância entre todos os pontos (garagem + paradas).
        double[][] distancias = matrizDistancias(garagem, paradas);

        // 2. Plano ingênuo, só para comparar.
        // Plano ingênuo: ordem de criação, dividida por capacidade na mesma ordem
        List<List<Integer>> viagensIngenuas = dividirNaOrdem(paradas, capacidadeKg);
        double totalIngenuo = viagensIngenuas.stream().mapToDouble(t -> comprimentoRota(distancias, t)).sum();

        // 3. Plano otimizado.
        // Plano otimizado: vizinho mais próximo (com PriorityQueue) + 2-opt em cada viagem
        List<List<Integer>> otimizadas = vizinhoMaisProximo(distancias, paradas, capacidadeKg);
        otimizadas.replaceAll(viagem -> doisOpt(distancias, viagem));
        double totalOtimizado = otimizadas.stream().mapToDouble(t -> comprimentoRota(distancias, t)).sum();

        // 4. Fica com o melhor dos dois.
        // Garantia: se a divisão em ordem + 2-opt for ainda melhor, usamos ela
        List<List<Integer>> ingenuasMelhoradas = new ArrayList<>(viagensIngenuas.stream().map(t -> doisOpt(distancias, t)).toList());
        double totalIngenuasMelhoradas = ingenuasMelhoradas.stream().mapToDouble(t -> comprimentoRota(distancias, t)).sum();
        if (totalIngenuasMelhoradas < totalOtimizado) {
            otimizadas = ingenuasMelhoradas;
            totalOtimizado = totalIngenuasMelhoradas;
        }

        // 5. Monta cada viagem com km, tempo estimado e carga, e calcula a economia em %.
        List<PlannedRoute> rotas = new ArrayList<>();
        for (List<Integer> viagem : otimizadas) {
            List<Stop> ordenadas = viagem.stream().map(i -> paradas.get(i - 1)).toList();
            // rota ingênua desta viagem: as mesmas paradas na ordem de criação
            List<Integer> naOrdemDeCriacao = viagem.stream().sorted().toList();
            double km = comprimentoRota(distancias, viagem);
            double carga = ordenadas.stream().mapToDouble(Stop::kg).sum();
            rotas.add(new PlannedRoute(ordenadas, Numbers.arredondar2(km), Numbers.arredondar2(comprimentoRota(distancias, naOrdemDeCriacao)),
                    estimarMinutos(km, ordenadas.size()), Numbers.arredondar2(carga)));
        }
        double economia = totalIngenuo <= 0 ? 0 : (totalIngenuo - totalOtimizado) / totalIngenuo * 100;
        return new Plan(rotas, Numbers.arredondar2(totalOtimizado), Numbers.arredondar2(totalIngenuo), Numbers.arredondar(Math.max(0, economia), 1));
    }

    /** Tempo estimado = deslocamento na velocidade média + tempo de serviço em cada parada. */
    public static int estimarMinutos(double distanciaKm, int quantidadeParadas) {
        return (int) Math.round(distanciaKm / VELOCIDADE_MEDIA_KMH * 60 + quantidadeParadas * MINUTOS_ATENDIMENTO_POR_PARADA);
    }

    /** Comprimento (km) da rota fechada garagem -> pontos na ordem dada -> garagem. */
    public static double kmRotaFechada(GeoPoint garagem, List<GeoPoint> pontos) {
        if (pontos.isEmpty()) {
            return 0;
        }
        double total = 0;
        GeoPoint anterior = garagem;
        for (GeoPoint p : pontos) {
            total += anterior.distanciaKm(p);
            anterior = p;
        }
        return total + anterior.distanciaKm(garagem);
    }

    static double[][] matrizDistancias(GeoPoint garagem, List<Stop> paradas) {
        int n = paradas.size() + 1;
        double[] lat = new double[n];
        double[] lon = new double[n];
        lat[0] = garagem.latitude();
        lon[0] = garagem.longitude();
        for (int i = 1; i < n; i++) {
            lat[i] = paradas.get(i - 1).latitude();
            lon[i] = paradas.get(i - 1).longitude();
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
    static List<List<Integer>> vizinhoMaisProximo(double[][] distancias, List<Stop> paradas, double capacidadeKg) {
        int n = paradas.size();
        boolean[] visitadas = new boolean[n + 1];
        int restantes = n;
        List<List<Integer>> viagens = new ArrayList<>();
        while (restantes > 0) {
            List<Integer> viagem = new ArrayList<>();
            double carga = 0;
            int atual = 0; // começa na garagem
            while (true) {
                final int origem = atual;
                PriorityQueue<Integer> candidatas = new PriorityQueue<>(Comparator.comparingDouble(i -> distancias[origem][i]));
                for (int i = 1; i <= n; i++) {
                    if (!visitadas[i] && (carga + paradas.get(i - 1).kg() <= capacidadeKg || (viagem.isEmpty()))) {
                        candidatas.add(i);
                    }
                }
                Integer proxima = candidatas.poll();
                if (proxima == null) {
                    break; // nada mais cabe: volta para a garagem
                }
                visitadas[proxima] = true;
                restantes--;
                viagem.add(proxima);
                carga += paradas.get(proxima - 1).kg();
                atual = proxima;
                if (carga >= capacidadeKg) {
                    break;
                }
            }
            viagens.add(viagem);
        }
        return viagens;
    }

    /** Divide as paradas por capacidade mantendo a ordem original (plano de referência). */
    static List<List<Integer>> dividirNaOrdem(List<Stop> paradas, double capacidadeKg) {
        List<List<Integer>> viagens = new ArrayList<>();
        List<Integer> viagem = new ArrayList<>();
        double carga = 0;
        for (int i = 1; i <= paradas.size(); i++) {
            double kg = paradas.get(i - 1).kg();
            if (!viagem.isEmpty() && carga + kg > capacidadeKg) {
                viagens.add(viagem);
                viagem = new ArrayList<>();
                carga = 0;
            }
            viagem.add(i);
            carga += kg;
        }
        if (!viagem.isEmpty()) {
            viagens.add(viagem);
        }
        return viagens;
    }

    /**
     * 2-opt: para cada par de arestas (a-b) e (c-d) da rota fechada garagem -> ... -> garagem,
     * testa trocá-las por (a-c) e (b-d), o que equivale a inverter o trecho b..c.
     * Aplica a troca sempre que a distância total diminui, repetindo até não haver melhoria.
     */
    static List<Integer> doisOpt(double[][] distancias, List<Integer> viagem) {
        if (viagem.size() < 3) {
            return new ArrayList<>(viagem);
        }
        // tour completo com a garagem (0) nas pontas
        int[] circuito = new int[viagem.size() + 2];
        for (int i = 0; i < viagem.size(); i++) {
            circuito[i + 1] = viagem.get(i);
        }
        boolean melhorou = true;
        int passadas = 0;
        while (melhorou && passadas++ < MAXIMO_PASSADAS_DOIS_OPT) {
            melhorou = false;
            for (int i = 1; i < circuito.length - 2; i++) {
                for (int j = i + 1; j < circuito.length - 1; j++) {
                    int a = circuito[i - 1], b = circuito[i], c = circuito[j], d = circuito[j + 1];
                    double delta = distancias[a][c] + distancias[b][d] - distancias[a][b] - distancias[c][d];
                    if (delta < -1e-9) {
                        inverter(circuito, i, j);
                        melhorou = true;
                    }
                }
            }
        }
        List<Integer> resultado = new ArrayList<>(viagem.size());
        for (int i = 1; i < circuito.length - 1; i++) {
            resultado.add(circuito[i]);
        }
        return resultado;
    }

    /** Comprimento da rota fechada: garagem -> paradas -> garagem. */
    static double comprimentoRota(double[][] distancias, List<Integer> viagem) {
        if (viagem.isEmpty()) {
            return 0;
        }
        double total = distancias[0][viagem.getFirst()];
        for (int i = 0; i < viagem.size() - 1; i++) {
            total += distancias[viagem.get(i)][viagem.get(i + 1)];
        }
        return total + distancias[viagem.getLast()][0];
    }

    private static void inverter(int[] circuito, int origem, int destino) {
        while (origem < destino) {
            int temporario = circuito[origem];
            circuito[origem++] = circuito[destino];
            circuito[destino--] = temporario;
        }
    }
}
