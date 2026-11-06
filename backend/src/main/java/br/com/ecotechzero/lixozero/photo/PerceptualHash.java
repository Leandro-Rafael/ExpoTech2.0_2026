package br.com.ecotechzero.lixozero.photo;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;

/**
 * dHash (difference hash) de 64 bits.
 * <p>
 * A imagem é reduzida para 9x8 pixels em tons de cinza; para cada linha comparamos cada pixel com o
 * vizinho da direita (8 comparações x 8 linhas = 64 bits). Fotos visualmente parecidas (mesmo objeto,
 * pequeno corte, compressão diferente) geram hashes com poucos bits diferentes.
 * A semelhança é medida pela distância de Hamming (quantidade de bits diferentes).
 */
public final class PerceptualHash {

    /** Distância de Hamming até a qual consideramos duas fotos "praticamente iguais". */
    public static final int SIMILARITY_THRESHOLD = 6;

    private PerceptualHash() {
    }

    public static long dHash(BufferedImage imagem) {
        // Etapa 1: reduz para 144x128 em cinza; Etapa 2: média de blocos 16x16 -> grade 9x8
        int larguraEtapa = 144, alturaEtapa = 128;
        BufferedImage cinza = new BufferedImage(larguraEtapa, alturaEtapa, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = cinza.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(imagem, 0, 0, larguraEtapa, alturaEtapa, null);
        } finally {
            g.dispose();
        }
        double[][] celulas = new double[8][9];
        var raster = cinza.getRaster();
        for (int y = 0; y < alturaEtapa; y++) {
            for (int x = 0; x < larguraEtapa; x++) {
                celulas[y / 16][x / 16] += raster.getSample(x, y, 0);
            }
        }
        long hash = 0;
        for (int linha = 0; linha < 8; linha++) {
            for (int coluna = 0; coluna < 8; coluna++) {
                hash <<= 1;
                if (celulas[linha][coluna] > celulas[linha][coluna + 1]) {
                    hash |= 1;
                }
            }
        }
        return hash;
    }

    /** Quantidade de bits diferentes entre dois hashes (0 = idênticos, 64 = opostos). */
    public static int distanciaHamming(long a, long b) {
        return Long.bitCount(a ^ b);
    }
}
