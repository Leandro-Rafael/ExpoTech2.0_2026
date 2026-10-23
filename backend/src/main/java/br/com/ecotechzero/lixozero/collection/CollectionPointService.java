package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionPointDto;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionPointInput;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.common.Numbers;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Ecopontos: busca por distância (Haversine) e material aceito; CRUD administrativo. */
@Service
public class CollectionPointService {

    private final CollectionPointRepository repository;
    private final AuditService audit;

    public CollectionPointService(CollectionPointRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<CollectionPointDto> search(Double lat, Double lon, Double radiusKm, CategoryCode category, boolean includeInactive) {
        if ((lat == null) != (lon == null)) {
            throw ApiException.field(lat == null ? "lat" : "lon", "informe latitude e longitude juntas");
        }
        if (lat != null && (lat < -90 || lat > 90 || Double.isNaN(lat))) {
            throw ApiException.field("lat", "latitude inválida");
        }
        if (lon != null && (lon < -180 || lon > 180 || Double.isNaN(lon))) {
            throw ApiException.field("lon", "longitude inválida");
        }
        if (radiusKm != null && (radiusKm <= 0 || radiusKm > 200 || Double.isNaN(radiusKm))) {
            throw ApiException.field("radiusKm", "o raio deve estar entre 0 e 200 km");
        }
        if (radiusKm != null && lat == null) {
            throw ApiException.field("radiusKm", "informe lat e lon para filtrar por raio");
        }
        List<CollectionPoint> points = includeInactive ? repository.findAllByOrderByName() : repository.findByActiveTrue();
        var stream = points.stream()
                .filter(p -> category == null || p.accepts(category))
                .map(p -> toDto(p, lat == null ? null : GeoPoint.haversineKm(lat, lon, p.getLatitude(), p.getLongitude())))
                .filter(dto -> radiusKm == null || dto.distanceKm() <= radiusKm);
        Comparator<CollectionPointDto> order = lat != null
                ? Comparator.comparingDouble(CollectionPointDto::distanceKm)
                : Comparator.comparing(CollectionPointDto::name);
        return stream.sorted(order).toList();
    }

    @Transactional(readOnly = true)
    public CollectionPoint requireActive(UUID id, String field) {
        return repository.findById(id).filter(CollectionPoint::isActive)
                .orElseThrow(() -> ApiException.field(field, "ecoponto não encontrado ou inativo"));
    }

    @Transactional
    public CollectionPointDto create(CollectionPointInput input) {
        CollectionPoint point = new CollectionPoint(input.name());
        point.apply(input);
        repository.save(point);
        audit.record(AuditAction.COLLECTION_POINT_CREATED, "CollectionPoint", point.getId(), point.getName());
        return toDto(point, null);
    }

    @Transactional
    public CollectionPointDto update(UUID id, CollectionPointInput input) {
        CollectionPoint point = repository.findById(id).orElseThrow(() -> ApiException.notFound("Ecoponto não encontrado."));
        point.apply(input);
        audit.record(AuditAction.COLLECTION_POINT_UPDATED, "CollectionPoint", id, point.getName());
        return toDto(point, null);
    }

    @Transactional
    public void delete(UUID id) {
        CollectionPoint point = repository.findById(id).orElseThrow(() -> ApiException.notFound("Ecoponto não encontrado."));
        repository.delete(point);
        audit.record(AuditAction.COLLECTION_POINT_DELETED, "CollectionPoint", id, point.getName());
    }

    static CollectionPointDto toDto(CollectionPoint p, Double distanceKm) {
        List<CategoryCode> categories = p.getCategories().stream().sorted().toList();
        return new CollectionPointDto(p.getId(), p.getName(), p.getAddress(), p.getNeighborhood(), p.getLatitude(),
                p.getLongitude(), p.getOpeningHours(), categories, p.isActive(),
                distanceKm == null ? null : Numbers.round(distanceKm, 2));
    }
}
