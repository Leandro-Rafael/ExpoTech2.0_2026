package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.collection.DtosColeta.CollectionRequestDto;
import br.com.ecotechzero.lixozero.collection.ServicoSolicitacoesColeta;
import br.com.ecotechzero.lixozero.collection.StatusSolicitacaoColeta;
import br.com.ecotechzero.lixozero.household.DtosResidencia.SmartBinDto;
import br.com.ecotechzero.lixozero.household.ServicoLixeiras;
import br.com.ecotechzero.lixozero.route.DtosRota.CreateRouteRequest;
import br.com.ecotechzero.lixozero.route.DtosRota.OptimizeRequest;
import br.com.ecotechzero.lixozero.route.DtosRota.RouteDto;
import br.com.ecotechzero.lixozero.route.DtosRota.RouteOptimizationDto;
import br.com.ecotechzero.lixozero.route.ServicoRotas;
import br.com.ecotechzero.lixozero.user.DtosUsuario.UserRef;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Operação de coletas: solicitações, coletores, otimização/criação de rotas e lixeiras. */
@RestController
@RequestMapping("/api/admin")
public class ControladorOperacoesAdmin {

    private final ServicoSolicitacoesColeta solicitacoes;
    private final ServicoAdmin servicoAdmin;
    private final ServicoRotas rotas;
    private final ServicoLixeiras lixeiras;

    public ControladorOperacoesAdmin(ServicoSolicitacoesColeta solicitacoes, ServicoAdmin servicoAdmin, ServicoRotas rotas, ServicoLixeiras lixeiras) {
        this.solicitacoes = solicitacoes;
        this.servicoAdmin = servicoAdmin;
        this.rotas = rotas;
        this.lixeiras = lixeiras;
    }

    @GetMapping("/collection-requests")
    public List<CollectionRequestDto> solicitacoesColeta(@RequestParam(required = false) StatusSolicitacaoColeta status) {
        return solicitacoes.listarTodas(status);
    }

    @GetMapping("/collectors")
    public List<UserRef> coletores() {
        return servicoAdmin.coletores();
    }

    @PostMapping("/routes/optimize")
    public RouteOptimizationDto otimizar(@Valid @RequestBody OptimizeRequest corpo) {
        return rotas.otimizar(corpo);
    }

    @PostMapping("/routes")
    @ResponseStatus(HttpStatus.CREATED)
    public List<RouteDto> criarRotas(@Valid @RequestBody CreateRouteRequest corpo) {
        return rotas.criar(corpo);
    }

    @GetMapping("/routes")
    public List<RouteDto> listarRotas() {
        return rotas.listarTodas();
    }

    @GetMapping("/bins")
    public List<SmartBinDto> lixeiras() {
        return lixeiras.listarTodas();
    }
}
