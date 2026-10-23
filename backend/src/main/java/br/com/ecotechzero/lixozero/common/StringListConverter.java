package br.com.ecotechzero.lixozero.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.List;

/** Armazena uma lista de textos em uma coluna TEXT, um item por linha. */
@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    @Override
    public String convertToDatabaseColumn(List<String> values) {
        return values == null ? "" : String.join("\n", values);
    }

    @Override
    public List<String> convertToEntityAttribute(String column) {
        if (column == null || column.isBlank()) {
            return List.of();
        }
        return column.lines().map(String::strip).filter(s -> !s.isEmpty()).toList();
    }
}
