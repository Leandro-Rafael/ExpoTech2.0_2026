package br.com.ecotechzero.lixozero.household;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SmartBinRepository extends JpaRepository<SmartBin, UUID> {

    @EntityGraph(attributePaths = "category")
    List<SmartBin> findByHouseholdIdOrderByName(UUID householdId);

    @EntityGraph(attributePaths = {"category", "household"})
    List<SmartBin> findAllByOrderByName();

    Optional<SmartBin> findByDeviceId(UUID deviceId);

    long countByHouseholdId(UUID householdId);

    @Query("select b.id from SmartBin b where b.simulated = true")
    List<UUID> findSimulatedIds();

    /** Trava a lixeira: leituras simultâneas (dispositivo + simulador) são processadas em série. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from SmartBin b where b.id = :id")
    Optional<SmartBin> findByIdForUpdate(@Param("id") UUID id);
}
