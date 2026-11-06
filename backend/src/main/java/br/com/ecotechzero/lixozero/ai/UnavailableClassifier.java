package br.com.ecotechzero.lixozero.ai;

import java.util.Optional;

/** Usado quando não há chave de API: informa ao front-end que a IA do servidor está indisponível. */
public class UnavailableClassifier implements WasteClassifier {

    @Override
    public boolean estaDisponivel() {
        return false;
    }

    @Override
    public Optional<Classification> classificar(byte[] jpeg) {
        return Optional.empty();
    }
}
