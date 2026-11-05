package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import br.com.ecotechzero.lixozero.disposal.DisposalStatus;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.BadgeDto;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.ChallengeDto;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.ChallengeInput;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.GamificationSummary;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.LevelRef;
import br.com.ecotechzero.lixozero.gamification.badge.BadgeCatalog;
import br.com.ecotechzero.lixozero.gamification.badge.BadgeRule;
import br.com.ecotechzero.lixozero.gamification.badge.BadgeStats;
import br.com.ecotechzero.lixozero.points.PointTransactionType;
import br.com.ecotechzero.lixozero.points.PointsService;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Níveis, medalhas, desafios e sequência de dias. As recompensas de gamificação são avaliadas no
 * momento da aprovação de um descarte (mesma transação), garantindo consistência com o saldo.
 */
@Service
public class GamificationService {

    private final DisposalRepository disposals;
    private final ChallengeRepository challenges;
    private final ChallengeCompletionRepository completions;
    private final UserBadgeRepository badges;
    private final UserRepository users;
    private final PointsService points;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager em;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;

    public GamificationService(DisposalRepository disposals, ChallengeRepository challenges, ChallengeCompletionRepository completions,
                               UserBadgeRepository badges, UserRepository users, PointsService points, NamedParameterJdbcTemplate jdbc,
                               EntityManager em, AuditService audit, AppProperties props, Clock clock) {
        this.disposals = disposals;
        this.challenges = challenges;
        this.completions = completions;
        this.badges = badges;
        this.users = users;
        this.points = points;
        this.jdbc = jdbc;
        this.em = em;
        this.audit = audit;
        this.props = props;
        this.clock = clock;
    }

    /**
     * Chamado após a aprovação de um descarte: concede medalhas novas e paga o bônus dos desafios concluídos
     * (cada bônus uma única vez, garantido também por índice único no banco).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void onDisposalApproved(UUID userId, Instant disposedAt) {
        em.flush(); // garante que as consultas SQL abaixo enxerguem a aprovação recém-feita
        Instant now = clock.instant();
        LocalDate day = disposedAt.atZone(props.zoneId()).toLocalDate();
        User userRef = users.getReferenceById(userId);
        Set<UUID> done = completions.findByUserId(userId).stream().map(c -> c.getChallenge().getId()).collect(Collectors.toSet());
        for (Challenge challenge : challenges.findByActiveTrueAndEndsAtGreaterThanEqualOrderByEndsAt(day)) {
            if (!challenge.covers(day) || done.contains(challenge.getId())) {
                continue;
            }
            if (progress(userId, challenge) >= challenge.getTarget()) {
                completions.save(new ChallengeCompletion(userRef, challenge, now));
                if (challenge.getBonusPoints() > 0) {
                    points.credit(userId, challenge.getBonusPoints(), PointTransactionType.BONUS,
                            "Bônus do desafio: " + challenge.getTitle(), null, challenge, now);
                }
            }
        }
        awardBadges(userId, now);
    }

    /** Avalia e grava medalhas recém-conquistadas. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void awardBadges(UUID userId, Instant now) {
        em.flush();
        BadgeStats stats = statsFor(userId);
        Set<String> owned = new HashSet<>();
        badges.findByUserId(userId).forEach(b -> owned.add(b.getBadgeCode()));
        for (BadgeRule rule : BadgeCatalog.ALL) {
            if (!owned.contains(rule.code()) && rule.isEarned(stats)) {
                badges.save(new UserBadge(users.getReferenceById(userId), rule.code(), now));
            }
        }
    }

    @Transactional(readOnly = true)
    public GamificationSummary summary(UUID userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("Usuário não encontrado."));
        Map<String, UserBadge> owned = badges.findByUserId(userId).stream()
                .collect(Collectors.toMap(UserBadge::getBadgeCode, Function.identity(), (a, b) -> a));
        List<BadgeDto> badgeDtos = BadgeCatalog.ALL.stream().map(rule -> {
            UserBadge earned = owned.get(rule.code());
            return new BadgeDto(rule.code(), rule.name(), rule.description(), rule.icon(), rule.tier(),
                    earned != null, earned == null ? null : earned.getAwardedAt());
        }).toList();

        LocalDate today = LocalDate.now(clock.withZone(props.zoneId()));
        Set<UUID> done = completions.findByUserId(userId).stream().map(c -> c.getChallenge().getId()).collect(Collectors.toSet());
        List<ChallengeDto> challengeDtos = challenges.findByActiveTrueAndEndsAtGreaterThanEqualOrderByEndsAt(today.minusDays(7)).stream()
                .map(c -> toDto(c, Numbers.round2(progress(userId, c)), done.contains(c.getId())))
                .toList();

        // nível usa o total já ganho, não o saldo: trocar pontos por recompensa não derruba o nível
        List<LevelRef> levels = LevelCatalog.LEVELS.stream().map(l -> new LevelRef(l.index(), l.name(), l.minPoints())).toList();
        return new GamificationSummary(user.getPoints(), user.getTotalEarned(), LevelCatalog.levelFor(user.getTotalEarned()),
                levels, badgeDtos, challengeDtos, streakDays(userId));
    }

    /** Progresso do usuário no desafio (kg ou quantidade de descartes aprovados no período). */
    double progress(UUID userId, Challenge c) {
        ZoneId zone = props.zoneId();
        Instant from = c.getStartsAt().atStartOfDay(zone).toInstant();
        Instant to = c.getEndsAt().plusDays(1).atStartOfDay(zone).toInstant();
        List<Object[]> rows = disposals.progressBetween(userId, DisposalStatus.APPROVED, from, to, c.getCategoryCode());
        if (rows.isEmpty()) {
            return 0;
        }
        Object[] row = rows.getFirst();
        return c.getMetric() == Challenge.Metric.KG ? Numbers.toDouble(row[0]) : Numbers.toDouble(row[1]);
    }

