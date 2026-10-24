package br.com.ecotechzero.lixozero.reward;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RewardRepository extends JpaRepository<Reward, UUID> {

    List<Reward> findByActiveTrueOrderByCostPoints();

    List<Reward> findAllByOrderByCostPoints();
}
