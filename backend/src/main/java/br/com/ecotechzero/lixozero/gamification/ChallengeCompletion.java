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

/** Registro de que um usuário concluiu um desafio (único por usuário + desafio). */
@Entity
@Table(name = "challenge_completions")
public class ChallengeCompletion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    protected ChallengeCompletion() {
    }

    public ChallengeCompletion(User user, Challenge challenge, Instant completedAt) {
        this.user = user;
        this.challenge = challenge;
        this.completedAt = completedAt;
    }

    public Challenge getChallenge() { return challenge; }
}
