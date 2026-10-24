package br.com.ecotechzero.lixozero.seed;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.category.CategoryRepository;
import br.com.ecotechzero.lixozero.collection.CollectionPoint;
import br.com.ecotechzero.lixozero.collection.CollectionPointRepository;
import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.collection.CollectionRequestRepository;
import br.com.ecotechzero.lixozero.collection.CollectionSource;
import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.disposal.Disposal;
import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import br.com.ecotechzero.lixozero.disposal.PointsCalculator;
import br.com.ecotechzero.lixozero.gamification.Challenge;
import br.com.ecotechzero.lixozero.gamification.ChallengeRepository;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.ChallengeInput;
import br.com.ecotechzero.lixozero.gamification.GamificationService;
import br.com.ecotechzero.lixozero.household.BinReading;
import br.com.ecotechzero.lixozero.household.BinReadingRepository;
import br.com.ecotechzero.lixozero.household.Household;
import br.com.ecotechzero.lixozero.household.HouseholdRepository;
import br.com.ecotechzero.lixozero.household.SmartBin;
import br.com.ecotechzero.lixozero.household.SmartBinRepository;
import br.com.ecotechzero.lixozero.household.SmartBinService;
import br.com.ecotechzero.lixozero.impact.Goal;
import br.com.ecotechzero.lixozero.impact.GoalRepository;
import br.com.ecotechzero.lixozero.organization.Organization;
import br.com.ecotechzero.lixozero.organization.OrganizationRepository;
import br.com.ecotechzero.lixozero.points.PointTransaction;
import br.com.ecotechzero.lixozero.points.PointTransactionRepository;
import br.com.ecotechzero.lixozero.points.PointTransactionType;
import br.com.ecotechzero.lixozero.reward.Redemption;
import br.com.ecotechzero.lixozero.reward.RedemptionRepository;
import br.com.ecotechzero.lixozero.reward.Reward;
import br.com.ecotechzero.lixozero.reward.RewardRepository;
import br.com.ecotechzero.lixozero.route.RouteDtos.CreateRouteRequest;
import br.com.ecotechzero.lixozero.route.RouteService;
import br.com.ecotechzero.lixozero.user.Role;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
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
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    public static final String ADMIN_EMAIL = "admin@ecotechzero.com.br";
    public static final String ADMIN_PASSWORD = "EcoTech@2050";
    public static final String COLLECTOR_EMAIL = "coletor@ecotechzero.com.br";
    public static final String COLLECTOR_PASSWORD = "Coleta@2050";
    public static final String RESIDENT_EMAIL = "morador@ecotechzero.com.br";
    public static final String RESIDENT_PASSWORD = "Recicla@2050";

    private static final String[] NAMES = {
            "Ana Beatriz Souza", "Bruno Henrique Lima", "Camila Rodrigues", "Diego Fernandes", "Eduarda Martins",
            "Felipe Araújo", "Gabriela Nunes", "Heitor Barbosa", "Isabela Carvalho", "João Pedro Ribeiro",
            "Larissa Gomes", "Matheus Oliveira", "Natália Pereira", "Otávio Santos", "Paula Mendes",
            "Rafael Costa", "Sofia Almeida", "Thiago Rocha", "Valentina Dias", "Vinícius Teixeira",
            "Yasmin Cardoso", "Leonardo Moreira", "Juliana Freitas", "Gustavo Pinto", "Beatriz Lopes"};

    private record HouseSpec(String name, String neighborhood, String city, String address, double lat, double lon) {
    }

    private static final List<HouseSpec> HOUSES = List.of(
            new HouseSpec("Família Silva", "Jardim Maria Rosa", "Taboão da Serra", "Rua Cesário Dau, 410", -23.6052, -46.7549),
            new HouseSpec("Família Souza", "Parque Pinheiros", "Taboão da Serra", "Rua das Acácias, 77", -23.6131, -46.7702),
            new HouseSpec("Família Lima", "Vila Iasi", "Taboão da Serra", "Rua Benedito Pires, 152", -23.6081, -46.7761),
            new HouseSpec("República Verde", "Jardim Record", "Taboão da Serra", "Rua Ipiranga, 980", -23.6169, -46.7815),
            new HouseSpec("Família Costa", "Centro", "Taboão da Serra", "Rua Joaquim Lopes, 35", -23.6236, -46.7826),
            new HouseSpec("Família Oliveira", "Jardim Mituzi", "Taboão da Serra", "Rua Sebastião Marçal, 260", -23.6297, -46.7741),
            new HouseSpec("Casa Almeida", "Vila Sônia", "São Paulo", "Rua Dr. Luiz Migliano, 1500", -23.5951, -46.7378),
            new HouseSpec("Família Rocha", "Campo Limpo", "São Paulo", "Rua Arnaldo Magniccaro, 420", -23.6376, -46.7629));

    /** Peso (frequência) e kg típico de cada categoria nos descartes simulados. */
    private static final Map<CategoryCode, double[]> PROFILE = new EnumMap<>(Map.of(
            CategoryCode.PLASTICO, new double[]{24, 1.6},
            CategoryCode.PAPEL, new double[]{22, 2.4},
            CategoryCode.VIDRO, new double[]{10, 2.2},
            CategoryCode.METAL, new double[]{9, 0.9},
            CategoryCode.ORGANICO, new double[]{17, 2.8},
            CategoryCode.ELETRONICO, new double[]{3, 1.3},
            CategoryCode.REJEITO, new double[]{15, 2.0}));

    private static final String[] REJECTION_REASONS = {
            "A foto não comprova o descarte.", "Categoria informada não corresponde ao material.",
            "Quantidade incompatível com o registro.", "Registro duplicado."};

    private final AppProperties props;
    private final UserRepository users;
    private final HouseholdRepository households;
    private final OrganizationRepository organizations;
    private final CategoryRepository categories;
    private final CollectionPointRepository points;
    private final DisposalRepository disposals;
    private final PointTransactionRepository transactions;
    private final RewardRepository rewards;
    private final RedemptionRepository redemptions;
    private final ChallengeRepository challenges;
    private final GoalRepository goals;
    private final SmartBinRepository bins;
    private final BinReadingRepository readings;
    private final CollectionRequestRepository requests;
    private final GamificationService gamification;
    private final SmartBinService smartBins;
    private final RouteService routes;
    private final AuditService audit;
    private final PasswordEncoder encoder;
    private final TransactionTemplate tx;
    private final Clock clock;

    public DemoDataSeeder(AppProperties props, UserRepository users, HouseholdRepository households, OrganizationRepository organizations,
                          CategoryRepository categories, CollectionPointRepository points, DisposalRepository disposals,
                          PointTransactionRepository transactions, RewardRepository rewards, RedemptionRepository redemptions,
                          ChallengeRepository challenges, GoalRepository goals, SmartBinRepository bins, BinReadingRepository readings,
                          CollectionRequestRepository requests, GamificationService gamification, SmartBinService smartBins,
                          RouteService routes, AuditService audit, PasswordEncoder encoder, TransactionTemplate tx, Clock clock) {
        this.props = props;
        this.users = users;
        this.households = households;
        this.organizations = organizations;
        this.categories = categories;
        this.points = points;
        this.disposals = disposals;
        this.transactions = transactions;
        this.rewards = rewards;
        this.redemptions = redemptions;
        this.challenges = challenges;
        this.goals = goals;
        this.bins = bins;
        this.readings = readings;
        this.requests = requests;
        this.gamification = gamification;
        this.smartBins = smartBins;
        this.routes = routes;
        this.audit = audit;
        this.encoder = encoder;
        this.tx = tx;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.demoSeed() || users.count() > 0) {
            return;
        }
        long start = System.currentTimeMillis();
        log.info("Banco vazio: criando dados de demonstração...");
        Random random = new Random(2050);
        Instant now = clock.instant();
        ZoneId zone = props.zoneId();

        SeedContext ctx = tx.execute(status -> seedCore(random, now, zone));
        // Bônus de desafios e medalhas usam as mesmas regras do sistema (uma transação por usuário)
        for (UUID userId : ctx.residentIds) {
            tx.executeWithoutResult(status -> gamification.onDisposalApproved(userId, now));
        }
        seedBins(random, now, ctx);
        seedRequestsAndRoute(random, now, zone, ctx);
        audit.recordAs(null, "sistema", AuditAction.DEMO_DATA_SEEDED, null, null,
                ctx.residentIds.size() + " moradores e " + ctx.disposalCount + " descartes de demonstração");
        log.info("Dados de demonstração criados em {} ms ({} descartes). Logins: {} | {} | {}",
                System.currentTimeMillis() - start, ctx.disposalCount, ADMIN_EMAIL, COLLECTOR_EMAIL, RESIDENT_EMAIL);
    }

    private static final class SeedContext {
        final List<UUID> residentIds = new ArrayList<>();
        final List<Household> houses = new ArrayList<>();
        final Map<UUID, Household> houseOfUser = new HashMap<>();
        UUID collectorId;
        UUID residentId;
        int disposalCount;
    }

    private SeedContext seedCore(Random random, Instant now, ZoneId zone) {
        SeedContext ctx = new SeedContext();
        Map<CategoryCode, Category> cats = new EnumMap<>(CategoryCode.class);
        categories.findAll().forEach(c -> cats.put(c.getCode(), c));
        List<CollectionPoint> allPoints = points.findByActiveTrue();
        List<Organization> orgs = organizations.findAllByOrderByName();

        // ---------- Residências ----------
        for (int i = 0; i < HOUSES.size(); i++) {
            HouseSpec spec = HOUSES.get(i);
            Household h = new Household(spec.name(), spec.neighborhood(), spec.city(), "DEMO" + (2050 + i));
            h.setLocation(spec.address(), spec.lat(), spec.lon());
            h.setCreatedAt(now.minus(Duration.ofDays(380 - i * 3L)));
            ctx.houses.add(h);
        }
        households.saveAll(ctx.houses);

        // ---------- Usuários ----------
        Instant accountsCreated = now.minus(Duration.ofDays(385));
        User admin = new User("Administrador EcoTech", ADMIN_EMAIL, encoder.encode(ADMIN_PASSWORD), Role.ADMIN);
        User collector = new User("Carlos Pereira (coletor)", COLLECTOR_EMAIL, encoder.encode(COLLECTOR_PASSWORD), Role.COLLECTOR);
        User collector2 = new User("Renata Alves (coletora)", "renata.alves@ecotechzero.com.br", encoder.encode(COLLECTOR_PASSWORD), Role.COLLECTOR);
        User resident = new User("Marina Silva", RESIDENT_EMAIL, encoder.encode(RESIDENT_PASSWORD), Role.USER);
        resident.setHousehold(ctx.houses.getFirst());
        resident.setOrganization(orgs.stream().filter(o -> o.getName().startsWith("Ciência")).findFirst().orElse(null));
        List<User> all = new ArrayList<>(List.of(admin, collector, collector2, resident));
        // Os demais moradores compartilham o hash da senha de demonstração (calcular Argon2 25x seria lento)
        String sharedHash = encoder.encode(RESIDENT_PASSWORD);
        List<User> residents = new ArrayList<>(List.of(resident));
        for (int i = 0; i < NAMES.length; i++) {
            String email = Text.fold(NAMES[i]).replaceAll("[^a-z ]", "").strip().replaceAll("\\s+", ".") + "@exemplo.com.br";
            User u = new User(NAMES[i], email, sharedHash, Role.USER);
            if (i % 9 != 8) {
                u.setHousehold(ctx.houses.get((i + 1) % ctx.houses.size()));
            }
            if (i % 4 != 3) {
                u.setOrganization(orgs.get(i % orgs.size()));
            }
            residents.add(u);
            all.add(u);
        }
        for (int i = 0; i < all.size(); i++) {
            User u = all.get(i);
            u.setCreatedAt(accountsCreated.plus(Duration.ofDays(i * 2L)));
            u.setLastLoginAt(now.minus(Duration.ofHours(random.nextInt(1, 24 * 20))));
        }
        users.saveAll(all);
        for (int i = 0; i < ctx.houses.size(); i++) {
            Household h = ctx.houses.get(i);
            residents.stream().filter(u -> u.getHousehold() == h).findFirst().ifPresent(h::setOwner);
        }
        ctx.collectorId = collector.getId();
        ctx.residentId = resident.getId();
        residents.forEach(u -> {
            ctx.residentIds.add(u.getId());
            if (u.getHousehold() != null) {
                ctx.houseOfUser.put(u.getId(), u.getHousehold());
            }
        });

        // ---------- Desafios e metas ----------
        seedChallengesAndGoals(now, zone);

        // ---------- Descartes, extrato e resgates ----------
        List<Reward> catalog = rewards.findAllByOrderByCostPoints();
        List<Disposal> allDisposals = new ArrayList<>();
        List<PointTransaction> allTx = new ArrayList<>();
        List<Redemption> allRedemptions = new ArrayList<>();
        int flaggedLeft = 6;
        for (User u : residents) {
            boolean isDemo = u == resident;
            double rate = isDemo ? 0.32 : 0.06 + random.nextDouble() * 0.26;
            List<Disposal> mine = generateDisposals(u, rate, isDemo, cats, allPoints, ctx.houseOfUser.get(u.getId()), admin, random, now, zone);
            if (flaggedLeft > 0 && !isDemo && random.nextInt(3) == 0) {
                Disposal suspicious = suspicious(u, cats, random, now);
                mine.add(suspicious);
                flaggedLeft--;
            }
            allDisposals.addAll(mine);
            buildLedger(u, mine, catalog, random, now, allTx, allRedemptions);
        }
        disposals.saveAll(allDisposals);
        redemptions.saveAll(allRedemptions);
        transactions.saveAll(allTx);
        ctx.disposalCount = allDisposals.size();
        return ctx;
    }

    private List<Disposal> generateDisposals(User u, double rate, boolean isDemo, Map<CategoryCode, Category> cats,
                                             List<CollectionPoint> allPoints, Household house, User reviewer,
                                             Random random, Instant now, ZoneId zone) {
        List<Disposal> list = new ArrayList<>();
        LocalDate today = LocalDate.now(clock.withZone(zone));
        GeoPoint base = house != null ? new GeoPoint(house.getLatitude(), house.getLongitude()) : new GeoPoint(-23.6090, -46.7580);
        for (int daysAgo = 365; daysAgo >= 0; daysAgo--) {
            double growth = 0.45 + 0.55 * (365 - daysAgo) / 365.0; // a adesão cresce ao longo do ano
            boolean forced = isDemo && daysAgo <= 8;              // sequência de dias do morador de demonstração
            if (!forced && random.nextDouble() > rate * growth) {
                continue;
            }
            LocalDate day = today.minusDays(daysAgo);
            Instant at = day.atTime(8 + random.nextInt(13), random.nextInt(60)).atZone(zone).toInstant();
            if (at.isAfter(now.minus(Duration.ofMinutes(20)))) {
                at = now.minus(Duration.ofMinutes(20 + random.nextInt(120)));
            }
            Category cat = cats.get(pickCategory(random));
            double typical = PROFILE.get(cat.getCode())[1];
            double kg = Numbers.round(Math.min(cat.getMaxKgPerDisposal() * 0.6, Math.max(0.1, typical * (0.4 + random.nextDouble() * 1.4))), 2);
            Disposal d = new Disposal(u, cat, kg, at);
            d.setCreatedAt(at.plusSeconds(30));
            d.setLocation(base.latitude() + (random.nextDouble() - 0.5) * 0.004, base.longitude() + (random.nextDouble() - 0.5) * 0.004);
            if (random.nextInt(10) < 4) {
                allPoints.stream().filter(p -> p.accepts(cat.getCode()))
                        .min(Comparator.comparingDouble(p -> GeoPoint.haversineKm(base.latitude(), base.longitude(), p.getLatitude(), p.getLongitude())))
                        .ifPresent(d::setCollectionPoint);
            }
            if (random.nextInt(10) < 3) {
                d.setAi(cat.getCode(), Numbers.round(0.7 + random.nextDouble() * 0.29, 3), AiSource.LOCAL);
            }
            int pts = PointsCalculator.points(cat.getPointsPerKg(), kg, false);
            d.setEstimatedPoints(pts);
            d.setFraud(random.nextInt(3) == 0 ? random.nextInt(5, 20) : 0, List.of(), false);
            boolean recent = daysAgo <= 1 && !(isDemo && daysAgo == 1);
            if (recent && random.nextInt(10) < 8) {
                // pendente: aguardando moderação
            } else if (!forced && random.nextInt(100) < 5) {
                d.reject(REJECTION_REASONS[random.nextInt(REJECTION_REASONS.length)], reviewer, reviewTime(at, random, now));
            } else {
                d.approve(pts, reviewer, reviewTime(at, random, now));
            }
            list.add(d);
        }
        return list;
    }

    /** Descarte pendente sinalizado pelo antifraude (fila de revisão do admin). */
    private Disposal suspicious(User u, Map<CategoryCode, Category> cats, Random random, Instant now) {
        Category cat = cats.get(random.nextBoolean() ? CategoryCode.ELETRONICO : CategoryCode.METAL);
        double kg = Numbers.round(cat.getMaxKgPerDisposal() * (0.85 + random.nextDouble() * 0.15), 2);
        Instant at = now.minus(Duration.ofHours(random.nextInt(2, 72)));
        Disposal d = new Disposal(u, cat, kg, at);
        d.setCreatedAt(at.plusSeconds(20));
        d.setEstimatedPoints(PointsCalculator.points(cat.getPointsPerKg(), kg, false));
        List<String> flags = new ArrayList<>(List.of(
                "Quantidade próxima do máximo permitido para a categoria (" + cat.getMaxKgPerDisposal() + " kg).",
                "Descarte acima de 5 kg sem foto de comprovação."));
        int score = 35;
        if (random.nextBoolean()) {
            flags.add("Muitos registros em pouco tempo (5 em 10 minutos).");
            score += 30;
        } else {
            d.setAi(CategoryCode.REJEITO, 0.86, AiSource.LOCAL);
            flags.add("Categoria informada (" + cat.getCode() + ") difere da sugerida pela IA (REJEITO, 86% de confiança).");
            score += 15;
        }
        d.setFraud(Math.min(100, score), flags, true);
        return d;
    }

    private static Instant reviewTime(Instant at, Random random, Instant now) {
        Instant reviewed = at.plus(Duration.ofMinutes(90 + random.nextInt(60 * 30)));
        Instant cap = now.minus(Duration.ofMinutes(10));
        return reviewed.isAfter(cap) ? cap : reviewed;
    }

    private static CategoryCode pickCategory(Random random) {
        double total = PROFILE.values().stream().mapToDouble(v -> v[0]).sum();
        double r = random.nextDouble() * total;
        for (var e : PROFILE.entrySet()) {
            r -= e.getValue()[0];
            if (r <= 0) {
                return e.getKey();
            }
        }
        return CategoryCode.PLASTICO;
    }

    /** Monta o extrato em ordem cronológica (saldo após cada lançamento) e alguns resgates. */
    private void buildLedger(User u, List<Disposal> mine, List<Reward> catalog, Random random, Instant now,
                             List<PointTransaction> txOut, List<Redemption> redemptionsOut) {
        List<Disposal> approved = mine.stream().filter(d -> d.getReviewedAt() != null && d.getPointsAwarded() > 0)
                .sorted(Comparator.comparing(Disposal::getReviewedAt)).toList();
        long balance = 0, earned = 0;
        int redeemed = 0;
        for (Disposal d : approved) {
            balance += d.getPointsAwarded();
            earned += d.getPointsAwarded();
            PointTransaction t = new PointTransaction(u, PointTransactionType.EARN, d.getPointsAwarded(), balance,
                    String.format(Locale.forLanguageTag("pt-BR"), "Descarte aprovado: %.2f kg de %s", d.getQuantityKg(), d.getCategory().getName()));
            t.link(d, null, null);
            t.setCreatedAt(d.getReviewedAt());
            txOut.add(t);
            if (redeemed < 3 && random.nextInt(100) < 5) {
                final long available = balance;
                List<Reward> affordable = catalog.stream().filter(r -> r.getCostPoints() <= available && r.getStock() > 0).toList();
                if (!affordable.isEmpty()) {
                    Reward reward = affordable.get(random.nextInt(affordable.size()));
                    reward.decrementStock();
                    Instant at = d.getReviewedAt().plus(Duration.ofHours(2));
                    if (at.isAfter(now)) {
                        at = now.minus(Duration.ofMinutes(5));
                    }
                    Redemption redemption = new Redemption(u, reward, reward.getCostPoints(), voucher(random));
                    redemption.setCreatedAt(at);
                    if (at.isBefore(now.minus(Duration.ofDays(20)))) {
                        redemption.setStatus(Redemption.Status.USED);
                    }
                    redemptionsOut.add(redemption);
                    balance -= reward.getCostPoints();
                    PointTransaction debit = new PointTransaction(u, PointTransactionType.REDEEM, -reward.getCostPoints(), balance,
                            "Resgate: " + reward.getName());
                    debit.link(null, null, redemption);
                    debit.setCreatedAt(at);
                    txOut.add(debit);
                    redeemed++;
                }
            }
        }
        u.setPoints(balance);
        u.setTotalEarned(earned);
    }

    private static String voucher(Random random) {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder("LZ50-");
        for (int i = 0; i < 8; i++) {
            if (i == 4) sb.append('-');
            sb.append(alphabet.charAt(random.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    private void seedChallengesAndGoals(Instant now, ZoneId zone) {
        LocalDate today = LocalDate.now(clock.withZone(zone));
        YearMonth month = YearMonth.from(today);
        List<Challenge> list = new ArrayList<>();
        list.add(challenge("Mês do plástico", "Recicle 8 kg de plástico neste mês.", CategoryCode.PLASTICO, Challenge.Metric.KG,
                8, 150, month.atDay(1), month.atEndOfMonth(), true));
        list.add(challenge("Maratona da reciclagem", "Faça 12 descartes aprovados em 30 dias.", null, Challenge.Metric.COUNT,
                12, 200, today.minusDays(15), today.plusDays(15), true));
        list.add(challenge("Semana do e-lixo", "Descarte corretamente pelo menos 1 eletrônico nesta semana.", CategoryCode.ELETRONICO,
                Challenge.Metric.COUNT, 1, 100, today.minusDays(3), today.plusDays(4), true));
        list.add(challenge("Papel em dia", "Recicle 10 kg de papel e papelão.", CategoryCode.PAPEL, Challenge.Metric.KG,
                10, 120, today.minusDays(10), today.plusDays(20), true));
        list.add(challenge("Vidro sem caco", "Leve 5 kg de vidro a um ecoponto no próximo mês.", CategoryCode.VIDRO, Challenge.Metric.KG,
                5, 100, month.plusMonths(1).atDay(1), month.plusMonths(1).atEndOfMonth(), true));
        list.add(challenge("Compostagem de verão", "Composte 15 kg de orgânicos.", CategoryCode.ORGANICO, Challenge.Metric.KG,
                15, 180, today.minusDays(120), today.minusDays(60), false));
        challenges.saveAll(list);
        goals.saveAll(List.of(
                new Goal(today.getYear(), "Meta " + today.getYear() + ": 70% dos resíduos registrados reciclados", 0.70, 6000),
                new Goal(2030, "Meta 2030: 80% de reciclagem na comunidade", 0.80, 15000),
                new Goal(2050, "Lixo Zero 2050: 95% de reaproveitamento", 0.95, 50000)));
    }

    private static Challenge challenge(String title, String description, CategoryCode code, Challenge.Metric metric, double target,
                                       int bonus, LocalDate starts, LocalDate ends, boolean active) {
        Challenge c = new Challenge(title);
        c.apply(new ChallengeInput(title, description, code, metric, target, bonus, starts, ends, active));
        return c;
    }

    private record BinSpec(int house, CategoryCode code, String name, int liters, int threshold, int fill, boolean offline) {
    }

    /** Lixeiras inteligentes com histórico de leituras; a última leitura passa pelo fluxo real (pode abrir coleta). */
    private void seedBins(Random random, Instant now, SeedContext ctx) {
        List<BinSpec> specs = List.of(
                new BinSpec(0, CategoryCode.PLASTICO, "Recicláveis da cozinha", 60, 80, 64, false),
                new BinSpec(0, CategoryCode.PAPEL, "Papel do escritório", 50, 85, 37, false),
                new BinSpec(0, CategoryCode.ORGANICO, "Composteira", 30, 75, 51, false),
                new BinSpec(0, CategoryCode.VIDRO, "Vidros", 40, 90, 22, false),
                new BinSpec(1, CategoryCode.PLASTICO, "Lixeira da área de serviço", 80, 85, 91, false),
                new BinSpec(3, CategoryCode.METAL, "Latinhas da república", 50, 80, 58, false),
                new BinSpec(4, CategoryCode.REJEITO, "Rejeito do banheiro", 30, 90, 45, true),
                new BinSpec(6, CategoryCode.PAPEL, "Papelão das entregas", 100, 80, 72, false));
        Map<CategoryCode, Category> cats = new EnumMap<>(CategoryCode.class);
        categories.findAll().forEach(c -> cats.put(c.getCode(), c));
        List<UUID> toFinish = new ArrayList<>();
        Map<UUID, BinSpec> specById = new HashMap<>();
        tx.executeWithoutResult(status -> {
            List<BinReading> history = new ArrayList<>();
            for (BinSpec spec : specs) {
                Household house = households.findById(ctx.houses.get(spec.house()).getId()).orElseThrow();
                SmartBin bin = new SmartBin(house, cats.get(spec.code()), spec.name(), spec.liters(), spec.threshold(),
                        UUID.randomUUID(), SmartBinService.sha256(UUID.randomUUID().toString()));
                bin.setSimulated(!spec.offline());
                bin.setCreatedAt(now.minus(Duration.ofDays(40)));
                bins.save(bin);
                // 36 leituras a cada 40 min, subindo até o nível atual (com um esvaziamento no meio)
                Instant end = spec.offline() ? now.minus(Duration.ofHours(30)) : now.minus(Duration.ofMinutes(40));
                int startFill = Math.max(0, spec.fill() - 30);
                for (int i = 35; i >= 0; i--) {
                    Instant at = end.minus(Duration.ofMinutes(40L * i));
                    int fill = i > 30 ? 70 + (35 - i) * 4 : startFill + (int) Math.round((30 - i) * (spec.fill() - startFill) / 30.0);
                    history.add(new BinReading(bin, Math.clamp(fill, 0, 100), Math.clamp(96 - (35 - i) / 6, 0, 100), at));
                }
                bin.applyReading(spec.fill(), 90, end);
                if (!spec.offline()) {
                    toFinish.add(bin.getId());
                    specById.put(bin.getId(), spec);
                }
            }
            readings.saveAll(history);
        });
        for (UUID id : toFinish) {
            smartBins.recordReading(id, specById.get(id).fill(), 88 + random.nextInt(10), now);
        }
    }

    private void seedRequestsAndRoute(Random random, Instant now, ZoneId zone, SeedContext ctx) {
        record Spot(String address, double lat, double lon) {
        }
        List<Spot> spots = List.of(
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
        CategoryCode[][] combos = {
                {CategoryCode.PLASTICO, CategoryCode.PAPEL}, {CategoryCode.ELETRONICO}, {CategoryCode.VIDRO, CategoryCode.METAL},
                {CategoryCode.PAPEL}, {CategoryCode.PLASTICO, CategoryCode.METAL, CategoryCode.VIDRO}, {CategoryCode.ORGANICO}};
        List<UUID> ids = new ArrayList<>();
        tx.executeWithoutResult(status -> {
            List<CollectionRequest> list = new ArrayList<>();
            for (int i = 0; i < spots.size(); i++) {
                Spot s = spots.get(i);
                CollectionRequest r = new CollectionRequest(CollectionSource.USER, s.address(), s.lat(), s.lon(),
                        Set.of(combos[i % combos.length]), Numbers.round2(8 + random.nextDouble() * 70));
                r.setRequester(users.getReferenceById(ctx.residentIds.get(i % ctx.residentIds.size())));
                r.setCreatedAt(now.minus(Duration.ofHours(6 + random.nextInt(24 * 5))));
                if (i % 4 == 0) {
                    r.setPreferredDate(LocalDate.now(clock.withZone(zone)).plusDays(1 + i % 3));
                }
                r.setNotes(i % 3 == 0 ? "Deixar na portaria." : null);
                list.add(r);
            }
            requests.saveAll(list);
            list.stream().sorted(Comparator.comparing(CollectionRequest::getCreatedAt)).limit(5).forEach(r -> ids.add(r.getId()));
        });
        routes.create(new CreateRouteRequest("Rota Taboão – manhã", ctx.collectorId, LocalDate.now(clock.withZone(zone)), ids, null, 1000.0));
    }
}
