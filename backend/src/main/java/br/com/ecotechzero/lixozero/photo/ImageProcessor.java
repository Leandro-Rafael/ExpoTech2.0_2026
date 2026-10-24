package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Validação e sanitização de imagens enviadas pelos usuários.
 * <ol>
 *   <li>Confere os "magic bytes" (assinatura binária): só aceita JPEG e PNG de verdade, não importa a extensão.</li>
 *   <li>Lê apenas o cabeçalho para obter as dimensões ANTES de decodificar (proteção contra
 *       "decompression bomb": um PNG pequeno que se expande para gigabytes de memória).</li>
 *   <li>Decodifica e reencoda como JPEG com no máximo 1600 px: remove EXIF/GPS e qualquer conteúdo embutido.</li>
 *   <li>Calcula o dHash (hash perceptual de 64 bits) para detectar fotos repetidas ou muito parecidas.</li>
 * </ol>
 */
@Component
public class ImageProcessor {

    public static final int MAX_BYTES = 5 * 1024 * 1024;
    static final int MAX_DIMENSION = 8000;
    static final long MAX_PIXELS = 40_000_000L;
    static final int OUTPUT_MAX_SIDE = 1600;
    static final int AI_MAX_SIDE = 800;

    /**
     * No máximo 2 decodificações ao mesmo tempo: cada imagem grande ocupa dezenas de MB de memória
     * enquanto é decodificada; sem esse limite, muitos uploads simultâneos poderiam esgotar a memória (DoS).
     */
    private static final Semaphore DECODE_SLOTS = new Semaphore(2, true);
    private static final long DECODE_WAIT_SECONDS = 15;

    static {
        ImageIO.setUseCache(false); // processa em memória, sem arquivos temporários
    }

    private static void acquireDecodeSlot() {
        try {
            if (DECODE_SLOTS.tryAcquire(DECODE_WAIT_SECONDS, TimeUnit.SECONDS)) {
                return;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        throw new ApiException(ErrorCode.RATE_LIMITED, ErrorCode.RATE_LIMITED.status(),
                "O servidor está processando muitas fotos agora. Tente novamente em instantes.", null, 5L);
    }

    /** Resultado: JPEG limpo, versão reduzida para a IA, dimensões e hashes. */
    public record ProcessedImage(byte[] jpeg, byte[] aiJpeg, int width, int height, long dHash, String sha256) {
    }

    enum Format { JPEG, PNG }

    public ProcessedImage process(byte[] bytes) {
        if (bytes == null || bytes.length < 64) {
            throw invalid("Arquivo de imagem vazio ou corrompido.");
        }
        if (bytes.length > MAX_BYTES) {
            throw invalid("A imagem deve ter no máximo 5 MB.");
        }
        Format format = detectFormat(bytes);
        acquireDecodeSlot();
        BufferedImage output;
        try {
            output = resizeToRgb(decodeSafely(bytes, format), OUTPUT_MAX_SIDE);
        } finally {
            DECODE_SLOTS.release();
        }
        byte[] jpeg = encodeJpeg(output, 0.85f);
        byte[] aiJpeg = Math.max(output.getWidth(), output.getHeight()) > AI_MAX_SIDE
                ? encodeJpeg(resizeToRgb(output, AI_MAX_SIDE), 0.8f)
                : jpeg;
        return new ProcessedImage(jpeg, aiJpeg, output.getWidth(), output.getHeight(), PerceptualHash.dHash(output), sha256(bytes));
    }

    static Format detectFormat(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return Format.JPEG;
        }
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        if (b.length > png.length) {
            boolean match = true;
            for (int i = 0; i < png.length; i++) {
                match &= b[i] == png[i];
            }
            if (match) {
                return Format.PNG;
            }
        }
        throw invalid("Formato não suportado. Envie uma foto JPEG ou PNG.");
    }

    private static BufferedImage decodeSafely(byte[] bytes, Format format) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReadersByFormatName(format.name().toLowerCase());
            if (!readers.hasNext() || in == null) {
                throw invalid("Formato de imagem não suportado.");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 16 || height < 16) {
                    throw invalid("Imagem muito pequena.");
                }
                if (width > MAX_DIMENSION || height > MAX_DIMENSION || (long) width * height > MAX_PIXELS) {
                    throw invalid("Imagem muito grande (máximo 8000 x 8000 pixels).");
                }
                // Subamostragem na leitura: imagens enormes são lidas já reduzidas (economiza memória)
                ImageReadParam param = reader.getDefaultReadParam();
                int factor = Math.max(1, Math.max(width, height) / (OUTPUT_MAX_SIDE * 2));
                if (factor > 1) {
                    param.setSourceSubsampling(factor, factor, 0, 0);
                }
                BufferedImage image = reader.read(0, param);
                if (image == null) {
                    throw invalid("Não foi possível ler a imagem.");
                }
                return image;
            } finally {
                reader.dispose();
            }
        } catch (ApiException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw invalid("Não foi possível ler a imagem. Verifique se o arquivo não está corrompido.");
        }
    }

    /** Redimensiona mantendo a proporção e converte para RGB (fundo branco onde havia transparência). */
    static BufferedImage resizeToRgb(BufferedImage source, int maxSide) {
        int w = source.getWidth();
        int h = source.getHeight();
        double scale = Math.min(1.0, (double) maxSide / Math.max(w, h));
        int targetW = Math.max(1, (int) Math.round(w * scale));
        int targetH = Math.max(1, (int) Math.round(h * scale));
        BufferedImage out = new BufferedImage(targetW, targetH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, targetW, targetH);
            g.drawImage(source, 0, 0, targetW, targetH, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static byte[] encodeJpeg(BufferedImage image, float quality) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream(); ImageOutputStream out = ImageIO.createImageOutputStream(bos)) {
            writer.setOutput(out);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), param); // sem metadados: EXIF descartado
            out.flush();
            return bos.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao codificar JPEG", e);
        } finally {
            writer.dispose();
        }
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ApiException invalid(String detail) {
        return new ApiException(ErrorCode.INVALID_IMAGE, detail);
    }
}
