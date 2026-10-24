package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.admin.AdminDtos.AdminOverview;
import br.com.ecotechzero.lixozero.admin.AdminDtos.AdminUser;
import br.com.ecotechzero.lixozero.admin.AdminDtos.DayPoint;
import br.com.ecotechzero.lixozero.admin.AdminDtos.UpdateUserRequest;
import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.auth.LoginAttemptService;
import br.com.ecotechzero.lixozero.auth.RefreshToken;
import br.com.ecotechzero.lixozero.auth.RefreshTokenService;
import br.com.ecotechzero.lixozero.collection.CollectionRequestRepository;
import br.com.ecotechzero.lixozero.collection.CollectionRequestStatus;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.common.Pagination;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import br.com.ecotechzero.lixozero.disposal.DisposalStatus;
import br.com.ecotechzero.lixozero.points.PointTransactionRepository;
import br.com.ecotechzero.lixozero.reward.RedemptionRepository;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.Role;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserDtos.UserRef;
import br.com.ecotechzero.lixozero.user.UserRepository;
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
public class AdminService {

    private final UserRepository users;
    private final DisposalRepository disposals;
    private final CollectionRequestRepository requests;
    private final PointTransactionRepository transactions;
    private final RedemptionRepository redemptions;
    private final RefreshTokenService refreshTokens;
    private final LoginAttemptService loginAttempts;
    private final AuditService audit;
    private final NamedParameterJdbcTemplate jdbc;
    private final AppProperties props;
    private final Clock clock;

    public AdminService(UserRepository users, DisposalRepository disposals, CollectionRequestRepository requests,
                        PointTransactionRepository transactions, RedemptionRepository redemptions, RefreshTokenService refreshTokens,
                        LoginAttemptService loginAttempts, AuditService audit, NamedParameterJdbcTemplate jdbc,
                        AppProperties props, Clock clock) {
        this.users = users;
        this.disposals = disposals;
        this.requests = requests;
        this.transactions = transactions;
        this.redemptions = redemptions;
        this.refreshTokens = refreshTokens;
        this.loginAttempts = loginAttempts;
        this.audit = audit;
        this.jdbc = jdbc;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AdminOverview overview() {
        Instant now = clock.instant();
        var params = new MapSqlParameterSource().addValue("zone", props.zone());
        Map<String, Object> kg = jdbc.queryForMap("""
                select coalesce(sum(d.quantity_kg), 0) as total,
                       coalesce(sum(d.quantity_kg) filter (where c.recyclable), 0) as recycled
                from disposals d join categories c on c.id = d.category_id where d.status = 'APPROVED'
                """, params);
        Long bins = jdbc.queryForObject(
                "select count(*) from smart_bins where fill_level >= least(auto_request_threshold, 90)", params, Long.class);

        LocalDate today = LocalDate.now(clock.withZone(props.zoneId()));
        LocalDate first = today.minusDays(13);
        params.addValue("from", Timestamp.from(first.atStartOfDay(props.zoneId()).toInstant()));
        Map<LocalDate, DayPoint> byDay = new HashMap<>();
        jdbc.query("""
                select cast(disposed_at at time zone :zone as date) as day, count(*) as cnt, sum(quantity_kg) as kg
                from disposals where disposed_at >= :from and status <> 'REJECTED' group by day
                """, params, rs -> {
            LocalDate day = rs.getObject("day", Date.class).toLocalDate();
            byDay.put(day, new DayPoint(day, rs.getLong("cnt"), Numbers.round2(rs.getDouble("kg"))));
        });
        List<DayPoint> series = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(today); d = d.plusDays(1)) {
            series.add(byDay.getOrDefault(d, new DayPoint(d, 0, 0)));
        }
        return new AdminOverview(users.count(), users.countActiveSince(now.minus(Duration.ofDays(30))),
                disposals.countByStatus(DisposalStatus.PENDING), disposals.countByStatusAndFlaggedTrue(DisposalStatus.PENDING),
                requests.countByStatusIn(CollectionRequestStatus.OPEN), bins == null ? 0 : bins,
                Numbers.round2(Numbers.toDouble(kg.get("total"))), Numbers.round2(Numbers.toDouble(kg.get("recycled"))),
                transactions.totalIssued(), redemptions.count(), series, audit.recent());
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUser> searchUsers(String q, Role role, Integer page, Integer size) {
        String cleaned = Text.clean(q);
        String pattern = cleaned == null ? null : "%" + Text.truncate(cleaned, 100).toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        var pageable = Pagination.of(page, size, Sort.by("name"));
        return PageResponse.of(users.search(pattern, role, pageable), this::toAdminUser);
    }

    @Transactional
    public AdminUser updateUser(AuthUser admin, UUID id, UpdateUserRequest request) {
        User user = users.findById(id).orElseThrow(() -> ApiException.notFound("Usuário não encontrado."));
        if (user.getId().equals(admin.id()) && (request.role() != null || Boolean.FALSE.equals(request.enabled()))) {
            throw ApiException.business("Você não pode alterar o próprio perfil nem desativar a própria conta.");
        }
        if (request.role() != null && request.role() != user.getRole()) {
            audit.record(AuditAction.USER_ROLE_CHANGED, "User", id, user.getRole() + " -> " + request.role());
            user.setRole(request.role()); // vale na próxima requisição: o filtro JWT relê o perfil do banco
        }
        if (request.enabled() != null && request.enabled() != user.isEnabled()) {
            user.setEnabled(request.enabled());
            audit.record(AuditAction.USER_ENABLED_CHANGED, "User", id, request.enabled() ? "reativado" : "desativado");
            if (!request.enabled()) {
                refreshTokens.revokeAllForUser(id, RefreshToken.REASON_DISABLED);
            }
        }
        if (Boolean.TRUE.equals(request.enabled())) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
            loginAttempts.clear(user.getEmail());
        }
        return toAdminUser(user);
    }

