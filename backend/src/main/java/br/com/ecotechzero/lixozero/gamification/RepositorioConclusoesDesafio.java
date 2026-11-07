package br.com.ecotechzero.lixozero.gamification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RepositorioConclusoesDesafio extends JpaRepository<ChallengeCompletion, UUID> {

    List<ChallengeCompletion> findByUserId(UUID userId);
}
