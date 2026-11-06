package br.com.ecotechzero.lixozero.category;

import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Lista as categorias de material (plástico, papel, vidro...) usadas no app. */
@RestController
public class CategoryController {

    private final CategoryService servico;

    public CategoryController(CategoryService servico) {
        this.servico = servico;
    }

    /** Público: categorias ativas. Administradores podem pedir todas com ?all=true. */
    @GetMapping("/api/categories")
    public List<CategoryDto> listar(@RequestParam(defaultValue = "false") boolean all, @AuthenticationPrincipal AuthUser logado) {
        return servico.listar(all && logado != null && logado.isAdmin());
    }
}
