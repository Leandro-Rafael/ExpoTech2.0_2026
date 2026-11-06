package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.household.HouseholdDtos.CreateBinRequest;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.CreateHouseholdRequest;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.HouseholdDto;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.JoinHouseholdRequest;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.SmartBinCreated;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.SmartBinDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
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
public class HouseholdController {

    private final HouseholdService residencias;
    private final SmartBinService lixeiras;

    public HouseholdController(HouseholdService residencias, SmartBinService lixeiras) {
        this.residencias = residencias;
        this.lixeiras = lixeiras;
    }

    /** 200 com a residência, ou 204 se o usuário ainda não tem residência. */
    @GetMapping
    public ResponseEntity<HouseholdDto> minha(@AuthenticationPrincipal AuthUser logado) {
        return residencias.buscarMinha(logado).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HouseholdDto criar(@AuthenticationPrincipal AuthUser logado, @Valid @RequestBody CreateHouseholdRequest corpo) {
        return residencias.criar(logado, corpo);
    }

    @PostMapping("/join")
    public HouseholdDto entrar(@AuthenticationPrincipal AuthUser logado, @Valid @RequestBody JoinHouseholdRequest corpo) {
        return residencias.entrar(logado, corpo.inviteCode());
    }

    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sair(@AuthenticationPrincipal AuthUser logado) {
        residencias.sair(logado);
    }

    @GetMapping("/bins")
    public List<SmartBinDto> lixeiras(@AuthenticationPrincipal AuthUser logado) {
        return lixeiras.listarMinhas(logado);
    }

    @PostMapping("/bins")
    @ResponseStatus(HttpStatus.CREATED)
    public SmartBinCreated criarLixeira(@AuthenticationPrincipal AuthUser logado, @Valid @RequestBody CreateBinRequest corpo) {
        return lixeiras.criar(logado, corpo);
    }

    @DeleteMapping("/bins/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerLixeira(@AuthenticationPrincipal AuthUser logado, @PathVariable UUID id) {
        lixeiras.remover(logado, id);
    }
}
