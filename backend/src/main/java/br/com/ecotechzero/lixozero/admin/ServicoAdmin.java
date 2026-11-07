package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.admin.DtosAdmin.AdminOverview;
import br.com.ecotechzero.lixozero.admin.DtosAdmin.AdminUser;
import br.com.ecotechzero.lixozero.admin.DtosAdmin.DayPoint;
import br.com.ecotechzero.lixozero.admin.DtosAdmin.UpdateUserRequest;
import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.auth.ServicoTentativasLogin;
import br.com.ecotechzero.lixozero.auth.RefreshToken;
import br.com.ecotechzero.lixozero.auth.ServicoTokensRenovacao;
import br.com.ecotechzero.lixozero.collection.RepositorioSolicitacoesColeta;
import br.com.ecotechzero.lixozero.collection.StatusSolicitacaoColeta;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.common.RespostaPaginada;
import br.com.ecotechzero.lixozero.common.Paginacao;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.disposal.RepositorioDescartes;
import br.com.ecotechzero.lixozero.disposal.StatusDescarte;
import br.com.ecotechzero.lixozero.points.RepositorioTransacoesPontos;
import br.com.ecotechzero.lixozero.reward.RepositorioResgates;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.PerfilUsuario;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserRef;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Visão geral e gestão de usuários do painel administrativo. */
@Service
public class ServicoAdmin {