    BadgeStats statsFor(UUID userId) {
        Map<CategoryCode, Double> kgByCategory = new EnumMap<>(CategoryCode.class);
        long count = 0;
        double total = 0;
        for (Object[] row : disposals.statsByCategory(userId, DisposalStatus.APPROVED)) {
            double kg = Numbers.toDouble(row[1]);
            kgByCategory.put((CategoryCode) row[0], kg);
            total += kg;
            count += Numbers.toLong(row[2]);
        }
        var params = new MapSqlParameterSource("uid", userId);
        Boolean hasBin = jdbc.queryForObject("""
                select exists(select 1 from smart_bins b join users u on u.household_id = b.household_id where u.id = :uid)
                """, params, Boolean.class);
        long totalEarned = users.findById(userId).map(User::getTotalEarned).orElse(0L);
        return new BadgeStats(count, total, kgByCategory, streakDays(userId), totalEarned, Boolean.TRUE.equals(hasBin));
    }

    /** Dias consecutivos (até hoje ou ontem) com pelo menos um descarte aprovado. */
    int streakDays(UUID userId) {
        LocalDate today = LocalDate.now(clock.withZone(props.zoneId()));
        var params = new MapSqlParameterSource()
                .addValue("uid", userId)
                .addValue("zone", props.zone())
                .addValue("since", Timestamp.from(today.minusDays(400).atStartOfDay(props.zoneId()).toInstant()));
        List<LocalDate> days = jdbc.query("""
                select distinct cast(d.disposed_at at time zone :zone as date) as day
                from disposals d
                where d.user_id = :uid and d.status = 'APPROVED' and d.disposed_at >= :since
                order by day desc
                """, params, (rs, i) -> rs.getObject("day", Date.class).toLocalDate());
        return StreakCalculator.streak(days, today);
    }

    // ---------- Administração de desafios ----------

    @Transactional(readOnly = true)
    public List<ChallengeDto> listChallenges() {
        return challenges.findAllByOrderByStartsAtDesc().stream().map(c -> toDto(c, 0, false)).toList();
    }

    @Transactional
    public ChallengeDto createChallenge(ChallengeInput input) {
        validate(input);
        Challenge challenge = new Challenge(input.title());
        challenge.apply(input);
        challenges.save(challenge);
        audit.record(AuditAction.CHALLENGE_CREATED, "Challenge", challenge.getId(), challenge.getTitle());
        return toDto(challenge, 0, false);
    }

    @Transactional
    public ChallengeDto updateChallenge(UUID id, ChallengeInput input) {
        validate(input);
        Challenge challenge = challenges.findById(id).orElseThrow(() -> ApiException.notFound("Desafio não encontrado."));
        challenge.apply(input);
        audit.record(AuditAction.CHALLENGE_UPDATED, "Challenge", id, challenge.getTitle());
        return toDto(challenge, 0, false);
    }

    private static void validate(ChallengeInput input) {
        if (input.endsAt().isBefore(input.startsAt())) {
            throw ApiException.field("endsAt", "a data final deve ser igual ou posterior à inicial");
        }
        if (input.metric() == Challenge.Metric.COUNT && input.target() != Math.floor(input.target())) {
            throw ApiException.field("target", "para desafios por quantidade, use um número inteiro");
        }
    }

    static ChallengeDto toDto(Challenge c, double progress, boolean completed) {
        return new ChallengeDto(c.getId(), c.getTitle(), c.getDescription(), c.getCategoryCode(), c.getMetric(), c.getTarget(),
                progress, c.getBonusPoints(), c.getStartsAt(), c.getEndsAt(), c.isActive(), completed);
    }
}
