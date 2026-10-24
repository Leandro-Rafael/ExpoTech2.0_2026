package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.ErrorCode;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageProcessorTest {

    private final ImageProcessor processor = new ImageProcessor();

    static byte[] png(int w, int h, Color color) throws IOException {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, w, h);
        g.setColor(Color.BLACK);
        g.fillOval(w / 4, h / 4, w / 2, h / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void reencodesPngAsResizedJpeg() throws IOException {
        var result = processor.process(png(2400, 1200, Color.GREEN));
        assertThat(result.width()).isEqualTo(1600);
        assertThat(result.height()).isEqualTo(800);
        assertThat(result.jpeg()[0] & 0xFF).isEqualTo(0xFF);
        assertThat(result.jpeg()[1] & 0xFF).isEqualTo(0xD8);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result.aiJpeg()));
        assertThat(Math.max(decoded.getWidth(), decoded.getHeight())).isEqualTo(800);
    }

    @Test
    void similarImagesHaveCloseHashes() throws IOException {
        long a = processor.process(png(400, 300, Color.GREEN)).dHash();
        long b = processor.process(png(420, 315, Color.GREEN)).dHash();
        assertThat(PerceptualHash.hammingDistance(a, b)).isLessThanOrEqualTo(PerceptualHash.SIMILARITY_THRESHOLD);
    }

    @Test
    void rejectsNonImagesEvenWithFakeExtension() {
        byte[] script = "<script>alert(1)</script> isto não é uma imagem, apenas texto com mais de 64 bytes..."
                .getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> processor.process(script))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.INVALID_IMAGE);
    }

    @Test
    void rejectsTruncatedImage() throws IOException {
        byte[] full = png(300, 300, Color.BLUE);
        byte[] truncated = java.util.Arrays.copyOf(full, 80);
        assertThatThrownBy(() -> processor.process(truncated)).isInstanceOf(ApiException.class);
    }
}
