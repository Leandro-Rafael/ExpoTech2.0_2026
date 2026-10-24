package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/** Medalha conquistada por um usuário. */
@Entity
@Table(name = "user_badges")
public class UserBadge extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "badge_code", nullable = false, length = 40)
    private String badgeCode;

    @Column(name = "awarded_at", nullable = false)
    private Instant awardedAt;

    protected UserBadge() {
    }

    public UserBadge(User user, String badgeCode, Instant awardedAt) {
        this.user = user;
        this.badgeCode = badgeCode;
        this.awardedAt = awardedAt;
    }

    public String getBadgeCode() { return badgeCode; }
    public Instant getAwardedAt() { return awardedAt; }
}
