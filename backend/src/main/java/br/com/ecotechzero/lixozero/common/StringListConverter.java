package br.com.ecotechzero.lixozero.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.List;

/** Armazena uma lista de textos em uma coluna TEXT, um item por linha. */
@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    @Override
    public String convertToDatabaseColumn(List<String> valores) {
        return valores == null ? "" : String.join("\n", valores);
    }

    @Override
    public List<String> convertToEntityAttribute(String coluna) {
        if (coluna == null || coluna.isBlank()) {
            return List.of();
        }
        return coluna.lines().map(String::strip).filter(s -> !s.isEmpty()).toList();
    }
}
