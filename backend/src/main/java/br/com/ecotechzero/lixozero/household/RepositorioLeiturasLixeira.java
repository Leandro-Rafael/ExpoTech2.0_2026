package br.com.ecotechzero.lixozero.household;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RepositorioLeiturasLixeira extends JpaRepository<BinReading, UUID> {

    List<BinReading> findTop24ByBinIdOrderByRecordedAtDesc(UUID binId);
}
