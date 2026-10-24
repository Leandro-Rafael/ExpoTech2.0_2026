package br.com.ecotechzero.lixozero.gamification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChallengeCompletionRepository extends JpaRepository<ChallengeCompletion, UUID> {

    List<ChallengeCompletion> findByUserId(UUID userId);

    boolean existsByUserIdAndChallengeId(UUID userId, UUID challengeId);
}
