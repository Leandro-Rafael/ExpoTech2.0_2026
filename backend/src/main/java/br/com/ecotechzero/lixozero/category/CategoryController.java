package br.com.ecotechzero.lixozero.category;

import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class CategoryController {

    private final CategoryService service;

    public CategoryController(CategoryService service) {
        this.service = service;
    }

    /** Público: categorias ativas. Administradores podem pedir todas com ?all=true. */
    @GetMapping("/api/categories")
    public List<CategoryDto> list(@RequestParam(defaultValue = "false") boolean all, @AuthenticationPrincipal AuthUser me) {
        return service.list(all && me != null && me.isAdmin());
    }
}
