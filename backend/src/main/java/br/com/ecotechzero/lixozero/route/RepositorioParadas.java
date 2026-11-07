package br.com.ecotechzero.lixozero.route;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RepositorioParadas extends JpaRepository<RouteStop, UUID> {

    Optional<RouteStop> findByRequestId(UUID requestId);
}
