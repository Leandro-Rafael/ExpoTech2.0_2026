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

    private final CategoryService categories;
    private final CollectionPointService points;
    private final RewardService rewards;
    private final GamificationService challenges;
    private final OrganizationService organizations;
    private final ImpactService goals;

    public AdminCatalogController(CategoryService categories, CollectionPointService points, RewardService rewards,
                                  GamificationService challenges, OrganizationService organizations, ImpactService goals) {
        this.categories = categories;
        this.points = points;
        this.rewards = rewards;
        this.challenges = challenges;
        this.organizations = organizations;
        this.goals = goals;
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryDto createCategory(@Valid @RequestBody CategoryInput body) {
        return categories.create(body);
    }

    @PutMapping("/categories/{id}")
    public CategoryDto updateCategory(@PathVariable UUID id, @Valid @RequestBody CategoryInput body) {
        return categories.update(id, body);
    }

    @PostMapping("/collection-points")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionPointDto createPoint(@Valid @RequestBody CollectionPointInput body) {
        return points.create(body);
    }

    @PutMapping("/collection-points/{id}")
    public CollectionPointDto updatePoint(@PathVariable UUID id, @Valid @RequestBody CollectionPointInput body) {
        return points.update(id, body);
    }

    @DeleteMapping("/collection-points/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePoint(@PathVariable UUID id) {
        points.delete(id);
    }

    @GetMapping("/rewards")
    public List<RewardDto> listRewards() {
        return rewards.listAll();
    }

    @PostMapping("/rewards")
    @ResponseStatus(HttpStatus.CREATED)
    public RewardDto createReward(@Valid @RequestBody RewardInput body) {
        return rewards.create(body);
    }

    @PutMapping("/rewards/{id}")
    public RewardDto updateReward(@PathVariable UUID id, @Valid @RequestBody RewardInput body) {
        return rewards.update(id, body);
    }

    @GetMapping("/challenges")
    public List<ChallengeDto> listChallenges() {
        return challenges.listChallenges();
    }

    @PostMapping("/challenges")
    @ResponseStatus(HttpStatus.CREATED)
    public ChallengeDto createChallenge(@Valid @RequestBody ChallengeInput body) {
        return challenges.createChallenge(body);
    }

    @PutMapping("/challenges/{id}")
    public ChallengeDto updateChallenge(@PathVariable UUID id, @Valid @RequestBody ChallengeInput body) {
        return challenges.updateChallenge(id, body);
    }

    @GetMapping("/organizations")
    public List<OrganizationDto> listOrganizations() {
        return organizations.list();
    }

    @PostMapping("/organizations")
    @ResponseStatus(HttpStatus.CREATED)
    public OrganizationDto createOrganization(@Valid @RequestBody OrganizationDto.Input body) {
        return organizations.create(body);
    }

    @GetMapping("/goals")
    public List<GoalDto> listGoals() {
        return goals.goalDtos();
    }

    @PostMapping("/goals")
    @ResponseStatus(HttpStatus.CREATED)
    public GoalDto createGoal(@Valid @RequestBody GoalInput body) {
        return goals.createGoal(body);
    }

    @PutMapping("/goals/{id}")
    public GoalDto updateGoal(@PathVariable UUID id, @Valid @RequestBody GoalInput body) {
        return goals.updateGoal(id, body);
    }
}
