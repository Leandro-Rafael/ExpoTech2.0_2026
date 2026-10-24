package br.com.ecotechzero.lixozero.reward;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Resgate de uma recompensa, com código de voucher único. */
@Entity
@Table(name = "redemptions")
public class Redemption extends BaseEntity {

    public enum Status { ISSUED, USED, CANCELLED }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reward_id", nullable = false)
    private Reward reward;

    @Column(nullable = false)
    private int cost;

    @Column(nullable = false, length = 20, unique = true)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ISSUED;

    protected Redemption() {
    }

    public Redemption(User user, Reward reward, int cost, String code) {
        this.user = user;
        this.reward = reward;
        this.cost = cost;
        this.code = code;
    }

    public User getUser() { return user; }
    public Reward getReward() { return reward; }
    public int getCost() { return cost; }
    public String getCode() { return code; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
}
