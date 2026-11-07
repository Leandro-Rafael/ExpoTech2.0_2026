package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.household.DtosResidencia.CreateBinRequest;
import br.com.ecotechzero.lixozero.household.DtosResidencia.CreateHouseholdRequest;
import br.com.ecotechzero.lixozero.household.DtosResidencia.HouseholdDto;
import br.com.ecotechzero.lixozero.household.DtosResidencia.JoinHouseholdRequest;
import br.com.ecotechzero.lixozero.household.DtosResidencia.SmartBinCreated;
import br.com.ecotechzero.lixozero.household.DtosResidencia.SmartBinDto;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Endpoints da residência: criar, entrar por convite, sair e gerenciar as lixeiras inteligentes. */
@RestController
@RequestMapping("/api/household")
public class ControladorResidencia {

    private final ServicoResidencia residencias;
    private final ServicoLixeiras lixeiras;

    public ControladorResidencia(ServicoResidencia residencias, ServicoLixeiras lixeiras) {
        this.residencias = residencias;
        this.lixeiras = lixeiras;
    }

    /** 200 com a residência, ou 204 se o usuário ainda não tem residência. */
    @GetMapping
    public ResponseEntity<HouseholdDto> minha(@AuthenticationPrincipal UsuarioAutenticado logado) {
        return residencias.buscarMinha(logado).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HouseholdDto criar(@AuthenticationPrincipal UsuarioAutenticado logado, @Valid @RequestBody CreateHouseholdRequest corpo) {
        return residencias.criar(logado, corpo);
    }

    @PostMapping("/join")
    public HouseholdDto entrar(@AuthenticationPrincipal UsuarioAutenticado logado, @Valid @RequestBody JoinHouseholdRequest corpo) {
        return residencias.entrar(logado, corpo.inviteCode());
    }

    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sair(@AuthenticationPrincipal UsuarioAutenticado logado) {
        residencias.sair(logado);
    }

    @GetMapping("/bins")
    public List<SmartBinDto> lixeiras(@AuthenticationPrincipal UsuarioAutenticado logado) {
        return lixeiras.listarMinhas(logado);
    }

    @PostMapping("/bins")
    @ResponseStatus(HttpStatus.CREATED)
    public SmartBinCreated criarLixeira(@AuthenticationPrincipal UsuarioAutenticado logado, @Valid @RequestBody CreateBinRequest corpo) {
        return lixeiras.criar(logado, corpo);
    }

    @DeleteMapping("/bins/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerLixeira(@AuthenticationPrincipal UsuarioAutenticado logado, @PathVariable UUID id) {
        lixeiras.remover(logado, id);
    }
}
