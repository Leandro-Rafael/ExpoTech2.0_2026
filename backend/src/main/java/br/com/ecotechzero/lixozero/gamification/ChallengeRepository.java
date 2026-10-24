package br.com.ecotechzero.lixozero.gamification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ChallengeRepository extends JpaRepository<Challenge, UUID> {

    List<Challenge> findAllByOrderByStartsAtDesc();

    /** Desafios ativos que ainda não terminaram (exibidos no resumo). */
    List<Challenge> findByActiveTrueAndEndsAtGreaterThanEqualOrderByEndsAt(LocalDate since);
}
