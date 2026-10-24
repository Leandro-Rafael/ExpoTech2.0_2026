package br.com.ecotechzero.lixozero.reward;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.points.PointsService;
import br.com.ecotechzero.lixozero.reward.RewardDtos.RedemptionDto;
import br.com.ecotechzero.lixozero.reward.RewardDtos.RewardDto;
import br.com.ecotechzero.lixozero.reward.RewardDtos.RewardInput;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.List;
import java.util.UUID;

/**
 * Catálogo e resgate de recompensas.
 * O resgate verifica SALDO e ESTOQUE de forma atômica: trava a linha do usuário e depois a da recompensa
 * (sempre nessa ordem, evitando deadlock), confere, debita e grava o voucher na mesma transação.
 */
@Service
public class RewardService {

    private static final String VOUCHER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RewardRepository rewards;
    private final RedemptionRepository redemptions;
    private final PointsService points;
    private final EntityManager em;
    private final AuditService audit;
    private final TokenBucketRateLimiter limiter;
    private final Clock clock;

    public RewardService(RewardRepository rewards, RedemptionRepository redemptions, PointsService points, EntityManager em,
                         AuditService audit, TokenBucketRateLimiter limiter, Clock clock) {
        this.rewards = rewards;
        this.redemptions = redemptions;
        this.points = points;
        this.em = em;
        this.audit = audit;
        this.limiter = limiter;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RewardDto> listActive() {
        return rewards.findByActiveTrueOrderByCostPoints().stream().map(RewardDto::of).toList();
    }

    @Transactional(readOnly = true)
    public List<RewardDto> listAll() {
        return rewards.findAllByOrderByCostPoints().stream().map(RewardDto::of).toList();
    }

    @Transactional
    public RedemptionDto redeem(UUID userId, UUID rewardId) {
        limiter.check(TokenBucketRateLimiter.Policy.REDEEM_USER, userId.toString());
        User user = points.lockUser(userId); // 1º lock: usuário
        Reward reward = em.find(Reward.class, rewardId);
        if (reward == null) {
            throw ApiException.notFound("Recompensa não encontrada.");
        }
        em.refresh(reward, LockModeType.PESSIMISTIC_WRITE); // 2º lock: recompensa
        if (!reward.isActive()) {
            throw ApiException.notFound("Recompensa não encontrada.");
        }
        if (reward.getStock() <= 0) {
            throw new ApiException(ErrorCode.OUT_OF_STOCK, "Esta recompensa está esgotada.");
        }
        if (user.getPoints() < reward.getCostPoints()) {
            throw new ApiException(ErrorCode.INSUFFICIENT_POINTS,
                    "Saldo insuficiente: você tem " + user.getPoints() + " pontos e a recompensa custa " + reward.getCostPoints() + ".");
        }
        reward.decrementStock();
        Redemption redemption = redemptions.save(new Redemption(user, reward, reward.getCostPoints(), newVoucherCode()));
        points.debit(userId, reward.getCostPoints(), "Resgate: " + reward.getName(), redemption, clock.instant());
        audit.record(AuditAction.REWARD_REDEEMED, "Redemption", redemption.getId(), reward.getName() + " (" + reward.getCostPoints() + " pts)");
        return RedemptionDto.of(redemption);
    }

    @Transactional(readOnly = true)
    public List<RedemptionDto> history(UUID userId) {
        return redemptions.findByUserIdOrderByCreatedAtDesc(userId).stream().map(RedemptionDto::of).toList();
    }

    @Transactional
    public RewardDto create(RewardInput input) {
        Reward reward = new Reward(input.name());
        reward.apply(input);
        rewards.save(reward);
        audit.record(AuditAction.REWARD_CREATED, "Reward", reward.getId(), reward.getName());
        return RewardDto.of(reward);
    }

    @Transactional
    public RewardDto update(UUID id, RewardInput input) {
        Reward reward = rewards.findById(id).orElseThrow(() -> ApiException.notFound("Recompensa não encontrada."));
        reward.apply(input);
        audit.record(AuditAction.REWARD_UPDATED, "Reward", id, reward.getName());
        return RewardDto.of(reward);
    }

    /** Voucher no formato LZ50-XXXX-XXXX gerado com SecureRandom (imprevisível). */
    String newVoucherCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("LZ50-");
            for (int i = 0; i < 8; i++) {
                if (i == 4) sb.append('-');
                sb.append(VOUCHER_ALPHABET.charAt(RANDOM.nextInt(VOUCHER_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!redemptions.existsByCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Não foi possível gerar um voucher único");
    }
}
