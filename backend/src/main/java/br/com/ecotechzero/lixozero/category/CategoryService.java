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

@Service
public class CategoryService {

    private final CategoryRepository repository;
    private final AuditService audit;

    public CategoryService(CategoryRepository repository, AuditService audit) {
        this.repository = repository;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> list(boolean includeInactive) {
        var categories = includeInactive ? repository.findAllByOrderByName() : repository.findByActiveTrueOrderByName();
        return categories.stream().map(CategoryDto::of).toList();
    }

    /** Categoria ativa (para novos descartes e lixeiras). */
    @Transactional(readOnly = true)
    public Category requireActive(UUID id, String field) {
        return repository.findById(id).filter(Category::isActive)
                .orElseThrow(() -> ApiException.field(field, "categoria não encontrada ou inativa"));
    }

    @Transactional
    public CategoryDto create(CategoryInput input) {
        if (repository.findByCode(input.code()).isPresent()) {
            throw ApiException.conflict("Já existe uma categoria com o código " + input.code() + ".");
        }
        Category category = new Category(input.code());
        category.apply(input);
        repository.save(category);
        audit.record(AuditAction.CATEGORY_CREATED, "Category", category.getId(), input.code().name());
        return CategoryDto.of(category);
    }

    @Transactional
    public CategoryDto update(UUID id, CategoryInput input) {
        Category category = repository.findById(id).orElseThrow(() -> ApiException.notFound("Categoria não encontrada."));
        repository.findByCode(input.code())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw ApiException.conflict("Já existe uma categoria com o código " + input.code() + ".");
                });
        category.apply(input);
        audit.record(AuditAction.CATEGORY_UPDATED, "Category", id, input.code().name());
        return CategoryDto.of(category);
    }
}
