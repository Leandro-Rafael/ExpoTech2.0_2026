package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.disposal.RepositorioDescartes;
import br.com.ecotechzero.lixozero.disposal.StatusDescarte;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.BadgeDto;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.ChallengeDto;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.ChallengeInput;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.GamificationSummary;
import br.com.ecotechzero.lixozero.gamification.DtosGamificacao.LevelRef;
import br.com.ecotechzero.lixozero.gamification.badge.CatalogoMedalhas;
import br.com.ecotechzero.lixozero.gamification.badge.RegraMedalha;
import br.com.ecotechzero.lixozero.gamification.badge.EstatisticasMedalha;
import br.com.ecotechzero.lixozero.points.PointTransactionType;
import br.com.ecotechzero.lixozero.points.ServicoPontos;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
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
public class ServicoGamificacao {

    private final RepositorioDescartes descartes;
    private final RepositorioDesafios desafios;
    private final RepositorioConclusoesDesafio conclusoes;
    private final RepositorioMedalhasUsuario medalhas;
    private final RepositorioUsuarios usuarios;
    private final ServicoPontos pontos;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager em;
    private final ServicoAuditoria auditoria;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoGamificacao(RepositorioDescartes descartes, RepositorioDesafios desafios, RepositorioConclusoesDesafio conclusoes,
                               RepositorioMedalhasUsuario medalhas, RepositorioUsuarios usuarios, ServicoPontos pontos, NamedParameterJdbcTemplate jdbc,
                               EntityManager em, ServicoAuditoria auditoria, PropriedadesApp propriedades, Clock relogio) {
        this.descartes = descartes;
        this.desafios = desafios;
        this.conclusoes = conclusoes;
        this.medalhas = medalhas;
        this.usuarios = usuarios;
        this.pontos = pontos;
        this.jdbc = jdbc;
        this.em = em;
        this.auditoria = auditoria;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    /**
     * Chamado após a aprovação de um descarte: concede medalhas novas e paga o bônus dos desafios concluídos
     * (cada bônus uma única vez, garantido também por índice único no banco).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void aoAprovarDescarte(UUID usuarioId, Instant dataDescarte) {
        em.flush(); // garante que as consultas SQL abaixo enxerguem a aprovação recém-feita
        Instant agora = relogio.instant();
        LocalDate dia = dataDescarte.atZone(propriedades.zoneId()).toLocalDate();
        User referenciaUsuario = usuarios.getReferenceById(usuarioId);
        Set<UUID> concluidos = conclusoes.findByUserId(usuarioId).stream().map(c -> c.getChallenge().getId()).collect(Collectors.toSet());
        for (Challenge desafio : desafios.findByActiveTrueAndEndsAtGreaterThanEqualOrderByEndsAt(dia)) {
            if (!desafio.covers(dia) || concluidos.contains(desafio.getId())) {
                continue;
            }
            if (progresso(usuarioId, desafio) >= desafio.getTarget()) {
                conclusoes.save(new ChallengeCompletion(referenciaUsuario, desafio, agora));
                if (desafio.getBonusPoints() > 0) {
                    pontos.creditar(usuarioId, desafio.getBonusPoints(), PointTransactionType.BONUS,
                            "Bônus do desafio: " + desafio.getTitle(), null, desafio, agora);
                }
            }
        }
        concederMedalhas(usuarioId, agora);
    }

    /** Avalia e grava medalhas recém-conquistadas. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void concederMedalhas(UUID usuarioId, Instant agora) {
        em.flush();
        EstatisticasMedalha estatisticas = estatisticasDe(usuarioId);
        Set<String> conquistadas = new HashSet<>();
        medalhas.findByUserId(usuarioId).forEach(b -> conquistadas.add(b.getBadgeCode()));
        for (RegraMedalha regra : CatalogoMedalhas.TODAS) {
            if (!conquistadas.contains(regra.code()) && regra.isEarned(estatisticas)) {
                medalhas.save(new UserBadge(usuarios.getReferenceById(usuarioId), regra.code(), agora));
            }
        }
    }

    @Transactional(readOnly = true)
    public GamificationSummary resumo(UUID usuarioId) {
        User usuario = usuarios.findById(usuarioId).orElseThrow(() -> ExcecaoApi.naoEncontrado("Usuário não encontrado."));
        Map<String, UserBadge> conquistadas = medalhas.findByUserId(usuarioId).stream()
                .collect(Collectors.toMap(UserBadge::getBadgeCode, Function.identity(), (a, b) -> a));
        List<BadgeDto> medalhasDto = CatalogoMedalhas.TODAS.stream().map(regra -> {
            UserBadge conquistada = conquistadas.get(regra.code());
            return new BadgeDto(regra.code(), regra.name(), regra.description(), regra.icon(), regra.tier(),
                    conquistada != null, conquistada == null ? null : conquistada.getAwardedAt());
        }).toList();

        LocalDate hoje = LocalDate.now(relogio.withZone(propriedades.zoneId()));
        Set<UUID> concluidos = conclusoes.findByUserId(usuarioId).stream().map(c -> c.getChallenge().getId()).collect(Collectors.toSet());
        List<ChallengeDto> desafiosDto = desafios.findByActiveTrueAndEndsAtGreaterThanEqualOrderByEndsAt(hoje.minusDays(7)).stream()
                .map(c -> paraDto(c, Numeros.arredondar2(progresso(usuarioId, c)), concluidos.contains(c.getId())))
                .toList();

        // nível usa o total já ganho, não o saldo: trocar pontos por recompensa não derruba o nível
        List<LevelRef> niveis = CatalogoNiveis.NIVEIS.stream().map(l -> new LevelRef(l.index(), l.name(), l.minPoints())).toList();
        return new GamificationSummary(usuario.getPoints(), usuario.getTotalEarned(), CatalogoNiveis.nivelPara(usuario.getTotalEarned()),
                niveis, medalhasDto, desafiosDto, diasSeguidos(usuarioId));
    }

    /** Progresso do usuário no desafio (kg ou quantidade de descartes aprovados no período). */
    double progresso(UUID usuarioId, Challenge c) {
        ZoneId fuso = propriedades.zoneId();
        Instant inicio = c.getStartsAt().atStartOfDay(fuso).toInstant();
        Instant fim = c.getEndsAt().plusDays(1).atStartOfDay(fuso).toInstant();
        List<Object[]> linhas = descartes.progressBetween(usuarioId, StatusDescarte.APPROVED, inicio, fim, c.getCategoryCode());
        if (linhas.isEmpty()) {
            return 0;
        }
        Object[] linha = linhas.getFirst();
        return c.getMetric() == Challenge.Metric.KG ? Numeros.paraDouble(linha[0]) : Numeros.paraDouble(linha[1]);
    }

    EstatisticasMedalha estatisticasDe(UUID usuarioId) {
        Map<CodigoCategoria, Double> kgPorCategoria = new EnumMap<>(CodigoCategoria.class);
        long quantidade = 0;
        double total = 0;
        for (Object[] linha : descartes.statsByCategory(usuarioId, StatusDescarte.APPROVED)) {
            double kg = Numeros.paraDouble(linha[1]);
            kgPorCategoria.put((CodigoCategoria) linha[0], kg);
            total += kg;
            quantidade += Numeros.paraLong(linha[2]);
        }
        var parametros = new MapSqlParameterSource("uid", usuarioId);
        Boolean temLixeira = jdbc.queryForObject("""
                select exists(select 1 from smart_bins b join users u on u.household_id = b.household_id where u.id = :uid)
                """, parametros, Boolean.class);
        long totalGanho = usuarios.findById(usuarioId).map(User::getTotalEarned).orElse(0L);
        return new EstatisticasMedalha(quantidade, total, kgPorCategoria, diasSeguidos(usuarioId), totalGanho, Boolean.TRUE.equals(temLixeira));
    }

    /** Dias consecutivos (até hoje ou ontem) com pelo menos um descarte aprovado. */
    int diasSeguidos(UUID usuarioId) {
        LocalDate hoje = LocalDate.now(relogio.withZone(propriedades.zoneId()));
        var parametros = new MapSqlParameterSource()
                .addValue("uid", usuarioId)
                .addValue("zone", propriedades.zone())
                .addValue("since", Timestamp.from(hoje.minusDays(400).atStartOfDay(propriedades.zoneId()).toInstant()));
        List<LocalDate> dias = jdbc.query("""
                select distinct cast(d.disposed_at at time zone :zone as date) as day
                from disposals d
                where d.user_id = :uid and d.status = 'APPROVED' and d.disposed_at >= :since
                order by day desc
                """, parametros, (rs, i) -> rs.getObject("day", Date.class).toLocalDate());
        return CalculadoraSequencia.sequencia(dias, hoje);
    }

    // ---------- Administração de desafios ----------

    @Transactional(readOnly = true)
    public List<ChallengeDto> listarDesafios() {
        return desafios.findAllByOrderByStartsAtDesc().stream().map(c -> paraDto(c, 0, false)).toList();
    }

    @Transactional
    public ChallengeDto criarDesafio(ChallengeInput entrada) {
        validar(entrada);
        Challenge desafio = new Challenge(entrada.title());
        desafio.apply(entrada);
        desafios.save(desafio);
        auditoria.registrar(AcaoAuditoria.CHALLENGE_CREATED, "Challenge", desafio.getId(), desafio.getTitle());
        return paraDto(desafio, 0, false);
    }

    @Transactional
    public ChallengeDto atualizarDesafio(UUID id, ChallengeInput entrada) {
        validar(entrada);
        Challenge desafio = desafios.findById(id).orElseThrow(() -> ExcecaoApi.naoEncontrado("Desafio não encontrado."));
        desafio.apply(entrada);
        auditoria.registrar(AcaoAuditoria.CHALLENGE_UPDATED, "Challenge", id, desafio.getTitle());
        return paraDto(desafio, 0, false);
    }

    private static void validar(ChallengeInput entrada) {
        if (entrada.endsAt().isBefore(entrada.startsAt())) {
            throw ExcecaoApi.campo("endsAt", "a data final deve ser igual ou posterior à inicial");
        }
        if (entrada.metric() == Challenge.Metric.COUNT && entrada.target() != Math.floor(entrada.target())) {
            throw ExcecaoApi.campo("target", "para desafios por quantidade, use um número inteiro");
        }
    }

    static ChallengeDto paraDto(Challenge c, double progresso, boolean concluido) {
        return new ChallengeDto(c.getId(), c.getTitle(), c.getDescription(), c.getCategoryCode(), c.getMetric(), c.getTarget(),
                progresso, c.getBonusPoints(), c.getStartsAt(), c.getEndsAt(), c.isActive(), concluido);
    }
}