    private final RepositorioUsuarios usuarios;
    private final RepositorioDescartes descartes;
    private final RepositorioSolicitacoesColeta solicitacoes;
    private final RepositorioTransacoesPontos transacoes;
    private final RepositorioResgates resgates;
    private final ServicoTokensRenovacao tokensRenovacao;
    private final ServicoTentativasLogin tentativasLogin;
    private final ServicoAuditoria auditoria;
    private final NamedParameterJdbcTemplate jdbc;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoAdmin(RepositorioUsuarios usuarios, RepositorioDescartes descartes, RepositorioSolicitacoesColeta solicitacoes,
                        RepositorioTransacoesPontos transacoes, RepositorioResgates resgates, ServicoTokensRenovacao tokensRenovacao,
                        ServicoTentativasLogin tentativasLogin, ServicoAuditoria auditoria, NamedParameterJdbcTemplate jdbc,
                        PropriedadesApp propriedades, Clock relogio) {
        this.usuarios = usuarios;
        this.descartes = descartes;
        this.solicitacoes = solicitacoes;
        this.transacoes = transacoes;
        this.resgates = resgates;
        this.tokensRenovacao = tokensRenovacao;
        this.tentativasLogin = tentativasLogin;
        this.auditoria = auditoria;
        this.jdbc = jdbc;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public AdminOverview visaoGeral() {
        Instant agora = relogio.instant();
        var parametros = new MapSqlParameterSource().addValue("zone", propriedades.zone());
        Map<String, Object> kg = jdbc.queryForMap("""
                select coalesce(sum(d.quantity_kg), 0) as total,
                       coalesce(sum(d.quantity_kg) filter (where c.recyclable), 0) as recycled
                from disposals d join categories c on c.id = d.category_id where d.status = 'APPROVED'
                """, parametros);
        Long lixeirasCheias = jdbc.queryForObject(
                "select count(*) from smart_bins where fill_level >= least(auto_request_threshold, 90)", parametros, Long.class);

        LocalDate hoje = LocalDate.now(relogio.withZone(propriedades.zoneId()));
        LocalDate primeiroDia = hoje.minusDays(13);
        parametros.addValue("from", Timestamp.from(primeiroDia.atStartOfDay(propriedades.zoneId()).toInstant()));
        Map<LocalDate, DayPoint> porDia = new HashMap<>();
        jdbc.query("""
                select cast(disposed_at at time zone :zone as date) as day, count(*) as cnt, sum(quantity_kg) as kg
                from disposals where disposed_at >= :from and status <> 'REJECTED' group by day
                """, parametros, rs -> {
            LocalDate dia = rs.getObject("day", Date.class).toLocalDate();
            porDia.put(dia, new DayPoint(dia, rs.getLong("cnt"), Numeros.arredondar2(rs.getDouble("kg"))));
        });
        List<DayPoint> serie = new ArrayList<>();
        for (LocalDate d = primeiroDia; !d.isAfter(hoje); d = d.plusDays(1)) {
            serie.add(porDia.getOrDefault(d, new DayPoint(d, 0, 0)));
        }
        return new AdminOverview(usuarios.count(), usuarios.countActiveSince(agora.minus(Duration.ofDays(30))),
                descartes.countByStatus(StatusDescarte.PENDING), descartes.countByStatusAndFlaggedTrue(StatusDescarte.PENDING),
                solicitacoes.countByStatusIn(StatusSolicitacaoColeta.OPEN), lixeirasCheias == null ? 0 : lixeirasCheias,
                Numeros.arredondar2(Numeros.paraDouble(kg.get("total"))), Numeros.arredondar2(Numeros.paraDouble(kg.get("recycled"))),
                transacoes.totalIssued(), resgates.count(), serie, auditoria.recentes());
    }

    @Transactional(readOnly = true)
    public RespostaPaginada<AdminUser> buscarUsuarios(String busca, PerfilUsuario perfil, Integer pagina, Integer tamanho) {
        String limpo = Textos.limpar(busca);
        String padrao = limpo == null ? null : "%" + Textos.truncar(limpo, 100).toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        var paginacao = Paginacao.criar(pagina, tamanho, Sort.by("name"));
        return RespostaPaginada.of(usuarios.search(padrao, perfil, paginacao), this::paraAdminUser);
    }

    @Transactional
    public AdminUser atualizarUsuario(UsuarioAutenticado adminLogado, UUID id, UpdateUserRequest dados) {
        User usuario = usuarios.findById(id).orElseThrow(() -> ExcecaoApi.naoEncontrado("Usuário não encontrado."));
        if (usuario.getId().equals(adminLogado.id()) && (dados.role() != null || Boolean.FALSE.equals(dados.enabled()))) {
            throw ExcecaoApi.regraNegocio("Você não pode alterar o próprio perfil nem desativar a própria conta.");
        }
        if (dados.role() != null && dados.role() != usuario.getRole()) {
            auditoria.registrar(AcaoAuditoria.USER_ROLE_CHANGED, "User", id, usuario.getRole() + " -> " + dados.role());
            usuario.setRole(dados.role()); // vale na próxima requisição: o filtro JWT relê o perfil do banco
        }
        if (dados.enabled() != null && dados.enabled() != usuario.isEnabled()) {
            usuario.setEnabled(dados.enabled());
            auditoria.registrar(AcaoAuditoria.USER_ENABLED_CHANGED, "User", id, dados.enabled() ? "reativado" : "desativado");
            if (!dados.enabled()) {
                tokensRenovacao.revogarTodasDoUsuario(id, RefreshToken.REASON_DISABLED);
            }
        }
        if (Boolean.TRUE.equals(dados.enabled())) {
            usuario.setFailedLoginAttempts(0);
            usuario.setLockedUntil(null);
            tentativasLogin.limpar(usuario.getEmail());
        }
        return paraAdminUser(usuario);
    }

    /**
     * Desbloqueio manual (ex.: alguém apertou F12 sem querer na apresentação): limpa o bloqueio por senha errada
     * e o bloqueio/avisos de inspeção. As sessões revogadas não voltam: o usuário faz login de novo.
     */
    @Transactional
    public AdminUser desbloquearUsuario(UUID id) {
        User usuario = usuarios.findById(id).orElseThrow(() -> ExcecaoApi.naoEncontrado("Usuário não encontrado."));
        Instant agora = relogio.instant();
        String antes = "senha: " + (usuario.isLocked(agora) ? "bloqueado" : "livre") + ", inspeção: "
                + (usuario.isSecurityLocked(agora) ? "bloqueado" : "livre") + ", avisos: " + usuario.activeSecurityWarnings(agora);
        usuario.unlockAll();
        tentativasLogin.limpar(usuario.getEmail());
        auditoria.registrar(AcaoAuditoria.USER_UNLOCKED, "User", id, antes);
        return paraAdminUser(usuario);
    }

    @Transactional(readOnly = true)
    public List<UserRef> coletores() {
        List<UserRef> lista = new ArrayList<>();
        usuarios.findByRoleAndEnabledTrueOrderByName(PerfilUsuario.COLLECTOR).forEach(u -> lista.add(UserRef.withEmail(u)));
        return lista;
    }

    private AdminUser paraAdminUser(User u) {
        Instant agora = relogio.instant();
        boolean porInspecao = u.isSecurityLocked(agora);
        boolean porSenha = u.isLocked(agora);
        String motivo = null;
        Instant ate = null;
        if (porInspecao && (!porSenha || !u.getLockedUntil().isAfter(u.getSecurityLockedUntil()))) {
            motivo = "INSPECTION";
            ate = u.getSecurityLockedUntil();
        } else if (porSenha) {
            motivo = "PASSWORD";
            ate = u.getLockedUntil();
        }
        return new AdminUser(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isEnabled(), porInspecao || porSenha,
                motivo, ate, u.activeSecurityWarnings(agora), u.getPoints(), u.getTotalEarned(),
                u.getHousehold() == null ? null : u.getHousehold().getName(), u.getCreatedAt(), u.getLastLoginAt());
    }
}
