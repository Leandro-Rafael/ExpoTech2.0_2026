package br.com.ecotechzero.lixozero.seed;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.category.RepositorioCategorias;
import br.com.ecotechzero.lixozero.collection.CollectionPoint;
import br.com.ecotechzero.lixozero.collection.RepositorioEcopontos;
import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.collection.RepositorioSolicitacoesColeta;
import br.com.ecotechzero.lixozero.collection.OrigemColeta;
import br.com.ecotechzero.lixozero.common.PontoGeografico;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.disposal.Disposal;
import br.com.ecotechzero.lixozero.disposal.RepositorioDescartes;
import br.com.ecotechzero.lixozero.disposal.CalculadoraPontos;
import br.com.ecotechzero.lixozero.gamification.Challenge;
import br.com.ecotechzero.lixozero.gamification.RepositorioDesafios;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.ChallengeInput;
import br.com.ecotechzero.lixozero.gamification.ServicoGamificacao;
import br.com.ecotechzero.lixozero.household.BinReading;
import br.com.ecotechzero.lixozero.household.RepositorioLeiturasLixeira;
import br.com.ecotechzero.lixozero.household.Household;
import br.com.ecotechzero.lixozero.household.RepositorioResidencias;
import br.com.ecotechzero.lixozero.household.SmartBin;
import br.com.ecotechzero.lixozero.household.RepositorioLixeiras;
import br.com.ecotechzero.lixozero.household.ServicoLixeiras;
import br.com.ecotechzero.lixozero.impact.Goal;
import br.com.ecotechzero.lixozero.impact.RepositorioMetas;
import br.com.ecotechzero.lixozero.organization.Organization;
import br.com.ecotechzero.lixozero.organization.RepositorioOrganizacoes;
import br.com.ecotechzero.lixozero.integrity.HashesCadeia.LedgerRow;
import br.com.ecotechzero.lixozero.integrity.CadeiaExtrato;
import br.com.ecotechzero.lixozero.points.PointTransactionType;
import br.com.ecotechzero.lixozero.reward.Redemption;
import br.com.ecotechzero.lixozero.reward.RepositorioResgates;
import br.com.ecotechzero.lixozero.reward.Reward;
import br.com.ecotechzero.lixozero.reward.RepositorioRecompensas;
import br.com.ecotechzero.lixozero.route.DtosRota.CreateRouteRequest;
import br.com.ecotechzero.lixozero.route.ServicoRotas;
import br.com.ecotechzero.lixozero.user.PerfilUsuario;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Cria dados de demonstração realistas (APP_DEMO_SEED=true) quando o banco ainda não tem usuários:
 * contas de demonstração, ~26 moradores em 8 residências, ~12 meses de descartes, extrato de pontos,
 * resgates, desafios, metas, solicitações de coleta, uma rota planejada e lixeiras inteligentes com histórico.
 * Os dados são gerados com semente fixa (resultado reproduzível) e gravados em lote.
 */
