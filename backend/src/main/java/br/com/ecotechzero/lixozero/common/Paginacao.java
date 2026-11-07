package br.com.ecotechzero.lixozero.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/** Cria PageRequest com limites seguros (tamanho máximo 100, evita consultas gigantes). */
public final class Paginacao {

    public static final int MAX_SIZE = 100;
    private static final int PAGINA_MAXIMA = 10_000;

    private Paginacao() {
    }

    public static PageRequest criar(Integer pagina, Integer tamanho, Sort ordenacao) {
        int p = pagina == null ? 0 : Math.clamp(pagina, 0, PAGINA_MAXIMA);
        int s = tamanho == null ? 20 : Math.clamp(tamanho, 1, MAX_SIZE);
        return PageRequest.of(p, s, ordenacao);
    }
}
