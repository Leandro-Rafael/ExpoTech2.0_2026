package br.com.ecotechzero.lixozero.points;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.disposal.Disposal;
import br.com.ecotechzero.lixozero.gamification.Challenge;
import br.com.ecotechzero.lixozero.reward.Redemption;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Lançamento no extrato de pontos (livro-razão imutável). Guarda o saldo após o lançamento,
 * permitindo auditar a evolução do saldo. Um índice único no banco garante no máximo um
 * lançamento EARN por descarte.
 */
@Entity
@Table(name = "point_transactions")
public class PointTransaction extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PointTransactionType type;

    @Column(nullable = false)
    private int amount;

    @Column(name = "balance_after", nullable = false)
    private long balanceAfter;

    @Column(nullable = false, length = 200)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "disposal_id")
    private Disposal disposal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challenge_id")
    private Challenge challenge;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "redemption_id")
    private Redemption redemption;

    protected PointTransaction() {
    }

    public PointTransaction(User user, PointTransactionType type, int amount, long balanceAfter, String description) {
        this.user = user;
        this.type = type;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.description = description;
    }

    public void link(Disposal disposal, Challenge challenge, Redemption redemption) {
        this.disposal = disposal;
        this.challenge = challenge;
        this.redemption = redemption;
    }

    public User getUser() { return user; }
    public PointTransactionType getType() { return type; }
    public int getAmount() { return amount; }
    public long getBalanceAfter() { return balanceAfter; }
    public String getDescription() { return description; }
}