@Component
@Order(10)
public class SemeadorDadosDemo implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SemeadorDadosDemo.class);

    public static final String ADMIN_EMAIL = "admin@ecotechzero.com.br";
    public static final String ADMIN_PASSWORD = "EcoTech@2050";
    public static final String COLLECTOR_EMAIL = "coletor@ecotechzero.com.br";
    public static final String COLLECTOR_PASSWORD = "Coleta@2050";
    public static final String RESIDENT_EMAIL = "morador@ecotechzero.com.br";
    public static final String RESIDENT_PASSWORD = "Recicla@2050";

    private static final String[] NOMES = {
            "Ana Beatriz Souza", "Bruno Henrique Lima", "Camila Rodrigues", "Diego Fernandes", "Eduarda Martins",
            "Felipe Araújo", "Gabriela Nunes", "Heitor Barbosa", "Isabela Carvalho", "João Pedro Ribeiro",
            "Larissa Gomes", "Matheus Oliveira", "Natália Pereira", "Otávio Santos", "Paula Mendes",
            "Rafael Costa", "Sofia Almeida", "Thiago Rocha", "Valentina Dias", "Vinícius Teixeira",
            "Yasmin Cardoso", "Leonardo Moreira", "Juliana Freitas", "Gustavo Pinto", "Beatriz Lopes"};

    private record HouseSpec(String name, String neighborhood, String city, String address, double lat, double lon) {
    }

    private static final List<HouseSpec> RESIDENCIAS_DEMO = List.of(
            new HouseSpec("Família Silva", "Jardim Maria Rosa", "Taboão da Serra", "Rua Cesário Dau, 410", -23.6052, -46.7549),
            new HouseSpec("Família Souza", "Parque Pinheiros", "Taboão da Serra", "Rua das Acácias, 77", -23.6131, -46.7702),
            new HouseSpec("Família Lima", "Vila Iasi", "Taboão da Serra", "Rua Benedito Pires, 152", -23.6081, -46.7761),
            new HouseSpec("República Verde", "Jardim Record", "Taboão da Serra", "Rua Ipiranga, 980", -23.6169, -46.7815),
            new HouseSpec("Família Costa", "Centro", "Taboão da Serra", "Rua Joaquim Lopes, 35", -23.6236, -46.7826),
            new HouseSpec("Família Oliveira", "Jardim Mituzi", "Taboão da Serra", "Rua Sebastião Marçal, 260", -23.6297, -46.7741),
            new HouseSpec("Casa Almeida", "Vila Sônia", "São Paulo", "Rua Dr. Luiz Migliano, 1500", -23.5951, -46.7378),
            new HouseSpec("Família Rocha", "Campo Limpo", "São Paulo", "Rua Arnaldo Magniccaro, 420", -23.6376, -46.7629));

    /** Peso (frequência) e kg típico de cada categoria nos descartes simulados. */
    private static final Map<CodigoCategoria, double[]> PERFIL_CATEGORIAS = new EnumMap<>(Map.of(
            CodigoCategoria.PLASTICO, new double[]{24, 1.6},
            CodigoCategoria.PAPEL, new double[]{22, 2.4},
            CodigoCategoria.VIDRO, new double[]{10, 2.2},
            CodigoCategoria.METAL, new double[]{9, 0.9},
            CodigoCategoria.ORGANICO, new double[]{17, 2.8},
            CodigoCategoria.ELETRONICO, new double[]{3, 1.3},
            CodigoCategoria.REJEITO, new double[]{15, 2.0}));

    private static final String[] MOTIVOS_RECUSA = {
            "A foto não comprova o descarte.", "Categoria informada não corresponde ao material.",
            "Quantidade incompatível com o registro.", "Registro duplicado."};

    private final PropriedadesApp propriedades;
    private final RepositorioUsuarios usuarios;
    private final RepositorioResidencias residencias;
    private final RepositorioOrganizacoes organizacoes;
    private final RepositorioCategorias categorias;
    private final RepositorioEcopontos ecopontos;
    private final RepositorioDescartes descartes;
    private final CadeiaExtrato extrato;
    private final RepositorioRecompensas recompensas;
    private final RepositorioResgates resgates;
    private final RepositorioDesafios desafios;
    private final RepositorioMetas metas;
    private final RepositorioLixeiras lixeiras;
    private final RepositorioLeiturasLixeira leituras;
    private final RepositorioSolicitacoesColeta solicitacoes;
    private final ServicoGamificacao gamificacao;
    private final ServicoLixeiras servicoLixeiras;
    private final ServicoRotas rotas;
    private final ServicoAuditoria auditoria;
    private final PasswordEncoder codificador;
    private final TransactionTemplate tx;
    private final Clock relogio;

    public SemeadorDadosDemo(PropriedadesApp propriedades, RepositorioUsuarios usuarios, RepositorioResidencias residencias, RepositorioOrganizacoes organizacoes,
                          RepositorioCategorias categorias, RepositorioEcopontos ecopontos, RepositorioDescartes descartes,
                          CadeiaExtrato extrato, RepositorioRecompensas recompensas, RepositorioResgates resgates,
                          RepositorioDesafios desafios, RepositorioMetas metas, RepositorioLixeiras lixeiras, RepositorioLeiturasLixeira leituras,
                          RepositorioSolicitacoesColeta solicitacoes, ServicoGamificacao gamificacao, ServicoLixeiras servicoLixeiras,
                          ServicoRotas rotas, ServicoAuditoria auditoria, PasswordEncoder codificador, TransactionTemplate tx, Clock relogio) {
        this.propriedades = propriedades;
        this.usuarios = usuarios;
        this.residencias = residencias;
        this.organizacoes = organizacoes;
        this.categorias = categorias;
        this.ecopontos = ecopontos;
        this.descartes = descartes;
        this.extrato = extrato;
        this.recompensas = recompensas;
        this.resgates = resgates;
        this.desafios = desafios;
        this.metas = metas;
        this.lixeiras = lixeiras;
        this.leituras = leituras;
        this.solicitacoes = solicitacoes;
        this.gamificacao = gamificacao;
        this.servicoLixeiras = servicoLixeiras;
        this.rotas = rotas;
        this.auditoria = auditoria;
        this.codificador = codificador;
        this.tx = tx;
        this.relogio = relogio;
    }

    @Override
    public void run(ApplicationArguments argumentos) {
        if (!propriedades.demoSeed() || usuarios.count() > 0) {
            return;
        }
        long inicio = System.currentTimeMillis();
        log.info("Banco vazio: criando dados de demonstração...");
        Random aleatorio = new Random(2050);
        Instant agora = relogio.instant();
        ZoneId fuso = propriedades.zoneId();

        SeedContext contexto = tx.execute(status -> semearBase(aleatorio, agora, fuso));
        // Bônus de desafios e medalhas usam as mesmas regras do sistema (uma transação por usuário)
        for (UUID idUsuario : contexto.idsMoradores) {
            tx.executeWithoutResult(status -> gamificacao.aoAprovarDescarte(idUsuario, agora));
        }
        semearLixeiras(aleatorio, agora, contexto);
        semearSolicitacoesERota(aleatorio, agora, fuso, contexto);
        auditoria.registrarComo(null, "sistema", AcaoAuditoria.DEMO_DATA_SEEDED, null, null,
                contexto.idsMoradores.size() + " moradores e " + contexto.totalDescartes + " descartes de demonstração");
        log.info("Dados de demonstração criados em {} ms ({} descartes). Logins: {} | {} | {}",
                System.currentTimeMillis() - inicio, contexto.totalDescartes, ADMIN_EMAIL, COLLECTOR_EMAIL, RESIDENT_EMAIL);
    }

    private static final class SeedContext {
        final List<UUID> idsMoradores = new ArrayList<>();
        final List<Household> casas = new ArrayList<>();
        final Map<UUID, Household> casaDoUsuario = new HashMap<>();
        UUID idColetor;
        UUID idMorador;
        int totalDescartes;
    }

    private SeedContext semearBase(Random aleatorio, Instant agora, ZoneId fuso) {
        SeedContext contexto = new SeedContext();
        Map<CodigoCategoria, Category> categoriasPorCodigo = new EnumMap<>(CodigoCategoria.class);
        categorias.findAll().forEach(c -> categoriasPorCodigo.put(c.getCode(), c));
        List<CollectionPoint> todosEcopontos = ecopontos.findByActiveTrue();
        List<Organization> listaOrganizacoes = organizacoes.findAllByOrderByName();

        // ---------- Residências ----------
        for (int i = 0; i < RESIDENCIAS_DEMO.size(); i++) {
            HouseSpec especificacao = RESIDENCIAS_DEMO.get(i);
            Household h = new Household(especificacao.name(), especificacao.neighborhood(), especificacao.city(), "DEMO" + (2050 + i));
            h.setLocation(especificacao.address(), especificacao.lat(), especificacao.lon());
            h.setCreatedAt(agora.minus(Duration.ofDays(380 - i * 3L)));
            contexto.casas.add(h);
        }
        residencias.saveAll(contexto.casas);

        // ---------- Usuários ----------
        Instant contasCriadasEm = agora.minus(Duration.ofDays(385));
        User admin = new User("Administrador EcoTech", ADMIN_EMAIL, codificador.encode(ADMIN_PASSWORD), PerfilUsuario.ADMIN);
        User coletor = new User("Carlos Pereira (coletor)", COLLECTOR_EMAIL, codificador.encode(COLLECTOR_PASSWORD), PerfilUsuario.COLLECTOR);
        User coletor2 = new User("Renata Alves (coletora)", "renata.alves@ecotechzero.com.br", codificador.encode(COLLECTOR_PASSWORD), PerfilUsuario.COLLECTOR);
        User morador = new User("Marina Silva", RESIDENT_EMAIL, codificador.encode(RESIDENT_PASSWORD), PerfilUsuario.USER);
        morador.setHousehold(contexto.casas.getFirst());
        morador.setOrganization(listaOrganizacoes.stream().filter(o -> o.getName().startsWith("Ciência")).findFirst().orElse(null));
        List<User> todos = new ArrayList<>(List.of(admin, coletor, coletor2, morador));
        // Os demais moradores compartilham o hash da senha de demonstração (calcular Argon2 25x seria lento)
        String hashCompartilhado = codificador.encode(RESIDENT_PASSWORD);
        List<User> moradores = new ArrayList<>(List.of(morador));
        for (int i = 0; i < NOMES.length; i++) {
            String email = Textos.semAcentos(NOMES[i]).replaceAll("[^a-z ]", "").strip().replaceAll("\\s+", ".") + "@exemplo.com.br";
            User u = new User(NOMES[i], email, hashCompartilhado, PerfilUsuario.USER);
            if (i % 9 != 8) {
                u.setHousehold(contexto.casas.get((i + 1) % contexto.casas.size()));
            }
            if (i % 4 != 3) {
                u.setOrganization(listaOrganizacoes.get(i % listaOrganizacoes.size()));
            }
            moradores.add(u);
            todos.add(u);
        }
        for (int i = 0; i < todos.size(); i++) {
            User u = todos.get(i);
            u.setCreatedAt(contasCriadasEm.plus(Duration.ofDays(i * 2L)));
            u.setLastLoginAt(agora.minus(Duration.ofHours(aleatorio.nextInt(1, 24 * 20))));
        }
        usuarios.saveAll(todos);
        for (int i = 0; i < contexto.casas.size(); i++) {
            Household h = contexto.casas.get(i);
            moradores.stream().filter(u -> u.getHousehold() == h).findFirst().ifPresent(h::setOwner);
        }
        contexto.idColetor = coletor.getId();
        contexto.idMorador = morador.getId();
        moradores.forEach(u -> {
            contexto.idsMoradores.add(u.getId());
            if (u.getHousehold() != null) {
                contexto.casaDoUsuario.put(u.getId(), u.getHousehold());
            }
        });

        // ---------- Desafios e metas ----------
        semearDesafiosEMetas(agora, fuso);

        // ---------- Descartes, extrato e resgates ----------
        List<Reward> catalogo = recompensas.findAllByOrderByCostPoints();
        List<Disposal> todosDescartes = new ArrayList<>();
        List<SeedTx> todosLancamentos = new ArrayList<>();
        List<Redemption> todosResgates = new ArrayList<>();
        int sinalizadosRestantes = 6;
        for (User u : moradores) {
            boolean ehDemo = u == morador;
            double taxa = ehDemo ? 0.32 : 0.06 + aleatorio.nextDouble() * 0.26;
            List<Disposal> doUsuario = gerarDescartes(u, taxa, ehDemo, categoriasPorCodigo, todosEcopontos, contexto.casaDoUsuario.get(u.getId()), admin, aleatorio, agora, fuso);
            if (sinalizadosRestantes > 0 && !ehDemo && aleatorio.nextInt(3) == 0) {
                Disposal descarteSuspeito = descarteSuspeito(u, categoriasPorCodigo, aleatorio, agora);
                doUsuario.add(descarteSuspeito);
                sinalizadosRestantes--;
            }
            todosDescartes.addAll(doUsuario);
            montarExtrato(u, doUsuario, catalogo, aleatorio, agora, todosLancamentos, todosResgates);
        }
        descartes.saveAll(todosDescartes);
        resgates.saveAll(todosResgates);
        // extrato encadeado (HMAC) na ordem cronológica de cada usuário; os ids de descartes/resgates já existem
        extrato.anexarTodos(todosLancamentos.stream().map(t -> new LedgerRow(null, t.user().getId(), t.type().name(), t.amount(), t.balanceAfter(),
                t.description(), t.disposal() == null ? null : t.disposal().getId(), null,
                t.redemption() == null ? null : t.redemption().getId(), t.at())).toList());
        contexto.totalDescartes = todosDescartes.size();
        return contexto;
    }

    private List<Disposal> gerarDescartes(User u, double taxa, boolean ehDemo, Map<CodigoCategoria, Category> categoriasPorCodigo,
                                             List<CollectionPoint> todosEcopontos, Household casa, User revisor,
                                             Random aleatorio, Instant agora, ZoneId fuso) {
        List<Disposal> lista = new ArrayList<>();
        LocalDate hoje = LocalDate.now(relogio.withZone(fuso));
        PontoGeografico base = casa != null ? new PontoGeografico(casa.getLatitude(), casa.getLongitude()) : new PontoGeografico(-23.6090, -46.7580);
        for (int diasAtras = 365; diasAtras >= 0; diasAtras--) {
            double crescimento = 0.45 + 0.55 * (365 - diasAtras) / 365.0; // a adesão cresce ao longo do ano
            boolean forcado = ehDemo && diasAtras <= 8;              // sequência de dias do morador de demonstração
            if (!forcado && aleatorio.nextDouble() > taxa * crescimento) {
                continue;
            }
            LocalDate dia = hoje.minusDays(diasAtras);
            Instant momento = dia.atTime(8 + aleatorio.nextInt(13), aleatorio.nextInt(60)).atZone(fuso).toInstant();
            if (momento.isAfter(agora.minus(Duration.ofMinutes(20)))) {
                momento = agora.minus(Duration.ofMinutes(20 + aleatorio.nextInt(120)));
            }
            Category categoria = categoriasPorCodigo.get(sortearCategoria(aleatorio));
            double kgTipico = PERFIL_CATEGORIAS.get(categoria.getCode())[1];
            double kg = Numeros.arredondar(Math.min(categoria.getMaxKgPerDisposal() * 0.6, Math.max(0.1, kgTipico * (0.4 + aleatorio.nextDouble() * 1.4))), 2);
            Disposal d = new Disposal(u, categoria, kg, momento);
            d.setCreatedAt(momento.plusSeconds(30));
            d.setLocation(base.latitude() + (aleatorio.nextDouble() - 0.5) * 0.004, base.longitude() + (aleatorio.nextDouble() - 0.5) * 0.004);
            if (aleatorio.nextInt(10) < 4) {
                todosEcopontos.stream().filter(p -> p.accepts(categoria.getCode()))
                        .min(Comparator.comparingDouble(p -> PontoGeografico.haversineKm(base.latitude(), base.longitude(), p.getLatitude(), p.getLongitude())))
                        .ifPresent(d::setCollectionPoint);
            }
            if (aleatorio.nextInt(10) < 3) {
                d.recordClientHint(categoria.getCode(), Numeros.arredondar(0.7 + aleatorio.nextDouble() * 0.29, 3), OrigemIa.LOCAL);
            }
            int pontosDescarte = CalculadoraPontos.calcular(categoria.getPointsPerKg(), kg, false);
            d.setEstimatedPoints(pontosDescarte);
            d.setFraud(aleatorio.nextInt(3) == 0 ? aleatorio.nextInt(5, 20) : 0, List.of(), false);
            boolean recente = diasAtras <= 1 && !(ehDemo && diasAtras == 1);
            if (recente && aleatorio.nextInt(10) < 8) {
                // pendente: aguardando moderação
            } else if (!forcado && aleatorio.nextInt(100) < 5) {
                d.reject(MOTIVOS_RECUSA[aleatorio.nextInt(MOTIVOS_RECUSA.length)], revisor, horaRevisao(momento, aleatorio, agora));
            } else {
                d.approve(pontosDescarte, revisor, horaRevisao(momento, aleatorio, agora));
            }
            lista.add(d);
        }
        return lista;
    }

    /** Descarte pendente sinalizado pelo antifraude (fila de revisão do admin). */
    private Disposal descarteSuspeito(User u, Map<CodigoCategoria, Category> categoriasPorCodigo, Random aleatorio, Instant agora) {
        Category categoria = categoriasPorCodigo.get(aleatorio.nextBoolean() ? CodigoCategoria.ELETRONICO : CodigoCategoria.METAL);
        double kg = Numeros.arredondar(categoria.getMaxKgPerDisposal() * (0.85 + aleatorio.nextDouble() * 0.15), 2);
        Instant momento = agora.minus(Duration.ofHours(aleatorio.nextInt(2, 72)));
        Disposal d = new Disposal(u, categoria, kg, momento);
        d.setCreatedAt(momento.plusSeconds(20));
        d.setEstimatedPoints(CalculadoraPontos.calcular(categoria.getPointsPerKg(), kg, false));
        List<String> alertas = new ArrayList<>(List.of(
                "Quantidade próxima do máximo permitido para a categoria (" + categoria.getMaxKgPerDisposal() + " kg).",
                "Descarte acima de 5 kg sem foto de comprovação."));
        int pontuacao = 35;
        if (aleatorio.nextBoolean()) {
            alertas.add("Muitos registros em pouco tempo (5 em 10 minutos).");
            pontuacao += 30;
        } else {
            d.recordClientHint(CodigoCategoria.REJEITO, 0.86, OrigemIa.LOCAL);
            alertas.add("Categoria informada (" + categoria.getCode() + ") difere da sugerida pela IA (REJEITO, 86% de confiança).");
            pontuacao += 15;
        }
        d.setFraud(Math.min(100, pontuacao), alertas, true);
        return d;
    }

    private static Instant horaRevisao(Instant momento, Random aleatorio, Instant agora) {
        Instant revisadoEm = momento.plus(Duration.ofMinutes(90 + aleatorio.nextInt(60 * 30)));
        Instant limite = agora.minus(Duration.ofMinutes(10));
        return revisadoEm.isAfter(limite) ? limite : revisadoEm;
    }

    private static CodigoCategoria sortearCategoria(Random aleatorio) {
        double total = PERFIL_CATEGORIAS.values().stream().mapToDouble(v -> v[0]).sum();
        double r = aleatorio.nextDouble() * total;
        for (var e : PERFIL_CATEGORIAS.entrySet()) {
            r -= e.getValue()[0];
            if (r <= 0) {
                return e.getKey();
            }
        }
        return CodigoCategoria.PLASTICO;
    }

    /** Monta o extrato em ordem cronológica (saldo após cada lançamento) e alguns resgates. */
    private void montarExtrato(User u, List<Disposal> doUsuario, List<Reward> catalogo, Random aleatorio, Instant agora,
                             List<SeedTx> lancamentosSaida, List<Redemption> resgatesSaida) {
        List<Disposal> aprovados = doUsuario.stream().filter(d -> d.getReviewedAt() != null && d.getPointsAwarded() > 0)
                .sorted(Comparator.comparing(Disposal::getReviewedAt)).toList();
        long saldo = 0, ganhos = 0;
        int resgatados = 0;
        for (Disposal d : aprovados) {
            saldo += d.getPointsAwarded();
            ganhos += d.getPointsAwarded();
            lancamentosSaida.add(new SeedTx(u, PointTransactionType.EARN, d.getPointsAwarded(), saldo,
                    String.format(Locale.forLanguageTag("pt-BR"), "Descarte aprovado: %.2f kg de %s", d.getQuantityKg(), d.getCategory().getName()),
                    d, null, d.getReviewedAt()));
            if (resgatados < 3 && aleatorio.nextInt(100) < 5) {
                final long disponivel = saldo;
                List<Reward> acessiveis = catalogo.stream().filter(r -> r.getCostPoints() <= disponivel && r.getStock() > 0).toList();
                if (!acessiveis.isEmpty()) {
                    Reward recompensa = acessiveis.get(aleatorio.nextInt(acessiveis.size()));
                    recompensa.decrementStock();
                    Instant momento = d.getReviewedAt().plus(Duration.ofHours(2));
                    if (momento.isAfter(agora)) {
                        momento = agora.minus(Duration.ofMinutes(5));
                    }
                    Redemption resgate = new Redemption(u, recompensa, recompensa.getCostPoints(), gerarVoucher(aleatorio));
                    resgate.setCreatedAt(momento);
                    if (momento.isBefore(agora.minus(Duration.ofDays(20)))) {
                        resgate.setStatus(Redemption.Status.USED);
                    }
                    resgatesSaida.add(resgate);
                    saldo -= recompensa.getCostPoints();
                    lancamentosSaida.add(new SeedTx(u, PointTransactionType.REDEEM, -recompensa.getCostPoints(), saldo,
                            "Resgate: " + recompensa.getName(), null, resgate, momento));
                    resgatados++;
                }
            }
        }
        u.setPoints(saldo);
        u.setTotalEarned(ganhos);
    }

    /** Lançamento do extrato montado em memória (gravado depois, já encadeado, pela CadeiaExtrato). */
    private record SeedTx(User user, PointTransactionType type, int amount, long balanceAfter, String description,
                          Disposal disposal, Redemption redemption, Instant at) {
    }

    private static String gerarVoucher(Random aleatorio) {
        String alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder("LZ50-");
        for (int i = 0; i < 8; i++) {
            if (i == 4) sb.append('-');
            sb.append(alfabeto.charAt(aleatorio.nextInt(alfabeto.length())));
        }
        return sb.toString();
    }

    private void semearDesafiosEMetas(Instant agora, ZoneId fuso) {
        LocalDate hoje = LocalDate.now(relogio.withZone(fuso));
        YearMonth mes = YearMonth.from(hoje);
        List<Challenge> lista = new ArrayList<>();
        lista.add(desafio("Mês do plástico", "Recicle 8 kg de plástico neste mês.", CodigoCategoria.PLASTICO, Challenge.Metric.KG,
                8, 150, mes.atDay(1), mes.atEndOfMonth(), true));
        lista.add(desafio("Maratona da reciclagem", "Faça 12 descartes aprovados em 30 dias.", null, Challenge.Metric.COUNT,
                12, 200, hoje.minusDays(15), hoje.plusDays(15), true));
        lista.add(desafio("Semana do e-lixo", "Descarte corretamente pelo menos 1 eletrônico nesta semana.", CodigoCategoria.ELETRONICO,
                Challenge.Metric.COUNT, 1, 100, hoje.minusDays(3), hoje.plusDays(4), true));
        lista.add(desafio("Papel em dia", "Recicle 10 kg de papel e papelão.", CodigoCategoria.PAPEL, Challenge.Metric.KG,
                10, 120, hoje.minusDays(10), hoje.plusDays(20), true));
        lista.add(desafio("Vidro sem caco", "Leve 5 kg de vidro a um ecoponto no próximo mês.", CodigoCategoria.VIDRO, Challenge.Metric.KG,
                5, 100, mes.plusMonths(1).atDay(1), mes.plusMonths(1).atEndOfMonth(), true));
        lista.add(desafio("Compostagem de verão", "Composte 15 kg de orgânicos.", CodigoCategoria.ORGANICO, Challenge.Metric.KG,
                15, 180, hoje.minusDays(120), hoje.minusDays(60), false));
        desafios.saveAll(lista);
        metas.saveAll(List.of(
                new Goal(hoje.getYear(), "Meta " + hoje.getYear() + ": 70% dos resíduos registrados reciclados", 0.70, 6000),
                new Goal(2030, "Meta 2030: 80% de reciclagem na comunidade", 0.80, 15000),
                new Goal(2050, "Lixo Zero 2050: 95% de reaproveitamento", 0.95, 50000)));
    }

    private static Challenge desafio(String titulo, String descricao, CodigoCategoria codigo, Challenge.Metric metrica, double alvo,
                                       int bonus, LocalDate inicioEm, LocalDate fimEm, boolean ativo) {
        Challenge c = new Challenge(titulo);
        c.apply(new ChallengeInput(titulo, descricao, codigo, metrica, alvo, bonus, inicioEm, fimEm, ativo));
        return c;
    }

    private record BinSpec(int house, CodigoCategoria code, String name, int liters, int threshold, int fill, boolean offline) {
    }

    /** Lixeiras inteligentes com histórico de leituras; a última leitura passa pelo fluxo real (pode abrir coleta). */
    private void semearLixeiras(Random aleatorio, Instant agora, SeedContext contexto) {
        List<BinSpec> especificacoes = List.of(
                new BinSpec(0, CodigoCategoria.PLASTICO, "Recicláveis da cozinha", 60, 80, 64, false),
                new BinSpec(0, CodigoCategoria.PAPEL, "Papel do escritório", 50, 85, 37, false),
                new BinSpec(0, CodigoCategoria.ORGANICO, "Composteira", 30, 75, 51, false),
                new BinSpec(0, CodigoCategoria.VIDRO, "Vidros", 40, 90, 22, false),
                new BinSpec(1, CodigoCategoria.PLASTICO, "Lixeira da área de serviço", 80, 85, 91, false),
                new BinSpec(3, CodigoCategoria.METAL, "Latinhas da república", 50, 80, 58, false),
                new BinSpec(4, CodigoCategoria.REJEITO, "Rejeito do banheiro", 30, 90, 45, true),
                new BinSpec(6, CodigoCategoria.PAPEL, "Papelão das entregas", 100, 80, 72, false));
        Map<CodigoCategoria, Category> categoriasPorCodigo = new EnumMap<>(CodigoCategoria.class);
        categorias.findAll().forEach(c -> categoriasPorCodigo.put(c.getCode(), c));
        List<UUID> paraConcluir = new ArrayList<>();
        Map<UUID, BinSpec> especificacaoPorId = new HashMap<>();
        tx.executeWithoutResult(status -> {
            List<BinReading> historico = new ArrayList<>();
            for (BinSpec especificacao : especificacoes) {
                Household casa = residencias.findById(contexto.casas.get(especificacao.house()).getId()).orElseThrow();
                SmartBin lixeira = new SmartBin(casa, categoriasPorCodigo.get(especificacao.code()), especificacao.name(), especificacao.liters(), especificacao.threshold(),
                        UUID.randomUUID(), ServicoLixeiras.sha256(UUID.randomUUID().toString()));
                lixeira.setSimulated(!especificacao.offline());
                lixeira.setCreatedAt(agora.minus(Duration.ofDays(40)));
                lixeiras.save(lixeira);
                // 36 leituras a cada 40 min, subindo até o nível atual (com um esvaziamento no meio)
                Instant fim = especificacao.offline() ? agora.minus(Duration.ofHours(30)) : agora.minus(Duration.ofMinutes(40));
                int nivelInicial = Math.max(0, especificacao.fill() - 30);
                for (int i = 35; i >= 0; i--) {
                    Instant momento = fim.minus(Duration.ofMinutes(40L * i));
                    int nivel = i > 30 ? 70 + (35 - i) * 4 : nivelInicial + (int) Math.round((30 - i) * (especificacao.fill() - nivelInicial) / 30.0);
                    historico.add(new BinReading(lixeira, Math.clamp(nivel, 0, 100), Math.clamp(96 - (35 - i) / 6, 0, 100), momento));
                }
                lixeira.applyReading(especificacao.fill(), 90, fim);
                if (!especificacao.offline()) {
                    paraConcluir.add(lixeira.getId());
                    especificacaoPorId.put(lixeira.getId(), especificacao);
                }
            }
            leituras.saveAll(historico);
        });
        for (UUID id : paraConcluir) {
            servicoLixeiras.registrarLeitura(id, especificacaoPorId.get(id).fill(), 88 + aleatorio.nextInt(10), agora);
        }
    }

    private void semearSolicitacoesERota(Random aleatorio, Instant agora, ZoneId fuso, SeedContext contexto) {
        record Spot(String address, double lat, double lon) {
        }
        List<Spot> locais = List.of(
                new Spot("Rua Cesário Dau, 1200 – Jardim Maria Rosa", -23.6063, -46.7581),
                new Spot("Av. Aprígio Bezerra da Silva, 2450 – Parque Pinheiros", -23.6147, -46.7712),
                new Spot("Rua Benedito Pires, 380 – Vila Iasi", -23.6089, -46.7772),
                new Spot("Estrada São Francisco, 1500 – Jardim Record", -23.6158, -46.7829),
                new Spot("Rua Joaquim Lopes, 210 – Centro", -23.6244, -46.7853),
                new Spot("Rua Sebastião Marçal, 75 – Jardim Mituzi", -23.6312, -46.7735),
                new Spot("Av. Vida Nova, 520 – Jardim Maria Rosa", -23.6012, -46.7498),
                new Spot("Rua das Hortênsias, 120 – Jardim Santa Rosa", -23.6107, -46.7462),
                new Spot("Av. Elias Yazbek, 1300 – Parque Laguna", -23.6214, -46.7951),
                new Spot("Rua Clemente Rocha, 90 – Jardim Umarizal", -23.6281, -46.7493),
                new Spot("Rua Dr. Luiz Migliano, 900 – Vila Sônia", -23.5967, -46.7389),
                new Spot("Rua Arnaldo Magniccaro, 150 – Campo Limpo", -23.6362, -46.7618));
        CodigoCategoria[][] combinacoes = {
                {CodigoCategoria.PLASTICO, CodigoCategoria.PAPEL}, {CodigoCategoria.ELETRONICO}, {CodigoCategoria.VIDRO, CodigoCategoria.METAL},
                {CodigoCategoria.PAPEL}, {CodigoCategoria.PLASTICO, CodigoCategoria.METAL, CodigoCategoria.VIDRO}, {CodigoCategoria.ORGANICO}};
        List<UUID> ids = new ArrayList<>();
        tx.executeWithoutResult(status -> {
            List<CollectionRequest> lista = new ArrayList<>();
            for (int i = 0; i < locais.size(); i++) {
                Spot s = locais.get(i);
                CollectionRequest r = new CollectionRequest(OrigemColeta.USER, s.address(), s.lat(), s.lon(),
                        Set.of(combinacoes[i % combinacoes.length]), Numeros.arredondar2(8 + aleatorio.nextDouble() * 70));
                r.setRequester(usuarios.getReferenceById(contexto.idsMoradores.get(i % contexto.idsMoradores.size())));
                r.setCreatedAt(agora.minus(Duration.ofHours(6 + aleatorio.nextInt(24 * 5))));
                if (i % 4 == 0) {
                    r.setPreferredDate(LocalDate.now(relogio.withZone(fuso)).plusDays(1 + i % 3));
                }
                r.setNotes(i % 3 == 0 ? "Deixar na portaria." : null);
                lista.add(r);
            }
            solicitacoes.saveAll(lista);
            lista.stream().sorted(Comparator.comparing(CollectionRequest::getCreatedAt)).limit(5).forEach(r -> ids.add(r.getId()));
        });
        rotas.criar(new CreateRouteRequest("Rota Taboão – manhã", contexto.idColetor, LocalDate.now(relogio.withZone(fuso)), ids, null, 1000.0));
    }
}
