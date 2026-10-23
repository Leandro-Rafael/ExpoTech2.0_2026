package br.com.ecotechzero.lixozero.collection;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CollectionRequestRepository extends JpaRepository<CollectionRequest, UUID> {

    List<CollectionRequest> findByRequesterIdOrderByCreatedAtDesc(UUID requesterId);

    long countByRequesterIdAndStatusIn(UUID requesterId, Collection<CollectionRequestStatus> statuses);

    List<CollectionRequest> findByStatusOrderByCreatedAt(CollectionRequestStatus status);

    List<CollectionRequest> findAllByOrderByCreatedAtDesc();

    long countByStatusIn(Collection<CollectionRequestStatus> statuses);

    boolean existsBySmartBinIdAndStatusIn(UUID smartBinId, Collection<CollectionRequestStatus> statuses);

    /** Trava as solicitações escolhidas para montar uma rota (evita que entrem em duas rotas). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CollectionRequest r where r.id in :ids order by r.createdAt")
    List<CollectionRequest> findAllForUpdate(@Param("ids") Collection<UUID> ids);

    @Query("select r from CollectionRequest r where r.id in :ids order by r.createdAt")
    List<CollectionRequest> findAllByIdOrdered(@Param("ids") Collection<UUID> ids);
}
