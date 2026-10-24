package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.admin.AdminDtos.AdminOverview;
import br.com.ecotechzero.lixozero.admin.AdminDtos.AdminUser;
import br.com.ecotechzero.lixozero.admin.AdminDtos.UpdateUserRequest;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.audit.AuditService.AuditEntryDto;
import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.ApproveRequest;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.DisposalDto;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.RejectRequest;
import br.com.ecotechzero.lixozero.disposal.DisposalReviewService;
import br.com.ecotechzero.lixozero.disposal.DisposalStatus;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.Role;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

/** Painel administrativo: visão geral, usuários, moderação, auditoria e relatórios (apenas ADMIN). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService admin;
    private final DisposalReviewService review;
    private final AuditService audit;
    private final CsvReportService reports;

    public AdminController(AdminService admin, DisposalReviewService review, AuditService audit, CsvReportService reports) {
        this.admin = admin;
        this.review = review;
        this.audit = audit;
        this.reports = reports;
    }

    @GetMapping("/overview")
    public AdminOverview overview() {
        return admin.overview();
    }

    @GetMapping("/users")
    public PageResponse<AdminUser> users(@RequestParam(required = false) String q, @RequestParam(required = false) Role role,
                                         @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return admin.searchUsers(q, role, page, size);
    }

    @PatchMapping("/users/{id}")
    public AdminUser updateUser(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @Valid @RequestBody UpdateUserRequest body) {
        return admin.updateUser(me, id, body);
    }

    /** Remove o bloqueio por senha errada e o bloqueio/avisos de inspeção. */
    @PostMapping("/users/{id}/unlock")
    public AdminUser unlockUser(@PathVariable UUID id) {
        return admin.unlockUser(id);
    }

    @GetMapping("/disposals")
    public PageResponse<DisposalDto> disposals(@RequestParam(required = false) DisposalStatus status,
                                               @RequestParam(required = false) Boolean flagged,
                                               @RequestParam(required = false) Integer page,
                                               @RequestParam(required = false) Integer size) {
        return review.queue(status, flagged, page, size);
    }

    @PostMapping("/disposals/{id}/approve")
    public DisposalDto approve(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                               @Valid @RequestBody(required = false) ApproveRequest body) {
        return review.approve(me, id, body);
    }

    @PostMapping("/disposals/{id}/reject")
    public DisposalDto reject(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @Valid @RequestBody RejectRequest body) {
        return review.reject(me, id, body.reason());
    }

    @GetMapping("/audit")
    public PageResponse<AuditEntryDto> audit(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return audit.page(page, size);
    }

    @GetMapping("/reports/disposals.csv")
    public ResponseEntity<byte[]> disposalsCsv(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        byte[] body = reports.disposalsCsv(from, to).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"descartes.csv\"")
                .body(body);
    }
}
