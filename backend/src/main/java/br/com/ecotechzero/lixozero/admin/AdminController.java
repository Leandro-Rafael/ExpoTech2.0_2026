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
import java.util.List;
import java.util.UUID;

/** Painel administrativo: visão geral, usuários, moderação, auditoria e relatórios (apenas ADMIN). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService servicoAdmin;
    private final DisposalReviewService revisao;
    private final AuditService auditoria;
    private final CsvReportService relatorios;

    public AdminController(AdminService servicoAdmin, DisposalReviewService revisao, AuditService auditoria, CsvReportService relatorios) {
        this.servicoAdmin = servicoAdmin;
        this.revisao = revisao;
        this.auditoria = auditoria;
        this.relatorios = relatorios;
    }

    @GetMapping("/overview")
    public AdminOverview visaoGeral() {
        return servicoAdmin.visaoGeral();
    }

    @GetMapping("/users")
    public PageResponse<AdminUser> usuarios(@RequestParam(required = false) String q, @RequestParam(required = false) Role role,
                                         @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return servicoAdmin.buscarUsuarios(q, role, page, size);
    }

    @PatchMapping("/users/{id}")
    public AdminUser atualizarUsuario(@AuthenticationPrincipal AuthUser logado, @PathVariable UUID id, @Valid @RequestBody UpdateUserRequest corpo) {
        return servicoAdmin.atualizarUsuario(logado, id, corpo);
    }

    /** Remove o bloqueio por senha errada e o bloqueio/avisos de inspeção. */
    @PostMapping("/users/{id}/unlock")
    public AdminUser desbloquearUsuario(@PathVariable UUID id) {
        return servicoAdmin.desbloquearUsuario(id);
    }

    @GetMapping("/disposals")
    public PageResponse<DisposalDto> descartes(@RequestParam(required = false) DisposalStatus status,
                                               @RequestParam(required = false) Boolean flagged,
                                               @RequestParam(required = false) Integer page,
                                               @RequestParam(required = false) Integer size) {
        return revisao.fila(status, flagged, page, size);
    }

    @PostMapping("/disposals/{id}/approve")
    public DisposalDto aprovar(@AuthenticationPrincipal AuthUser logado, @PathVariable UUID id,
                               @Valid @RequestBody(required = false) ApproveRequest corpo) {
        return revisao.aprovar(logado, id, corpo);
    }

    @PostMapping("/disposals/{id}/reject")
    public DisposalDto recusar(@AuthenticationPrincipal AuthUser logado, @PathVariable UUID id, @Valid @RequestBody RejectRequest corpo) {
        return revisao.recusar(logado, id, corpo.reason());
    }

    @GetMapping("/audit")
    public PageResponse<AuditEntryDto> auditoria(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
                                             @RequestParam(required = false) List<String> action,
                                             @RequestParam(required = false) String q) {
        return auditoria.pagina(page, size, action, q);
    }

    @GetMapping("/reports/disposals.csv")
    public ResponseEntity<byte[]> descartesCsv(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        byte[] corpo = relatorios.descartesCsv(from, to).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"descartes.csv\"")
                .body(corpo);
    }
}
