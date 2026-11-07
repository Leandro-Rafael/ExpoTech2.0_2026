package br.com.ecotechzero.lixozero.impact;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RepositorioMetas extends JpaRepository<Goal, UUID> {

    List<Goal> findAllByOrderByYearAscTitleAsc();
}
