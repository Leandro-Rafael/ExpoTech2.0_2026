package br.com.ecotechzero.lixozero.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/** Cria PageRequest com limites seguros (tamanho máximo 100, evita consultas gigantes). */
public final class Pagination {

    public static final int MAX_SIZE = 100;
    private static final int MAX_PAGE = 10_000;

    private Pagination() {
    }

    public static PageRequest of(Integer page, Integer size, Sort sort) {
        int p = page == null ? 0 : Math.clamp(page, 0, MAX_PAGE);
        int s = size == null ? 20 : Math.clamp(size, 1, MAX_SIZE);
        return PageRequest.of(p, s, sort);
    }
}
