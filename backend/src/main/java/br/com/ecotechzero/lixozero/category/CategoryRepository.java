package br.com.ecotechzero.lixozero.category;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findAllByOrderByName();

    List<Category> findByActiveTrueOrderByName();

    Optional<Category> findByCode(CategoryCode code);
}
