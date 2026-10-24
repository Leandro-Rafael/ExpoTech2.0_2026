package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DisposalRepository extends JpaRepository<Disposal, UUID> {

    @EntityGraph(attributePaths = {"category", "collectionPoint"})
    Page<Disposal> findByUserId(UUID userId, Pageable pageable);

    @EntityGraph(attributePaths = {"category", "collectionPoint"})
    Page<Disposal> findByUserIdAndStatus(UUID userId, DisposalStatus status, Pageable pageable);

    Optional<Disposal> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);

    boolean existsByPhotoId(UUID photoId);

    long countByStatus(DisposalStatus status);

    long countByStatusAndFlaggedTrue(DisposalStatus status);

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant since);

    /** Fila de moderação do admin, com filtros opcionais. */
    @EntityGraph(attributePaths = {"category", "collectionPoint", "user"})
    @Query("""
            select d from Disposal d
            where (:status is null or d.status = :status)
              and (:flagged is null or d.flagged = :flagged)
            """)
    Page<Disposal> adminSearch(@Param("status") DisposalStatus status, @Param("flagged") Boolean flagged, Pageable pageable);

    /** Soma de kg não recusados do usuário em um intervalo (regra de limite diário). */
    @Query("""
            select coalesce(sum(d.quantityKg), 0) from Disposal d
            where d.user.id = :userId and d.status <> :rejected and d.disposedAt >= :from and d.disposedAt < :to
            """)
    double sumKgBetween(@Param("userId") UUID userId, @Param("rejected") DisposalStatus rejected,
                        @Param("from") Instant from, @Param("to") Instant to);

    /** Últimos descartes com localização (regra de deslocamento impossível). */
    @Query("""
            select d from Disposal d
            where d.user.id = :userId and d.latitude is not null and d.disposedAt >= :since
            order by d.disposedAt desc
            """)
    List<Disposal> recentWithLocation(@Param("userId") UUID userId, @Param("since") Instant since, Pageable limit);

    /** kg e quantidade de descartes aprovados do usuário, por categoria. */
    @Query("""
            select d.category.code, sum(d.quantityKg), count(d) from Disposal d
            where d.user.id = :userId and d.status = :status
            group by d.category.code
            """)
    List<Object[]> statsByCategory(@Param("userId") UUID userId, @Param("status") DisposalStatus status);

    /** Progresso em desafios: kg e quantidade aprovados no período (categoria opcional). */
    @Query("""
            select coalesce(sum(d.quantityKg), 0), count(d) from Disposal d
            where d.user.id = :userId and d.status = :status
              and d.disposedAt >= :from and d.disposedAt < :to
              and (:code is null or d.category.code = :code)
            """)
    List<Object[]> progressBetween(@Param("userId") UUID userId, @Param("status") DisposalStatus status,
                                   @Param("from") Instant from, @Param("to") Instant to, @Param("code") CategoryCode code);

    @EntityGraph(attributePaths = {"category", "user"})
    @Query("select d from Disposal d where d.disposedAt >= :from and d.disposedAt < :to order by d.disposedAt")
    List<Disposal> findForReport(@Param("from") Instant from, @Param("to") Instant to, Limit limit);
}