    /**
     * Desbloqueio manual (ex.: alguém apertou F12 sem querer na apresentação): limpa o bloqueio por senha errada
     * e o bloqueio/avisos de inspeção. As sessões revogadas não voltam: o usuário faz login de novo.
     */
    @Transactional
    public AdminUser unlockUser(UUID id) {
        User user = users.findById(id).orElseThrow(() -> ApiException.notFound("Usuário não encontrado."));
        Instant now = clock.instant();
        String before = "senha: " + (user.isLocked(now) ? "bloqueado" : "livre") + ", inspeção: "
                + (user.isSecurityLocked(now) ? "bloqueado" : "livre") + ", avisos: " + user.activeSecurityWarnings(now);
        user.unlockAll();
        loginAttempts.clear(user.getEmail());
        audit.record(AuditAction.USER_UNLOCKED, "User", id, before);
        return toAdminUser(user);
    }

    @Transactional(readOnly = true)
    public List<UserRef> collectors() {
        List<UserRef> list = new ArrayList<>();
        users.findByRoleAndEnabledTrueOrderByName(Role.COLLECTOR).forEach(u -> list.add(UserRef.withEmail(u)));
        return list;
    }

    private AdminUser toAdminUser(User u) {
        Instant now = clock.instant();
        boolean inspection = u.isSecurityLocked(now);
        boolean password = u.isLocked(now);
        String reason = null;
        Instant until = null;
        if (inspection && (!password || !u.getLockedUntil().isAfter(u.getSecurityLockedUntil()))) {
            reason = "INSPECTION";
            until = u.getSecurityLockedUntil();
        } else if (password) {
            reason = "PASSWORD";
            until = u.getLockedUntil();
        }
        return new AdminUser(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isEnabled(), inspection || password,
                reason, until, u.activeSecurityWarnings(now), u.getPoints(), u.getTotalEarned(),
                u.getHousehold() == null ? null : u.getHousehold().getName(), u.getCreatedAt(), u.getLastLoginAt());
    }
}
