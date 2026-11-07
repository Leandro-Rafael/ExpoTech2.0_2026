package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
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
public class ProcessadorImagem {

    public static final int MAX_BYTES = 5 * 1024 * 1024;
    static final int MAX_DIMENSION = 8000;
    static final long MAX_PIXELS = 40_000_000L;
    static final int OUTPUT_MAX_SIDE = 1600;
    static final int AI_MAX_SIDE = 800;

    /**
     * No máximo 2 decodificações ao mesmo tempo: cada imagem grande ocupa dezenas de MB de memória
     * enquanto é decodificada; sem esse limite, muitos uploads simultâneos poderiam esgotar a memória (DoS).
     */
    private static final Semaphore VAGAS_DECODIFICACAO = new Semaphore(2, true);
    private static final long ESPERA_DECODIFICACAO_SEGUNDOS = 15;

    static {
        ImageIO.setUseCache(false); // processa em memória, sem arquivos temporários
    }

    private static void reservarVagaDecodificacao() {
        try {
            if (VAGAS_DECODIFICACAO.tryAcquire(ESPERA_DECODIFICACAO_SEGUNDOS, TimeUnit.SECONDS)) {
                return;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        throw new ExcecaoApi(CodigoErro.RATE_LIMITED, CodigoErro.RATE_LIMITED.status(),
                "O servidor está processando muitas fotos agora. Tente novamente em instantes.", null, 5L);
    }

    /** Resultado: JPEG limpo, versão reduzida para a IA, dimensões e hashes. */
    public record ProcessedImage(byte[] jpeg, byte[] aiJpeg, int width, int height, long dHash, String sha256) {
    }

    enum Format { JPEG, PNG }

    public ProcessedImage processar(byte[] bytes) {
        if (bytes == null || bytes.length < 64) {
            throw invalida("Arquivo de imagem vazio ou corrompido.");
        }
        if (bytes.length > MAX_BYTES) {
            throw invalida("A imagem deve ter no máximo 5 MB.");
        }
        Format formato = detectarFormato(bytes);
        reservarVagaDecodificacao();
        BufferedImage saida;
        try {
            saida = redimensionarParaRgb(decodificarComSeguranca(bytes, formato), OUTPUT_MAX_SIDE);
        } finally {
            VAGAS_DECODIFICACAO.release();
        }
        byte[] jpeg = codificarJpeg(saida, 0.85f);
        byte[] jpegIa = Math.max(saida.getWidth(), saida.getHeight()) > AI_MAX_SIDE
                ? codificarJpeg(redimensionarParaRgb(saida, AI_MAX_SIDE), 0.8f)
                : jpeg;
        return new ProcessedImage(jpeg, jpegIa, saida.getWidth(), saida.getHeight(), HashPerceptual.dHash(saida), sha256(bytes));
    }

    static Format detectarFormato(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return Format.JPEG;
        }
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        if (b.length > png.length) {
            boolean confere = true;
            for (int i = 0; i < png.length; i++) {
                confere &= b[i] == png[i];
            }
            if (confere) {
                return Format.PNG;
            }
        }
        throw invalida("Formato não suportado. Envie uma foto JPEG ou PNG.");
    }

    private static BufferedImage decodificarComSeguranca(byte[] bytes, Format formato) {
        try (ImageInputStream entrada = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> leitores = ImageIO.getImageReadersByFormatName(formato.name().toLowerCase());
            if (!leitores.hasNext() || entrada == null) {
                throw invalida("Formato de imagem não suportado.");
            }
            ImageReader leitor = leitores.next();
            try {
                leitor.setInput(entrada, true, true);
                int largura = leitor.getWidth(0);
                int altura = leitor.getHeight(0);
                if (largura < 16 || altura < 16) {
                    throw invalida("Imagem muito pequena.");
                }
                if (largura > MAX_DIMENSION || altura > MAX_DIMENSION || (long) largura * altura > MAX_PIXELS) {
                    throw invalida("Imagem muito grande (máximo 8000 x 8000 pixels).");
                }
                // Subamostragem na leitura: imagens enormes são lidas já reduzidas (economiza memória)
                ImageReadParam parametros = leitor.getDefaultReadParam();
                int fator = Math.max(1, Math.max(largura, altura) / (OUTPUT_MAX_SIDE * 2));
                if (fator > 1) {
                    parametros.setSourceSubsampling(fator, fator, 0, 0);
                }
                BufferedImage imagem = leitor.read(0, parametros);
                if (imagem == null) {
                    throw invalida("Não foi possível ler a imagem.");
                }
                return imagem;
            } finally {
                leitor.dispose();
            }
        } catch (ExcecaoApi e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw invalida("Não foi possível ler a imagem. Verifique se o arquivo não está corrompido.");
        }
    }

    /** Redimensiona mantendo a proporção e converte para RGB (fundo branco onde havia transparência). */
    static BufferedImage redimensionarParaRgb(BufferedImage origem, int ladoMaximo) {
        int w = origem.getWidth();
        int h = origem.getHeight();
        double escala = Math.min(1.0, (double) ladoMaximo / Math.max(w, h));
        int larguraAlvo = Math.max(1, (int) Math.round(w * escala));
        int alturaAlvo = Math.max(1, (int) Math.round(h * escala));
        BufferedImage destino = new BufferedImage(larguraAlvo, alturaAlvo, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = destino.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, larguraAlvo, alturaAlvo);
            g.drawImage(origem, 0, 0, larguraAlvo, alturaAlvo, null);
        } finally {
            g.dispose();
        }
        return destino;
    }

    private static byte[] codificarJpeg(BufferedImage imagem, float qualidade) {
        ImageWriter escritor = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream(); ImageOutputStream destino = ImageIO.createImageOutputStream(bos)) {
            escritor.setOutput(destino);
            ImageWriteParam parametros = escritor.getDefaultWriteParam();
            parametros.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parametros.setCompressionQuality(qualidade);
            escritor.write(null, new IIOImage(imagem, null, null), parametros); // sem metadados: EXIF descartado
            destino.flush();
            return bos.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao codificar JPEG", e);
        } finally {
            escritor.dispose();
        }
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ExcecaoApi invalida(String detalhe) {
        return new ExcecaoApi(CodigoErro.INVALID_IMAGE, detalhe);
    }
}
