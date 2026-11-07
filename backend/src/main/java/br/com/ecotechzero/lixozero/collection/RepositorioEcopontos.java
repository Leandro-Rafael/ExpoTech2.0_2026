package br.com.ecotechzero.lixozero.collection;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RepositorioEcopontos extends JpaRepository<CollectionPoint, UUID> {

    @EntityGraph(attributePaths = "categories")
    List<CollectionPoint> findByActiveTrue();

    @EntityGraph(attributePaths = "categories")
    List<CollectionPoint> findAllByOrderByName();
}
