package br.com.ecotechzero.lixozero.household;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface RepositorioResidencias extends JpaRepository<Household, UUID> {

    Optional<Household> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    /** Trava a residência: entradas e cadastros de lixeiras simultâneos respeitam os limites (12 moradores/lixeiras). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from Household h where h.id = :id")
    Optional<Household> findByIdForUpdate(@Param("id") UUID id);
}
