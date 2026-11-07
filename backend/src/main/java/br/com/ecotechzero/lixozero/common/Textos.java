package br.com.ecotechzero.lixozero.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Normalização de textos vindos do usuário. */
public final class Textos {

    private static final Pattern CARACTERES_CONTROLE = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Pattern ESPACOS = Pattern.compile("[ \\t]+");

    private Textos() {
    }

    /** Remove caracteres de controle e espaços repetidos; devolve null para texto vazio. */
    public static String limpar(String valor) {
        if (valor == null) {
            return null;
        }
        String limpo = ESPACOS.matcher(CARACTERES_CONTROLE.matcher(valor).replaceAll("")).replaceAll(" ").strip();
        return limpo.isEmpty() ? null : limpo;
    }

    public static String normalizarEmail(String email) {
        return email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    /** Texto em minúsculas e sem acentos (para buscas e comparações). */
    public static String semAcentos(String valor) {
        if (valor == null) {
            return "";
        }
        return Normalizer.normalize(valor, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    public static String truncar(String valor, int maximo) {
        if (valor == null || valor.length() <= maximo) {
            return valor;
        }
        return valor.substring(0, maximo);
    }
}
