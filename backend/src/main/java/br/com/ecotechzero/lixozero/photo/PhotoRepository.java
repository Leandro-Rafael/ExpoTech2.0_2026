package br.com.ecotechzero.lixozero.photo;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {

    /** Hashes recentes (projeção sem os bytes) para detectar fotos parecidas. */
    @Query("""
            select new br.com.ecotechzero.lixozero.photo.PhotoHash(p.id, p.dhash, p.owner.id)
            from Photo p where p.createdAt >= :since and p.id <> :excludeId
            order by p.createdAt desc
            """)
    List<PhotoHash> recentHashes(@Param("since") Instant since, @Param("excludeId") UUID excludeId, Pageable limit);

    @Query("""
            select new br.com.ecotechzero.lixozero.photo.PhotoMeta(p.id, p.owner.id, p.dhash, p.sha256, p.aiCode, p.aiConfidence, p.aiSource,
                                                          p.createdAt)
            from Photo p where p.id = :id
            """)
    Optional<PhotoMeta> findMeta(@Param("id") UUID id);

    @Query("select count(p) > 0 from Photo p where p.sha256 = :sha and p.id <> :excludeId")
    boolean existsSameContent(@Param("sha") String sha256, @Param("excludeId") UUID excludeId);
}
