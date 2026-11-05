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

    private final HouseholdService households;
    private final SmartBinService bins;

    public HouseholdController(HouseholdService households, SmartBinService bins) {
        this.households = households;
        this.bins = bins;
    }

    /** 200 com a residência, ou 204 se o usuário ainda não tem residência. */
    @GetMapping
    public ResponseEntity<HouseholdDto> mine(@AuthenticationPrincipal AuthUser me) {
        return households.getMine(me).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HouseholdDto create(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody CreateHouseholdRequest body) {
        return households.create(me, body);
    }

    @PostMapping("/join")
    public HouseholdDto join(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody JoinHouseholdRequest body) {
        return households.join(me, body.inviteCode());
    }

    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@AuthenticationPrincipal AuthUser me) {
        households.leave(me);
    }

    @GetMapping("/bins")
    public List<SmartBinDto> bins(@AuthenticationPrincipal AuthUser me) {
        return bins.listMine(me);
    }

    @PostMapping("/bins")
    @ResponseStatus(HttpStatus.CREATED)
    public SmartBinCreated createBin(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody CreateBinRequest body) {
        return bins.create(me, body);
    }

    @DeleteMapping("/bins/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBin(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        bins.delete(me, id);
    }
}
