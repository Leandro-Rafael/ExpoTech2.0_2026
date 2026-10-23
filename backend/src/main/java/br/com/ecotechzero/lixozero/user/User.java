package br.com.ecotechzero.lixozero.user;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.household.Household;
import br.com.ecotechzero.lixozero.organization.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;

/**
 * Usuário da plataforma. O saldo de pontos só é alterado pelo PointsService, sempre com lock
 * pessimista na linha (SELECT ... FOR UPDATE) para evitar condições de corrida.
 * {@code @DynamicUpdate}: o UPDATE inclui apenas colunas alteradas, evitando sobrescrever
 * o saldo com um valor antigo quando outra transação altera, por exemplo, o último login.
 */
@Entity
@Table(name = "users")
@DynamicUpdate
public class User extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 254, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.USER;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false)
    private long points;

    @Column(name = "total_earned", nullable = false)
    private long totalEarned;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "household_id")
    private Household household;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @Column(name = "failed_login_attempts", nullable = false)
    private int failedLoginAttempts;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    /** Incrementado ao trocar a senha: invalida imediatamente os access tokens emitidos antes. */
    @Column(name = "token_version", nullable = false)
    private int tokenVersion;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected User() {
    }

    public User(String name, String email, String passwordHash, Role role) {
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }

    /** Credita pontos ganhos (aprovação ou bônus): aumenta saldo e total acumulado (que define o nível). */
    public void earn(long amount) {
        this.points += amount;
        this.totalEarned += amount;
    }

    /** Debita pontos (resgate). A verificação de saldo é feita antes pelo serviço. */
    public void spend(long amount) {
        this.points -= amount;
    }

    public void incrementTokenVersion() {
        this.tokenVersion++;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public long getPoints() { return points; }
    public void setPoints(long points) { this.points = points; }
    public long getTotalEarned() { return totalEarned; }
    public void setTotalEarned(long totalEarned) { this.totalEarned = totalEarned; }
    public Household getHousehold() { return household; }
    public void setHousehold(Household household) { this.household = household; }
    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }
    public int getFailedLoginAttempts() { return failedLoginAttempts; }
    public void setFailedLoginAttempts(int failedLoginAttempts) { this.failedLoginAttempts = failedLoginAttempts; }
    public Instant getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(Instant lockedUntil) { this.lockedUntil = lockedUntil; }
    public int getTokenVersion() { return tokenVersion; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }
}
