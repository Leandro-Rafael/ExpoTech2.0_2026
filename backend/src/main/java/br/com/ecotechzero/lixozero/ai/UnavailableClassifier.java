package br.com.ecotechzero.lixozero.ai;

import java.util.Optional;

/** Usado quando não há chave de API: informa ao front-end que a IA do servidor está indisponível. */
public class UnavailableClassifier implements WasteClassifier {

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public Optional<Classification> classify(byte[] jpeg) {
        return Optional.empty();
    }
}
