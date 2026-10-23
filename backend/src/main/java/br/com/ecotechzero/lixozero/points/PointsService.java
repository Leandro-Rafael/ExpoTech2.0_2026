package br.com.ecotechzero.lixozero.points;

import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.common.Pagination;
import br.com.ecotechzero.lixozero.disposal.Disposal;
import br.com.ecotechzero.lixozero.gamification.Challenge;
import br.com.ecotechzero.lixozero.reward.Redemption;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Único ponto do sistema que altera saldos de pontos.
 * <p>
 * Toda operação trava a linha do usuário (SELECT ... FOR UPDATE) antes de ler o saldo. Assim, duas
 * operações simultâneas (ex.: dois resgates em abas diferentes) são executadas uma após a outra e
 * o saldo nunca fica inconsistente nem negativo (há também um CHECK points >= 0 no banco).
 */
@Service
public class PointsService {

    private final EntityManager em;
    private final PointTransactionRepository transactions;

    public PointsService(EntityManager em, PointTransactionRepository transactions) {
        this.em = em;
        this.transactions = transactions;
    }

    public record PointTransactionDto(UUID id, PointTransactionType type, int amount, long balanceAfter,
                                      String description, Instant createdAt) {
        static PointTransactionDto of(PointTransaction t) {
            return new PointTransactionDto(t.getId(), t.getType(), t.getAmount(), t.getBalanceAfter(), t.getDescription(), t.getCreatedAt());
        }
    }

    /** Trava o usuário para atualização e recarrega o estado mais recente do banco. */
    @Transactional(propagation = Propagation.MANDATORY)
    public User lockUser(UUID userId) {
        User user = em.find(User.class, userId);
        if (user == null) {
            throw ApiException.notFound("Usuário não encontrado.");
        }
        em.refresh(user, LockModeType.PESSIMISTIC_WRITE);
        return user;
    }

    /** Credita pontos ganhos (EARN por descarte aprovado ou BONUS por desafio). */
    @Transactional(propagation = Propagation.MANDATORY)
    public PointTransaction credit(UUID userId, int amount, PointTransactionType type, String description,
                                   Disposal disposal, Challenge challenge, Instant at) {
        if (amount <= 0) {
            throw new IllegalArgumentException("amount deve ser positivo");
        }
        User user = lockUser(userId);
        user.earn(amount);
        PointTransaction tx = new PointTransaction(user, type, amount, user.getPoints(), description);
        tx.link(disposal, challenge, null);
        tx.setCreatedAt(at);
        return transactions.save(tx);
    }

    /** Debita pontos de um resgate. Verifica o saldo com a linha travada (sem condição de corrida). */
    @Transactional(propagation = Propagation.MANDATORY)
    public PointTransaction debit(UUID userId, int cost, String description, Redemption redemption, Instant at) {
        User user = lockUser(userId);
        if (user.getPoints() < cost) {
            throw new ApiException(ErrorCode.INSUFFICIENT_POINTS,
                    "Saldo insuficiente: você tem " + user.getPoints() + " pontos e a recompensa custa " + cost + ".");
        }
        user.spend(cost);
        PointTransaction tx = new PointTransaction(user, PointTransactionType.REDEEM, -cost, user.getPoints(), description);
        tx.link(null, null, redemption);
        tx.setCreatedAt(at);
        return transactions.save(tx);
    }

    @Transactional(readOnly = true)
    public PageResponse<PointTransactionDto> history(UUID userId, Integer page, Integer size) {
        var pageable = Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "balanceAfter")));
        return PageResponse.of(transactions.findByUserId(userId, pageable), PointTransactionDto::of);
    }
}
