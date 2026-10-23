package br.com.ecotechzero.lixozero.points;

import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PointsController {

    private final PointsService service;

    public PointsController(PointsService service) {
        this.service = service;
    }

    @GetMapping("/api/points/transactions")
    public PageResponse<PointsService.PointTransactionDto> transactions(@AuthenticationPrincipal AuthUser me,
                                                                        @RequestParam(required = false) Integer page,
                                                                        @RequestParam(required = false) Integer size) {
        return service.history(me.id(), page, size);
    }
}
