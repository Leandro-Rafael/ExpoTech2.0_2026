package br.com.ecotechzero.lixozero.organization;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    List<Organization> findAllByOrderByName();

    boolean existsByNameIgnoreCase(String name);
}
