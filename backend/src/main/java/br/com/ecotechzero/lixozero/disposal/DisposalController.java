package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.CreateDisposalRequest;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.DisposalDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/disposals")
public class DisposalController {

    private final DisposalService service;

    public DisposalController(DisposalService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<DisposalDto> create(@AuthenticationPrincipal AuthUser me,
                                              @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                              @Valid @RequestBody CreateDisposalRequest body) {
        String key = DisposalService.validateIdempotencyKey(idempotencyKey);
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(service.create(me, body, key));
        } catch (DataIntegrityViolationException race) {
            // duas requisições simultâneas com a mesma chave: a segunda devolve o resultado da primeira
            return service.findByIdempotencyKey(me.id(), key)
                    .map(existing -> ResponseEntity.status(HttpStatus.CREATED).body(existing))
                    .orElseThrow(() -> race);
        }
    }

    @GetMapping
    public PageResponse<DisposalDto> mine(@AuthenticationPrincipal AuthUser me,
                                          @RequestParam(required = false) DisposalStatus status,
                                          @RequestParam(required = false) Integer page,
                                          @RequestParam(required = false) Integer size) {
        return service.listMine(me.id(), status, page, size);
    }

    @GetMapping("/{id}")
    public DisposalDto get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.get(me, id);
    }
}
