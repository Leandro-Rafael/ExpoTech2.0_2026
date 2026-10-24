package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.CategorySlice;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.GoalDto;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.GoalInput;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.ImpactSummary;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.MonthPoint;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.PublicStats;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.Scope;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Indicadores ambientais calculados SEMPRE a partir dos dados registrados (descartes aprovados),
 * com agregações SQL. Fatores de conversão documentados em {@link ImpactFactors}.
 */
@Service
public class ImpactService {

    private final NamedParameterJdbcTemplate jdbc;
    private final GoalRepository goals;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;

    public ImpactService(NamedParameterJdbcTemplate jdbc, GoalRepository goals, AuditService audit, AppProperties props, Clock clock) {
        this.jdbc = jdbc;
        this.goals = goals;
        this.audit = audit;
        this.props = props;
        this.clock = clock;
    }

    /** Totais por categoria (kg, CO2 e quantidade) com filtro opcional de usuário e período. */
    private record CategoryTotal(CategoryCode code, String name, String color, boolean recyclable, double kg, double co2, long count) {
    }

    private List<CategoryTotal> totals(UUID userId, Instant from, Instant to) {
        var params = new MapSqlParameterSource()
                .addValue("uid", userId)
                .addValue("from", Timestamp.from(from))
                .addValue("to", Timestamp.from(to));
        String userFilter = userId == null ? "" : " and d.user_id = :uid";
        return jdbc.query("""
                select c.code, c.name, c.color, c.recyclable,
                       coalesce(sum(d.quantity_kg), 0) as kg,
                       coalesce(sum(d.quantity_kg * c.co2_factor_kg), 0) as co2,
                       count(d.id) as cnt
                from categories c
                left join disposals d on d.category_id = c.id and d.status = 'APPROVED'
                     and d.disposed_at >= :from and d.disposed_at < :to""" + userFilter + """

                group by c.code, c.name, c.color, c.recyclable
                order by kg desc, c.name
                """, params, (rs, i) -> new CategoryTotal(CategoryCode.valueOf(rs.getString("code")), rs.getString("name"),
                rs.getString("color"), rs.getBoolean("recyclable"), rs.getDouble("kg"), rs.getDouble("co2"), rs.getLong("cnt")));
    }

    @Transactional(readOnly = true)
    public PublicStats publicStats() {
        List<CategoryTotal> all = totals(null, Instant.EPOCH, clock.instant().plusSeconds(3600));
        double total = all.stream().mapToDouble(CategoryTotal::kg).sum();
        double recycled = all.stream().filter(CategoryTotal::recyclable).mapToDouble(CategoryTotal::kg).sum();
        double co2 = all.stream().mapToDouble(CategoryTotal::co2).sum();
        long disposals = all.stream().mapToLong(CategoryTotal::count).sum();
        Map<String, Object> counts = jdbc.queryForMap("""
                select (select count(*) from users where role = 'USER' and enabled) as users,
                       (select count(*) from households) as households,
                       (select count(*) from collection_points where active) as points
                """, new MapSqlParameterSource());
        return new PublicStats(Numbers.round2(total), Numbers.round2(recycled), Numbers.round2(co2), Numbers.round(ImpactFactors.trees(co2), 1),
                Numbers.toLong(counts.get("users")), Numbers.toLong(counts.get("households")), disposals,
                Numbers.toLong(counts.get("points")));
    }

    @Transactional(readOnly = true)
    public ImpactSummary summary(UUID meId, Scope scope, int months) {
        if (months < 1 || months > 36) {
            throw ApiException.field("months", "informe entre 1 e 36 meses");
        }
        UUID userId = scope == Scope.ME ? meId : null;
        List<CategoryTotal> all = totals(userId, Instant.EPOCH, clock.instant().plusSeconds(3600));
        double total = all.stream().mapToDouble(CategoryTotal::kg).sum();
        double recycled = all.stream().filter(CategoryTotal::recyclable).mapToDouble(CategoryTotal::kg).sum();
        double co2 = all.stream().mapToDouble(CategoryTotal::co2).sum();
        double energy = all.stream().mapToDouble(t -> ImpactFactors.energyKwh(t.code(), t.kg())).sum();
        double water = all.stream().mapToDouble(t -> ImpactFactors.waterLiters(t.code(), t.kg())).sum();
        long count = all.stream().mapToLong(CategoryTotal::count).sum();
        List<CategorySlice> byCategory = all.stream()
                .map(t -> new CategorySlice(t.code(), t.name(), t.color(), Numbers.round2(t.kg()),
                        Numbers.round(Numbers.ratio(t.kg(), total) * 100, 1)))
                .toList();
        return new ImpactSummary(scope, Numbers.round2(total), Numbers.round2(recycled), Numbers.round(Numbers.ratio(recycled, total), 4),
                Numbers.round2(co2), Numbers.round(ImpactFactors.trees(co2), 1), Numbers.round(energy, 1), Numbers.round(water, 0),
                count, byCategory, byMonth(userId, months), goalDtos());
    }

