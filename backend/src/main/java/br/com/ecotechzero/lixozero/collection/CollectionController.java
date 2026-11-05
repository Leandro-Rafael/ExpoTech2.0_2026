package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionPointDto;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CollectionRequestDto;
import br.com.ecotechzero.lixozero.collection.CollectionDtos.CreateCollectionRequest;
import br.com.ecotechzero.lixozero.security.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Endpoints do morador para listar ecopontos e pedir, listar ou cancelar coletas. */
@RestController
public class CollectionController {

    private final CollectionPointService points;
    private final CollectionRequestService requests;

    public CollectionController(CollectionPointService points, CollectionRequestService requests) {
        this.points = points;
        this.requests = requests;
    }

    /** Público (mapa): ecopontos ordenados por distância quando lat/lon são informados. */
    @GetMapping("/api/collection-points")
    public List<CollectionPointDto> points(@RequestParam(required = false) Double lat,
                                           @RequestParam(required = false) Double lon,
                                           @RequestParam(required = false) Double radiusKm,
                                           @RequestParam(required = false) CategoryCode category,
                                           @RequestParam(defaultValue = "false") boolean all,
                                           @AuthenticationPrincipal AuthUser me) {
        return points.search(lat, lon, radiusKm, category, all && me != null && me.isAdmin());
    }

    @PostMapping("/api/collection-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionRequestDto create(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody CreateCollectionRequest body) {
        return requests.create(me, body);
    }

    @GetMapping("/api/collection-requests")
    public List<CollectionRequestDto> mine(@AuthenticationPrincipal AuthUser me) {
        return requests.listMine(me);
    }

    @PostMapping("/api/collection-requests/{id}/cancel")
    public CollectionRequestDto cancel(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return requests.cancel(me, id);
    }
}
