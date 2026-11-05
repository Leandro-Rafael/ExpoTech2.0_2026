package br.com.ecotechzero.lixozero.points;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

/** Leitura do extrato de pontos (a gravação passa pelo LedgerChain). */
public interface PointTransactionRepository extends JpaRepository<PointTransaction, UUID> {

    Page<PointTransaction> findByUserId(UUID userId, Pageable pageable);

    @Query("""
            select coalesce(sum(t.amount), 0) from PointTransaction t
            where t.type in (br.com.ecotechzero.lixozero.points.PointTransactionType.EARN,
                             br.com.ecotechzero.lixozero.points.PointTransactionType.BONUS)
            """)
    long totalIssued();
}