    /** Série mensal dos últimos N meses (meses sem descartes aparecem com zero). */
    private List<MonthPoint> byMonth(UUID userId, int months) {
        ZoneId zone = props.zoneId();
        YearMonth current = YearMonth.now(clock.withZone(zone));
        YearMonth first = current.minusMonths(months - 1L);
        var params = new MapSqlParameterSource()
                .addValue("uid", userId)
                .addValue("zone", props.zone())
                .addValue("from", Timestamp.from(first.atDay(1).atStartOfDay(zone).toInstant()));
        String userFilter = userId == null ? "" : " and d.user_id = :uid";
        Map<String, MonthPoint> found = new HashMap<>();
        jdbc.query("""
                select to_char(d.disposed_at at time zone :zone, 'YYYY-MM') as month,
                       sum(d.quantity_kg) as kg,
                       coalesce(sum(d.quantity_kg) filter (where c.recyclable), 0) as recycled,
                       sum(d.quantity_kg * c.co2_factor_kg) as co2
                from disposals d join categories c on c.id = d.category_id
                where d.status = 'APPROVED' and d.disposed_at >= :from""" + userFilter + """

                group by month
                """, params, rs -> {
            String month = rs.getString("month");
            found.put(month, new MonthPoint(month, Numbers.round2(rs.getDouble("kg")), Numbers.round2(rs.getDouble("recycled")),
                    Numbers.round2(rs.getDouble("co2"))));
        });
        List<MonthPoint> series = new ArrayList<>();
        for (YearMonth m = first; !m.isAfter(current); m = m.plusMonths(1)) {
            String key = m.toString();
            series.add(found.getOrDefault(key, new MonthPoint(key, 0, 0, 0)));
        }
        return series;
    }

    // ---------- Metas ----------

    @Transactional(readOnly = true)
    public List<GoalDto> goalDtos() {
        return goals.findAllByOrderByYearAscTitleAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public GoalDto createGoal(GoalInput input) {
        Goal goal = new Goal(input.year(), input.title().strip(), input.targetRecyclingRate(), input.targetKg());
        goals.save(goal);
        audit.record(AuditAction.GOAL_CREATED, "Goal", goal.getId(), goal.getYear() + " - " + goal.getTitle());
        return toDto(goal);
    }

    @Transactional
    public GoalDto updateGoal(UUID id, GoalInput input) {
        Goal goal = goals.findById(id).orElseThrow(() -> ApiException.notFound("Meta não encontrada."));
        goal.apply(input);
        audit.record(AuditAction.GOAL_UPDATED, "Goal", id, goal.getYear() + " - " + goal.getTitle());
        return toDto(goal);
    }

    /**
     * Progresso da meta: usa os dados da comunidade no ano da meta; para metas futuras (ex.: 2050),
     * usa os últimos 12 meses como "situação atual". progress = média entre o avanço da taxa e o dos kg.
     */
    private GoalDto toDto(Goal g) {
        ZoneId zone = props.zoneId();
        int currentYear = LocalDate.now(clock.withZone(zone)).getYear();
        Instant from, to;
        if (g.getYear() <= currentYear) {
            from = LocalDate.of(g.getYear(), 1, 1).atStartOfDay(zone).toInstant();
            to = LocalDate.of(g.getYear() + 1, 1, 1).atStartOfDay(zone).toInstant();
        } else {
            to = clock.instant();
            from = to.minusSeconds(365L * 24 * 3600);
        }
        List<CategoryTotal> totals = totals(null, from, to);
        double kg = totals.stream().mapToDouble(CategoryTotal::kg).sum();
        double recycled = totals.stream().filter(CategoryTotal::recyclable).mapToDouble(CategoryTotal::kg).sum();
        double rate = Numbers.ratio(recycled, kg);
        double rateProgress = g.getTargetRecyclingRate() <= 0 ? 1 : Math.min(1, rate / g.getTargetRecyclingRate());
        double kgProgress = g.getTargetKg() <= 0 ? 1 : Math.min(1, kg / g.getTargetKg());
        return new GoalDto(g.getId(), g.getYear(), g.getTitle(), g.getTargetRecyclingRate(), Numbers.round2(g.getTargetKg()),
                Numbers.round(rate, 4), Numbers.round2(kg), Numbers.round((rateProgress + kgProgress) / 2, 4));
    }
}
