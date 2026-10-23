package br.com.ecotechzero.lixozero.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Normalização de textos vindos do usuário. */
public final class Text {

    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Pattern SPACES = Pattern.compile("[ \\t]+");

    private Text() {
    }

    /** Remove caracteres de controle e espaços repetidos; devolve null para texto vazio. */
    public static String clean(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = SPACES.matcher(CONTROL_CHARS.matcher(value).replaceAll("")).replaceAll(" ").strip();
        return cleaned.isEmpty() ? null : cleaned;
    }

    public static String normalizeEmail(String email) {
        return email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    /** Texto em minúsculas e sem acentos (para buscas e comparações). */
    public static String fold(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    public static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
