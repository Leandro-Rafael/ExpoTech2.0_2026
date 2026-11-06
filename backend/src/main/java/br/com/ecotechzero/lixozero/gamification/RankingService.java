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

    static final int LIMITE_TOPO = 10;

    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository usuarios;
    private final Clock relogio;

    public RankingService(NamedParameterJdbcTemplate jdbc, UserRepository usuarios, Clock relogio) {
        this.jdbc = jdbc;
        this.usuarios = usuarios;
        this.relogio = relogio;
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

    private static final String POR_USUARIO = BASE + """
            select pu.id::text as id, pu.name as name, h.neighborhood as subtitle, pu.points, pu.kg
            from per_user pu left join households h on h.id = pu.household_id
            order by pu.points desc, pu.kg desc, pu.name
            """;

    private static final String POR_RESIDENCIA = BASE + """
            select h.id::text as id, h.name as name, h.neighborhood as subtitle, sum(pu.points) as points, sum(pu.kg) as kg
            from per_user pu join households h on h.id = pu.household_id
            group by h.id, h.name, h.neighborhood
            order by points desc, kg desc, h.name
            """;

    private static final String POR_BAIRRO = BASE + """
            select h.neighborhood as id, h.neighborhood as name, count(distinct h.id) || ' residência(s)' as subtitle,
                   sum(pu.points) as points, sum(pu.kg) as kg
            from per_user pu join households h on h.id = pu.household_id
            group by h.neighborhood
            order by points desc, kg desc, h.neighborhood
            """;

    private static final String POR_ORGANIZACAO = BASE + """
            select o.id::text as id, o.name as name, o.type as subtitle, sum(pu.points) as points, sum(pu.kg) as kg
            from per_user pu join organizations o on o.id = pu.organization_id
            group by o.id, o.name, o.type
            order by points desc, kg desc, o.name
            """;

    @Transactional(readOnly = true)
    public Ranking classificacao(UUID meuId, RankingScope escopo, RankingPeriod periodo) {
        // 1. Converte o período escolhido em uma data de início.
        Instant desde = switch (periodo) {
            case WEEK -> relogio.instant().minus(Duration.ofDays(7));
            case MONTH -> relogio.instant().minus(Duration.ofDays(30));
            case YEAR -> relogio.instant().minus(Duration.ofDays(365));
            case ALL -> Instant.EPOCH;
        };
        // 2. Escolhe a consulta do agrupamento (pessoa, residência, bairro ou organização) e roda no banco,
        //    que já devolve tudo ordenado por pontos e, no empate, por kg.
        String sql = switch (escopo) {
            case USER -> POR_USUARIO;
            case HOUSEHOLD -> POR_RESIDENCIA;
            case NEIGHBORHOOD -> POR_BAIRRO;
            case ORGANIZATION -> POR_ORGANIZACAO;
        };
        List<Row> linhas = jdbc.query(sql, new MapSqlParameterSource("since", Timestamp.from(desde)), (rs, i) -> new Row(
                rs.getString("id"), rs.getString("name"), subtitulo(escopo, rs.getString("subtitle")),
                rs.getLong("points"), Numbers.arredondar2(rs.getDouble("kg"))));

        // 3. Numera as posições, guarda só o top 10 e acha a linha do "eu" mesmo se estiver fora do top 10.
        String minhaChave = minhaChave(meuId, escopo);
        List<RankingEntry> entradas = new ArrayList<>();
        RankingEntry eu = null;
        for (int i = 0; i < linhas.size(); i++) {
            Row r = linhas.get(i);
            boolean ehEu = r.id().equals(minhaChave);
            RankingEntry entrada = new RankingEntry(i + 1, r.id(), r.name(), r.subtitle(), r.points(), r.kg(), ehEu);
            if (i < LIMITE_TOPO) {
                entradas.add(entrada);
            }
            if (ehEu) {
                eu = entrada;
            }
        }
        // 4. Quem ainda não pontuou no período aparece como último, com zero.
        if (eu == null && minhaChave != null) {
            eu = new RankingEntry(linhas.size() + 1, minhaChave, meuNome(meuId, escopo), null, 0, 0, true);
        }
        return new Ranking(escopo, periodo, entradas, eu);
    }

    private static String subtitulo(RankingScope escopo, String bruto) {
        if (escopo == RankingScope.ORGANIZATION && bruto != null) {
            return OrganizationType.valueOf(bruto).label();
        }
        return bruto;
    }

    /** Chave do "eu" no escopo pedido (meu id, minha residência, meu bairro ou minha organização). */
    private String minhaChave(UUID meuId, RankingScope escopo) {
        User eu = usuarios.findById(meuId).orElse(null);
        if (eu == null) {
            return null;
        }
        return switch (escopo) {
            case USER -> eu.getId().toString();
            case HOUSEHOLD -> eu.getHousehold() == null ? null : eu.getHousehold().getId().toString();
            case NEIGHBORHOOD -> eu.getHousehold() == null ? null : eu.getHousehold().getNeighborhood();
            case ORGANIZATION -> eu.getOrganization() == null ? null : eu.getOrganization().getId().toString();
        };
    }

    private String meuNome(UUID meuId, RankingScope escopo) {
        User eu = usuarios.findById(meuId).orElseThrow();
        return switch (escopo) {
            case USER -> eu.getName();
            case HOUSEHOLD -> eu.getHousehold().getName();
            case NEIGHBORHOOD -> eu.getHousehold().getNeighborhood();
            case ORGANIZATION -> eu.getOrganization().getName();
        };
    }
}
