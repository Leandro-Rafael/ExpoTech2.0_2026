package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.common.RespostaPaginada;
import br.com.ecotechzero.lixozero.disposal.DtosDescarte.CreateDisposalRequest;
import br.com.ecotechzero.lixozero.disposal.DtosDescarte.DisposalDto;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
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

/** Endpoints do morador para registrar e consultar os próprios descartes; a regra fica no ServicoDescartes. */
@RestController
@RequestMapping("/api/disposals")
public class ControladorDescartes {

    private final ServicoDescartes servico;

    public ControladorDescartes(ServicoDescartes servico) {
        this.servico = servico;
    }

    @PostMapping
    public ResponseEntity<DisposalDto> criar(@AuthenticationPrincipal UsuarioAutenticado logado,
                                              @RequestHeader(value = "Idempotency-Key", required = false) String chaveIdempotencia,
                                              @Valid @RequestBody CreateDisposalRequest corpo) {
        String chave = ServicoDescartes.validarChaveIdempotencia(chaveIdempotencia);
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(servico.criar(logado, corpo, chave));
        } catch (DataIntegrityViolationException conflito) {
            // duas requisições simultâneas com a mesma chave: a segunda devolve o resultado da primeira
            return servico.buscarPorChaveIdempotencia(logado.id(), chave)
                    .map(existente -> ResponseEntity.status(HttpStatus.CREATED).body(existente))
                    .orElseThrow(() -> conflito);
        }
    }

    @GetMapping
    public RespostaPaginada<DisposalDto> meus(@AuthenticationPrincipal UsuarioAutenticado logado,
                                          @RequestParam(required = false) StatusDescarte status,
                                          @RequestParam(required = false) Integer page,
                                          @RequestParam(required = false) Integer size) {
        return servico.listarMeus(logado.id(), status, page, size);
    }

    @GetMapping("/{id}")
    public DisposalDto buscar(@AuthenticationPrincipal UsuarioAutenticado logado, @PathVariable UUID id) {
        return servico.buscar(logado, id);
    }
}
