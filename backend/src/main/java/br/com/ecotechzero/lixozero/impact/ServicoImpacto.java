package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.CategorySlice;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.GoalDto;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.GoalInput;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.ImpactSummary;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.MonthPoint;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.PublicStats;
import br.com.ecotechzero.lixozero.impact.DtosImpacto.Scope;
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
 * com agregações SQL. Fatores de conversão documentados em {@link FatoresImpacto}.
 */
@Service
public class ServicoImpacto {

    private final NamedParameterJdbcTemplate jdbc;
    private final RepositorioMetas metas;
    private final ServicoAuditoria auditoria;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoImpacto(NamedParameterJdbcTemplate jdbc, RepositorioMetas metas, ServicoAuditoria auditoria, PropriedadesApp propriedades, Clock relogio) {
        this.jdbc = jdbc;
        this.metas = metas;
        this.auditoria = auditoria;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    /** Totais por categoria (kg, CO2 e quantidade) com filtro opcional de usuário e período. */
    private record CategoryTotal(CodigoCategoria code, String name, String color, boolean recyclable, double kg, double co2, long count) {
    }

    private List<CategoryTotal> totais(UUID usuarioId, Instant inicio, Instant fim) {
        var parametros = new MapSqlParameterSource()
                .addValue("uid", usuarioId)
                .addValue("from", Timestamp.from(inicio))
                .addValue("to", Timestamp.from(fim));
        String filtroUsuario = usuarioId == null ? "" : " and d.user_id = :uid";
        return jdbc.query("""
                select c.code, c.name, c.color, c.recyclable,
                       coalesce(sum(d.quantity_kg), 0) as kg,
                       coalesce(sum(d.quantity_kg * c.co2_factor_kg), 0) as co2,
                       count(d.id) as cnt
                from categories c
                left join disposals d on d.category_id = c.id and d.status = 'APPROVED'
                     and d.disposed_at >= :from and d.disposed_at < :to""" + filtroUsuario + """

                group by c.code, c.name, c.color, c.recyclable
                order by kg desc, c.name
                """, parametros, (rs, i) -> new CategoryTotal(CodigoCategoria.valueOf(rs.getString("code")), rs.getString("name"),
                rs.getString("color"), rs.getBoolean("recyclable"), rs.getDouble("kg"), rs.getDouble("co2"), rs.getLong("cnt")));
    }

    @Transactional(readOnly = true)
    public PublicStats estatisticasPublicas() {
        List<CategoryTotal> todas = totais(null, Instant.EPOCH, relogio.instant().plusSeconds(3600));
        double total = todas.stream().mapToDouble(CategoryTotal::kg).sum();
        double reciclado = todas.stream().filter(CategoryTotal::recyclable).mapToDouble(CategoryTotal::kg).sum();
        double co2 = todas.stream().mapToDouble(CategoryTotal::co2).sum();
        long descartes = todas.stream().mapToLong(CategoryTotal::count).sum();
        Map<String, Object> contagens = jdbc.queryForMap("""
                select (select count(*) from users where role = 'USER' and enabled) as users,
                       (select count(*) from households) as households,
                       (select count(*) from collection_points where active) as points
                """, new MapSqlParameterSource());
        return new PublicStats(Numeros.arredondar2(total), Numeros.arredondar2(reciclado), Numeros.arredondar2(co2), Numeros.arredondar(FatoresImpacto.arvores(co2), 1),
                Numeros.paraLong(contagens.get("users")), Numeros.paraLong(contagens.get("households")), descartes,
                Numeros.paraLong(contagens.get("points")));
    }

    @Transactional(readOnly = true)
    public ImpactSummary resumo(UUID meuId, Scope escopo, int meses) {
        if (meses < 1 || meses > 36) {
            throw ExcecaoApi.campo("months", "informe entre 1 e 36 meses");
        }
        UUID usuarioId = escopo == Scope.ME ? meuId : null;
        List<CategoryTotal> todas = totais(usuarioId, Instant.EPOCH, relogio.instant().plusSeconds(3600));
        double total = todas.stream().mapToDouble(CategoryTotal::kg).sum();
        double reciclado = todas.stream().filter(CategoryTotal::recyclable).mapToDouble(CategoryTotal::kg).sum();
        double co2 = todas.stream().mapToDouble(CategoryTotal::co2).sum();
        double energia = todas.stream().mapToDouble(t -> FatoresImpacto.energiaKwh(t.code(), t.kg())).sum();
        double agua = todas.stream().mapToDouble(t -> FatoresImpacto.aguaLitros(t.code(), t.kg())).sum();
        long quantidade = todas.stream().mapToLong(CategoryTotal::count).sum();
        List<CategorySlice> porCategoria = todas.stream()
                .map(t -> new CategorySlice(t.code(), t.name(), t.color(), Numeros.arredondar2(t.kg()),
                        Numeros.arredondar(Numeros.razao(t.kg(), total) * 100, 1)))
                .toList();
        return new ImpactSummary(escopo, Numeros.arredondar2(total), Numeros.arredondar2(reciclado), Numeros.arredondar(Numeros.razao(reciclado, total), 4),
                Numeros.arredondar2(co2), Numeros.arredondar(FatoresImpacto.arvores(co2), 1), Numeros.arredondar(energia, 1), Numeros.arredondar(agua, 0),
                quantidade, porCategoria, porMes(usuarioId, meses), metasDto());
    }

    /** Série mensal dos últimos N meses (meses sem descartes aparecem com zero). */
    private List<MonthPoint> porMes(UUID usuarioId, int meses) {
        ZoneId fuso = propriedades.zoneId();
        YearMonth atual = YearMonth.now(relogio.withZone(fuso));
        YearMonth primeiro = atual.minusMonths(meses - 1L);
        var parametros = new MapSqlParameterSource()
                .addValue("uid", usuarioId)
                .addValue("zone", propriedades.zone())
                .addValue("from", Timestamp.from(primeiro.atDay(1).atStartOfDay(fuso).toInstant()));
        String filtroUsuario = usuarioId == null ? "" : " and d.user_id = :uid";
        Map<String, MonthPoint> encontrados = new HashMap<>();
        jdbc.query("""
                select to_char(d.disposed_at at time zone :zone, 'YYYY-MM') as month,
                       sum(d.quantity_kg) as kg,
                       coalesce(sum(d.quantity_kg) filter (where c.recyclable), 0) as recycled,
                       sum(d.quantity_kg * c.co2_factor_kg) as co2
                from disposals d join categories c on c.id = d.category_id
                where d.status = 'APPROVED' and d.disposed_at >= :from""" + filtroUsuario + """

                group by month
                """, parametros, rs -> {
            String mes = rs.getString("month");
            encontrados.put(mes, new MonthPoint(mes, Numeros.arredondar2(rs.getDouble("kg")), Numeros.arredondar2(rs.getDouble("recycled")),
                    Numeros.arredondar2(rs.getDouble("co2"))));
        });
        List<MonthPoint> serie = new ArrayList<>();
        for (YearMonth m = primeiro; !m.isAfter(atual); m = m.plusMonths(1)) {
            String chave = m.toString();
            serie.add(encontrados.getOrDefault(chave, new MonthPoint(chave, 0, 0, 0)));
        }
        return serie;
    }

    // ---------- Metas ----------

    @Transactional(readOnly = true)
    public List<GoalDto> metasDto() {
        return metas.findAllByOrderByYearAscTitleAsc().stream().map(this::paraDto).toList();
    }

    @Transactional
    public GoalDto criarMeta(GoalInput entrada) {
        Goal meta = new Goal(entrada.year(), entrada.title().strip(), entrada.targetRecyclingRate(), entrada.targetKg());
        metas.save(meta);
        auditoria.registrar(AcaoAuditoria.GOAL_CREATED, "Goal", meta.getId(), meta.getYear() + " - " + meta.getTitle());
        return paraDto(meta);
    }

    @Transactional
    public GoalDto atualizarMeta(UUID id, GoalInput entrada) {
        Goal meta = metas.findById(id).orElseThrow(() -> ExcecaoApi.naoEncontrado("Meta não encontrada."));
        meta.apply(entrada);
        auditoria.registrar(AcaoAuditoria.GOAL_UPDATED, "Goal", id, meta.getYear() + " - " + meta.getTitle());
        return paraDto(meta);
    }

    /**
     * Progresso da meta: usa os dados da comunidade no ano da meta; para metas futuras (ex.: 2050),
     * usa os últimos 12 meses como "situação atual". progress = média entre o avanço da taxa e o dos kg.
     */
    private GoalDto paraDto(Goal g) {
        ZoneId fuso = propriedades.zoneId();
        int anoAtual = LocalDate.now(relogio.withZone(fuso)).getYear();
        Instant inicio, fim;
        if (g.getYear() <= anoAtual) {
            inicio = LocalDate.of(g.getYear(), 1, 1).atStartOfDay(fuso).toInstant();
            fim = LocalDate.of(g.getYear() + 1, 1, 1).atStartOfDay(fuso).toInstant();
        } else {
            fim = relogio.instant();
            inicio = fim.minusSeconds(365L * 24 * 3600);
        }
        List<CategoryTotal> totais = totais(null, inicio, fim);
        double kg = totais.stream().mapToDouble(CategoryTotal::kg).sum();
        double reciclado = totais.stream().filter(CategoryTotal::recyclable).mapToDouble(CategoryTotal::kg).sum();
        double taxa = Numeros.razao(reciclado, kg);
        double progressoTaxa = g.getTargetRecyclingRate() <= 0 ? 1 : Math.min(1, taxa / g.getTargetRecyclingRate());
        double progressoKg = g.getTargetKg() <= 0 ? 1 : Math.min(1, kg / g.getTargetKg());
        return new GoalDto(g.getId(), g.getYear(), g.getTitle(), g.getTargetRecyclingRate(), Numeros.arredondar2(g.getTargetKg()),
                Numeros.arredondar(taxa, 4), Numeros.arredondar2(kg), Numeros.arredondar((progressoTaxa + progressoKg) / 2, 4));
    }
}
