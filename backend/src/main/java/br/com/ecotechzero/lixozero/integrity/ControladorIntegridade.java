package br.com.ecotechzero.lixozero.integrity;

import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Verificação de integridade dos dados (apenas ADMIN, pela regra /api/admin/** do ConfigSeguranca). */
@RestController
public class ControladorIntegridade {

    private final ServicoIntegridade servico;
    private final LimitadorDeTaxa limitador;

    public ControladorIntegridade(ServicoIntegridade servico, LimitadorDeTaxa limitador) {
        this.servico = servico;
        this.limitador = limitador;
    }

    @GetMapping("/api/admin/integrity")
    public ResponseEntity<ServicoIntegridade.IntegrityReport> integridade(@AuthenticationPrincipal UsuarioAutenticado logado) {
        limitador.verificar(LimitadorDeTaxa.Policy.INTEGRITY_CHECK_USER, logado.id().toString());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servico.verificar());
    }
}
