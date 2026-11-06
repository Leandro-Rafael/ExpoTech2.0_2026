package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryDto;
import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryInput;
import br.com.ecotechzero.lixozero.category.CategoryService;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionPointDto;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionPointInput;
import br.com.ecotechzero.lixozero.collection.CollectionPointService;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.ChallengeDto;
import br.com.ecotechzero.lixozero.gamification.GamificationDtos.ChallengeInput;
import br.com.ecotechzero.lixozero.gamification.GamificationService;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.GoalDto;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.GoalInput;
import br.com.ecotechzero.lixozero.impact.ImpactService;
import br.com.ecotechzero.lixozero.organization.OrganizationDto;
import br.com.ecotechzero.lixozero.organization.OrganizationService;
import br.com.ecotechzero.lixozero.reward.RewardDtos.RewardDto;
import br.com.ecotechzero.lixozero.reward.RewardDtos.RewardInput;
import br.com.ecotechzero.lixozero.reward.RewardService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Cadastros administrativos: categorias, ecopontos, recompensas, desafios, organizações e metas. */
@RestController
@RequestMapping("/api/admin")
public class AdminCatalogController {

    private final CategoryService categorias;
    private final CollectionPointService ecopontos;
    private final RewardService recompensas;
    private final GamificationService desafios;
    private final OrganizationService organizacoes;
    private final ImpactService metas;

    public AdminCatalogController(CategoryService categorias, CollectionPointService ecopontos, RewardService recompensas,
                                  GamificationService desafios, OrganizationService organizacoes, ImpactService metas) {
        this.categorias = categorias;
        this.ecopontos = ecopontos;
        this.recompensas = recompensas;
        this.desafios = desafios;
        this.organizacoes = organizacoes;
        this.metas = metas;
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryDto criarCategoria(@Valid @RequestBody CategoryInput corpo) {
        return categorias.criar(corpo);
    }

    @PutMapping("/categories/{id}")
    public CategoryDto atualizarCategoria(@PathVariable UUID id, @Valid @RequestBody CategoryInput corpo) {
        return categorias.atualizar(id, corpo);
    }

    @PostMapping("/collection-points")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionPointDto criarEcoponto(@Valid @RequestBody CollectionPointInput corpo) {
        return ecopontos.criar(corpo);
    }

    @PutMapping("/collection-points/{id}")
    public CollectionPointDto atualizarEcoponto(@PathVariable UUID id, @Valid @RequestBody CollectionPointInput corpo) {
        return ecopontos.atualizar(id, corpo);
    }

    @DeleteMapping("/collection-points/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerEcoponto(@PathVariable UUID id) {
        ecopontos.remover(id);
    }

    @GetMapping("/rewards")
    public List<RewardDto> listarRecompensas() {
        return recompensas.listarTodas();
    }

    @PostMapping("/rewards")
    @ResponseStatus(HttpStatus.CREATED)
    public RewardDto criarRecompensa(@Valid @RequestBody RewardInput corpo) {
        return recompensas.criar(corpo);
    }

    @PutMapping("/rewards/{id}")
    public RewardDto atualizarRecompensa(@PathVariable UUID id, @Valid @RequestBody RewardInput corpo) {
        return recompensas.atualizar(id, corpo);
    }

    @GetMapping("/challenges")
    public List<ChallengeDto> listarDesafios() {
        return desafios.listarDesafios();
    }

    @PostMapping("/challenges")
    @ResponseStatus(HttpStatus.CREATED)
    public ChallengeDto criarDesafio(@Valid @RequestBody ChallengeInput corpo) {
        return desafios.criarDesafio(corpo);
    }

    @PutMapping("/challenges/{id}")
    public ChallengeDto atualizarDesafio(@PathVariable UUID id, @Valid @RequestBody ChallengeInput corpo) {
        return desafios.atualizarDesafio(id, corpo);
    }

    @GetMapping("/organizations")
    public List<OrganizationDto> listarOrganizacoes() {
        return organizacoes.listar();
    }

    @PostMapping("/organizations")
    @ResponseStatus(HttpStatus.CREATED)
    public OrganizationDto criarOrganizacao(@Valid @RequestBody OrganizationDto.Input corpo) {
        return organizacoes.criar(corpo);
    }

    @GetMapping("/goals")
    public List<GoalDto> listarMetas() {
        return metas.metasDto();
    }

    @PostMapping("/goals")
    @ResponseStatus(HttpStatus.CREATED)
    public GoalDto criarMeta(@Valid @RequestBody GoalInput corpo) {
        return metas.criarMeta(corpo);
    }

    @PutMapping("/goals/{id}")
    public GoalDto atualizarMeta(@PathVariable UUID id, @Valid @RequestBody GoalInput corpo) {
        return metas.atualizarMeta(id, corpo);
    }
}
