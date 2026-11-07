package br.com.ecotechzero.lixozero.category;

import br.com.ecotechzero.lixozero.category.DtosCategoria.CategoryDto;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Lista as categorias de material (plástico, papel, vidro...) usadas no app. */
@RestController
public class ControladorCategorias {

    private final ServicoCategorias servico;

    public ControladorCategorias(ServicoCategorias servico) {
        this.servico = servico;
    }

    /** Público: categorias ativas. Administradores podem pedir todas com ?all=true. */
    @GetMapping("/api/categories")
    public List<CategoryDto> listar(@RequestParam(defaultValue = "false") boolean all, @AuthenticationPrincipal UsuarioAutenticado logado) {
        return servico.listar(all && logado != null && logado.isAdmin());
    }
}
