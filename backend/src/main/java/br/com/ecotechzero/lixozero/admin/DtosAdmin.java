package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.audit.ServicoAuditoria.AuditEntryDto;
import br.com.ecotechzero.lixozero.user.PerfilUsuario;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Formatos de dados trocados com o painel do administrador. */
public final class DtosAdmin {

    private DtosAdmin() {
    }

    /** locked = bloqueio ativo (senha errada ou inspeção); lockReason PASSWORD | INSPECTION; lockedUntil = fim do bloqueio ativo. */
    public record AdminUser(UUID id, String name, String email, PerfilUsuario role, boolean enabled, boolean locked, String lockReason,
                            Instant lockedUntil, int securityWarnings, long points, long totalEarned, String household,
                            Instant createdAt, Instant lastLoginAt) {
    }

    /** PATCH /api/admin/users/{id}: campos nulos não são alterados. */
    public record UpdateUserRequest(PerfilUsuario role, Boolean enabled) {
    }

    public record DayPoint(LocalDate date, long count, double kg) {
    }

    public record AdminOverview(long users, long activeUsers30d, long pendingDisposals, long flaggedDisposals,
                                long openCollectionRequests, long binsNeedingCollection, double totalKg, double recycledKg,
                                long pointsIssued, long redemptions, List<DayPoint> disposalsLast14Days,
                                List<AuditEntryDto> recentAudit) {
    }
}
