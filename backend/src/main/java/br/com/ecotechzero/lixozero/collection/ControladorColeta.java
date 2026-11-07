package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.collection.DtosColeta.CollectionPointDto;
import br.com.ecotechzero.lixozero.collection.DtosColeta.CollectionRequestDto;
import br.com.ecotechzero.lixozero.collection.DtosColeta.CreateCollectionRequest;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Endpoints do morador para listar ecopontos e pedir, listar ou cancelar coletas. */
@RestController
public class ControladorColeta {

    private final ServicoEcopontos ecopontos;
    private final ServicoSolicitacoesColeta solicitacoes;

    public ControladorColeta(ServicoEcopontos ecopontos, ServicoSolicitacoesColeta solicitacoes) {
        this.ecopontos = ecopontos;
        this.solicitacoes = solicitacoes;
    }

    /** Público (mapa): ecopontos ordenados por distância quando lat/lon são informados. */
    @GetMapping("/api/collection-points")
    public List<CollectionPointDto> ecopontos(@RequestParam(required = false) Double lat,
                                           @RequestParam(required = false) Double lon,
                                           @RequestParam(required = false) Double radiusKm,
                                           @RequestParam(required = false) CodigoCategoria category,
                                           @RequestParam(defaultValue = "false") boolean all,
                                           @AuthenticationPrincipal UsuarioAutenticado logado) {
        return ecopontos.buscar(lat, lon, radiusKm, category, all && logado != null && logado.isAdmin());
    }

    @PostMapping("/api/collection-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionRequestDto criar(@AuthenticationPrincipal UsuarioAutenticado logado, @Valid @RequestBody CreateCollectionRequest corpo) {
        return solicitacoes.criar(logado, corpo);
    }

    @GetMapping("/api/collection-requests")
    public List<CollectionRequestDto> minhas(@AuthenticationPrincipal UsuarioAutenticado logado) {
        return solicitacoes.listarMinhas(logado);
    }

    @PostMapping("/api/collection-requests/{id}/cancel")
    public CollectionRequestDto cancelar(@AuthenticationPrincipal UsuarioAutenticado logado, @PathVariable UUID id) {
        return solicitacoes.cancelar(logado, id);
    }
}
