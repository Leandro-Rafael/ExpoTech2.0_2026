package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.Ranking;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.RankingEntry;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.RankingPeriod;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.RankingScope;
import br.com.ecotechzero.lixozero.organization.OrganizationType;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Ranking por usuário, residência, bairro ou organização (turma/empresa), calculado com agregações SQL
 * (SUM + GROUP BY) sobre os dados reais: pontos ganhos (EARN + BONUS) e kg de descartes aprovados.
 * Períodos são janelas móveis: últimos 7, 30 ou 365 dias, ou todo o histórico.
 */
@Service
public class RankingService {

    static final int TOP = 10;

    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository users;
    private final Clock clock;

    public RankingService(NamedParameterJdbcTemplate jdbc, UserRepository users, Clock clock) {
        this.jdbc = jdbc;
        this.users = users;
        this.clock = clock;
    }

    /** Linha agregada antes de receber posição. */
    private record Row(String id, String name, String subtitle, long points, double kg) {
    }

    // CTEs comuns: pontos e kg por usuário no período
    private static final String BASE = """
            with pts as (
                select user_id, sum(amount) as points from point_transactions
                where type in ('EARN', 'BONUS') and created_at >= :since group by user_id
            ), kgs as (
                select user_id, sum(quantity_kg) as kg from disposals
                where status = 'APPROVED' and disposed_at >= :since group by user_id
            ), per_user as (
                select u.id, u.name, u.household_id, u.organization_id,
                       coalesce(p.points, 0) as points, coalesce(k.kg, 0) as kg
                from users u
                left join pts p on p.user_id = u.id
                left join kgs k on k.user_id = u.id
                where u.enabled and u.role = 'USER' and (p.points is not null or k.kg is not null)
            )
            """;

    private static final String BY_USER = BASE + """
            select pu.id::text as id, pu.name as name, h.neighborhood as subtitle, pu.points, pu.kg
            from per_user pu left join households h on h.id = pu.household_id
            order by pu.points desc, pu.kg desc, pu.name
            """;

    private static final String BY_HOUSEHOLD = BASE + """
            select h.id::text as id, h.name as name, h.neighborhood as subtitle, sum(pu.points) as points, sum(pu.kg) as kg
            from per_user pu join households h on h.id = pu.household_id
            group by h.id, h.name, h.neighborhood
            order by points desc, kg desc, h.name
            """;

    private static final String BY_NEIGHBORHOOD = BASE + """
            select h.neighborhood as id, h.neighborhood as name, count(distinct h.id) || ' residência(s)' as subtitle,
                   sum(pu.points) as points, sum(pu.kg) as kg
            from per_user pu join households h on h.id = pu.household_id
            group by h.neighborhood
            order by points desc, kg desc, h.neighborhood
            """;

    private static final String BY_ORGANIZATION = BASE + """
            select o.id::text as id, o.name as name, o.type as subtitle, sum(pu.points) as points, sum(pu.kg) as kg
            from per_user pu join organizations o on o.id = pu.organization_id
            group by o.id, o.name, o.type
            order by points desc, kg desc, o.name
            """;

    @Transactional(readOnly = true)
    public Ranking ranking(UUID meId, RankingScope scope, RankingPeriod period) {
        // 1. Converte o período escolhido em uma data de início.
        Instant since = switch (period) {
            case WEEK -> clock.instant().minus(Duration.ofDays(7));
            case MONTH -> clock.instant().minus(Duration.ofDays(30));
            case YEAR -> clock.instant().minus(Duration.ofDays(365));
            case ALL -> Instant.EPOCH;
        };
        // 2. Escolhe a consulta do agrupamento (pessoa, residência, bairro ou organização) e roda no banco,
        //    que já devolve tudo ordenado por pontos e, no empate, por kg.
        String sql = switch (scope) {
            case USER -> BY_USER;
            case HOUSEHOLD -> BY_HOUSEHOLD;
            case NEIGHBORHOOD -> BY_NEIGHBORHOOD;
            case ORGANIZATION -> BY_ORGANIZATION;
        };
        List<Row> rows = jdbc.query(sql, new MapSqlParameterSource("since", Timestamp.from(since)), (rs, i) -> new Row(
                rs.getString("id"), rs.getString("name"), subtitle(scope, rs.getString("subtitle")),
                rs.getLong("points"), Numbers.round2(rs.getDouble("kg"))));

        // 3. Numera as posições, guarda só o top 10 e acha a linha do "eu" mesmo se estiver fora do top 10.
        String myKey = myKey(meId, scope);
        List<RankingEntry> entries = new ArrayList<>();
        RankingEntry me = null;
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            boolean isMe = r.id().equals(myKey);
            RankingEntry entry = new RankingEntry(i + 1, r.id(), r.name(), r.subtitle(), r.points(), r.kg(), isMe);
            if (i < TOP) {
                entries.add(entry);
            }
            if (isMe) {
                me = entry;
            }
        }
        // 4. Quem ainda não pontuou no período aparece como último, com zero.
        if (me == null && myKey != null) {
            me = new RankingEntry(rows.size() + 1, myKey, myName(meId, scope), null, 0, 0, true);
        }
        return new Ranking(scope, period, entries, me);
    }

    private static String subtitle(RankingScope scope, String raw) {
        if (scope == RankingScope.ORGANIZATION && raw != null) {
            return OrganizationType.valueOf(raw).label();
        }
        return raw;
    }

    /** Chave do "eu" no escopo pedido (meu id, minha residência, meu bairro ou minha organização). */
    private String myKey(UUID meId, RankingScope scope) {
        User me = users.findById(meId).orElse(null);
        if (me == null) {
            return null;
        }
        return switch (scope) {
            case USER -> me.getId().toString();
            case HOUSEHOLD -> me.getHousehold() == null ? null : me.getHousehold().getId().toString();
            case NEIGHBORHOOD -> me.getHousehold() == null ? null : me.getHousehold().getNeighborhood();
            case ORGANIZATION -> me.getOrganization() == null ? null : me.getOrganization().getId().toString();
        };
    }

    private String myName(UUID meId, RankingScope scope) {
        User me = users.findById(meId).orElseThrow();
        return switch (scope) {
            case USER -> me.getName();
            case HOUSEHOLD -> me.getHousehold().getName();
            case NEIGHBORHOOD -> me.getHousehold().getNeighborhood();
            case ORGANIZATION -> me.getOrganization().getName();
        };
    }
}
