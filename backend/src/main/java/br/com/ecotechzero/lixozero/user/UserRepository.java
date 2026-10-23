package br.com.ecotechzero.lixozero.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRole(Role role);

    List<User> findByRoleAndEnabledTrueOrderByName(Role role);

    List<User> findByHouseholdIdOrderByCreatedAt(UUID householdId);

    long countByHouseholdId(UUID householdId);

    @Query("""
            select u from User u
            where (:role is null or u.role = :role)
              and (:q is null or lower(u.name) like :q or lower(u.email) like :q)
            """)
    Page<User> search(@Param("q") String likePattern, @Param("role") Role role, Pageable pageable);

    @Modifying
    @Query("update User u set u.failedLoginAttempts = :attempts, u.lockedUntil = :lockedUntil where u.id = :id")
    void updateLoginFailures(@Param("id") UUID id, @Param("attempts") int attempts, @Param("lockedUntil") Instant lockedUntil);

    @Modifying
    @Query("update User u set u.failedLoginAttempts = 0, u.lockedUntil = null, u.lastLoginAt = :now where u.id = :id")
    void registerSuccessfulLogin(@Param("id") UUID id, @Param("now") Instant now);

    @Query("select count(distinct d.user.id) from Disposal d where d.createdAt >= :since")
    long countActiveSince(@Param("since") Instant since);
}
