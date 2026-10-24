package br.com.ecotechzero.lixozero.reward;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RedemptionRepository extends JpaRepository<Redemption, UUID> {

    @EntityGraph(attributePaths = "reward")
    List<Redemption> findByUserIdOrderByCreatedAtDesc(UUID userId);

    boolean existsByCode(String code);
}
