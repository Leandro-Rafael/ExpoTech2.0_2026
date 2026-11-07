package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.collection.DtosColeta.CollectionPointDto;
import br.com.ecotechzero.lixozero.collection.DtosColeta.CollectionPointInput;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.PontoGeografico;
import br.com.ecotechzero.lixozero.common.Numeros;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Ecopontos: busca por distância (Haversine) e material aceito; CRUD administrativo. */
@Service
public class ServicoEcopontos {

    private final RepositorioEcopontos repositorio;
    private final ServicoAuditoria auditoria;

    public ServicoEcopontos(RepositorioEcopontos repositorio, ServicoAuditoria auditoria) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<CollectionPointDto> buscar(Double lat, Double lon, Double raioKm, CodigoCategoria categoria, boolean incluirInativos) {
        if ((lat == null) != (lon == null)) {
            throw ExcecaoApi.campo(lat == null ? "lat" : "lon", "informe latitude e longitude juntas");
        }
        if (lat != null && (lat < -90 || lat > 90 || Double.isNaN(lat))) {
            throw ExcecaoApi.campo("lat", "latitude inválida");
        }
        if (lon != null && (lon < -180 || lon > 180 || Double.isNaN(lon))) {
            throw ExcecaoApi.campo("lon", "longitude inválida");
        }
        if (raioKm != null && (raioKm <= 0 || raioKm > 200 || Double.isNaN(raioKm))) {
            throw ExcecaoApi.campo("radiusKm", "o raio deve estar entre 0 e 200 km");
        }
        if (raioKm != null && lat == null) {
            throw ExcecaoApi.campo("radiusKm", "informe lat e lon para filtrar por raio");
        }
        List<CollectionPoint> ecopontos = incluirInativos ? repositorio.findAllByOrderByName() : repositorio.findByActiveTrue();
        var fluxo = ecopontos.stream()
                .filter(p -> categoria == null || p.accepts(categoria))
                .map(p -> paraDto(p, lat == null ? null : PontoGeografico.haversineKm(lat, lon, p.getLatitude(), p.getLongitude())))
                .filter(dto -> raioKm == null || dto.distanceKm() <= raioKm);
        Comparator<CollectionPointDto> ordem = lat != null
                ? Comparator.comparingDouble(CollectionPointDto::distanceKm)
                : Comparator.comparing(CollectionPointDto::name);
        return fluxo.sorted(ordem).toList();
    }

    @Transactional(readOnly = true)
    public CollectionPoint exigirAtivo(UUID id, String campo) {
        return repositorio.findById(id).filter(CollectionPoint::isActive)
                .orElseThrow(() -> ExcecaoApi.campo(campo, "ecoponto não encontrado ou inativo"));
    }

    @Transactional
    public CollectionPointDto criar(CollectionPointInput entrada) {
        CollectionPoint ecoponto = new CollectionPoint(entrada.name());
        ecoponto.apply(entrada);
        repositorio.save(ecoponto);
        auditoria.registrar(AcaoAuditoria.COLLECTION_POINT_CREATED, "CollectionPoint", ecoponto.getId(), ecoponto.getName());
        return paraDto(ecoponto, null);
    }

    @Transactional
    public CollectionPointDto atualizar(UUID id, CollectionPointInput entrada) {
        CollectionPoint ecoponto = repositorio.findById(id).orElseThrow(() -> ExcecaoApi.naoEncontrado("Ecoponto não encontrado."));
        ecoponto.apply(entrada);
        auditoria.registrar(AcaoAuditoria.COLLECTION_POINT_UPDATED, "CollectionPoint", id, ecoponto.getName());
        return paraDto(ecoponto, null);
    }

    @Transactional
    public void remover(UUID id) {
        CollectionPoint ecoponto = repositorio.findById(id).orElseThrow(() -> ExcecaoApi.naoEncontrado("Ecoponto não encontrado."));
        repositorio.delete(ecoponto);
        auditoria.registrar(AcaoAuditoria.COLLECTION_POINT_DELETED, "CollectionPoint", id, ecoponto.getName());
    }

    static CollectionPointDto paraDto(CollectionPoint p, Double distanciaKm) {
        List<CodigoCategoria> categorias = p.getCategories().stream().sorted().toList();
        return new CollectionPointDto(p.getId(), p.getName(), p.getAddress(), p.getNeighborhood(), p.getLatitude(),
                p.getLongitude(), p.getOpeningHours(), categorias, p.isActive(),
                distanciaKm == null ? null : Numeros.arredondar(distanciaKm, 2));
    }
}
