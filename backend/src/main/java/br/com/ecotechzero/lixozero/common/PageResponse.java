package br.com.ecotechzero.lixozero.common;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/** Página de resultados no formato do contrato: { content, page, size, totalElements, totalPages }. */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <E, T> PageResponse<T> of(Page<E> pagina, Function<E, T> mapeador) {
        return new PageResponse<>(pagina.getContent().stream().map(mapeador).toList(),
                pagina.getNumber(), pagina.getSize(), pagina.getTotalElements(), pagina.getTotalPages());
    }
}
