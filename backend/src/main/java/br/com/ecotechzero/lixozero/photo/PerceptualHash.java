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

    public static long dHash(BufferedImage image) {
        // Etapa 1: reduz para 144x128 em cinza; Etapa 2: média de blocos 16x16 -> grade 9x8
        int stageW = 144, stageH = 128;
        BufferedImage gray = new BufferedImage(stageW, stageH, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = gray.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(image, 0, 0, stageW, stageH, null);
        } finally {
            g.dispose();
        }
        double[][] cells = new double[8][9];
        var raster = gray.getRaster();
        for (int y = 0; y < stageH; y++) {
            for (int x = 0; x < stageW; x++) {
                cells[y / 16][x / 16] += raster.getSample(x, y, 0);
            }
        }
        long hash = 0;
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                hash <<= 1;
                if (cells[row][col] > cells[row][col + 1]) {
                    hash |= 1;
                }
            }
        }
        return hash;
    }

    /** Quantidade de bits diferentes entre dois hashes (0 = idênticos, 64 = opostos). */
    public static int hammingDistance(long a, long b) {
        return Long.bitCount(a ^ b);
    }
}
