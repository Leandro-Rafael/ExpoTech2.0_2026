package br.com.ecotechzero.lixozero.household;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HouseholdRepository extends JpaRepository<Household, UUID> {

    Optional<Household> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
