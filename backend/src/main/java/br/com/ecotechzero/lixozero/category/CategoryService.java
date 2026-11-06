package br.com.ecotechzero.lixozero.category;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryDto;
import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryInput;
import br.com.ecotechzero.lixozero.common.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Consulta e cadastro de categorias; o admin cria e edita, com registro na auditoria. */
@Service
public class CategoryService {

    private final CategoryRepository repositorio;
    private final AuditService auditoria;

    public CategoryService(CategoryRepository repositorio, AuditService auditoria) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> listar(boolean incluirInativas) {
        var categorias = incluirInativas ? repositorio.findAllByOrderByName() : repositorio.findByActiveTrueOrderByName();
        return categorias.stream().map(CategoryDto::of).toList();
    }

    /** Categoria ativa (para novos descartes e lixeiras). */
    @Transactional(readOnly = true)
    public Category exigirAtiva(UUID id, String campo) {
        return repositorio.findById(id).filter(Category::isActive)
                .orElseThrow(() -> ApiException.campo(campo, "categoria não encontrada ou inativa"));
    }

    @Transactional
    public CategoryDto criar(CategoryInput entrada) {
        if (repositorio.findByCode(entrada.code()).isPresent()) {
            throw ApiException.conflito("Já existe uma categoria com o código " + entrada.code() + ".");
        }
        Category categoria = new Category(entrada.code());
        categoria.apply(entrada);
        repositorio.save(categoria);
        auditoria.registrar(AuditAction.CATEGORY_CREATED, "Category", categoria.getId(), entrada.code().name());
        return CategoryDto.of(categoria);
    }

    @Transactional
    public CategoryDto atualizar(UUID id, CategoryInput entrada) {
        Category categoria = repositorio.findById(id).orElseThrow(() -> ApiException.naoEncontrado("Categoria não encontrada."));
        repositorio.findByCode(entrada.code())
                .filter(outra -> !outra.getId().equals(id))
                .ifPresent(outra -> {
                    throw ApiException.conflito("Já existe uma categoria com o código " + entrada.code() + ".");
                });
        categoria.apply(entrada);
        auditoria.registrar(AuditAction.CATEGORY_UPDATED, "Category", id, entrada.code().name());
        return CategoryDto.of(categoria);
    }
}
