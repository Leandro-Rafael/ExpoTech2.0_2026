package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Foto de um descarte. Os bytes (JPEG já sanitizado) ficam no próprio banco (bytea),
 * o que funciona em qualquer PostgreSQL gerenciado (Supabase) sem storage externo.
 */
@Entity
@Table(name = "photos")
public class Photo extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "content_type", nullable = false, length = 30)
    private String contentType;

    @Column(name = "data", nullable = false)
    private byte[] data;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(nullable = false)
    private long dhash;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_code", length = 20)
    private CodigoCategoria aiCode;

    @Column(name = "ai_confidence")
    private Double aiConfidence;

    @Column(name = "ai_reasoning", length = 500)
    private String aiReasoning;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_source", length = 10)
    private OrigemIa aiSource;

    @Column(name = "ai_model", length = 60)
    private String aiModel;

    @Column(name = "ai_classified_at")
    private Instant aiClassifiedAt;

    protected Photo() {
    }

    public Photo(User owner, byte[] jpeg, int width, int height, long dhash, String sha256) {
        this.owner = owner;
        this.contentType = "image/jpeg";
        this.data = jpeg;
        this.width = width;
        this.height = height;
        this.sizeBytes = jpeg.length;
        this.dhash = dhash;
        this.sha256 = sha256;
    }

    /** Resultado do classificador do SERVIDOR (nunca dados vindos do cliente). */
    public void setServerAi(CodigoCategoria codigo, Double confianca, String justificativa, OrigemIa origem, String modelo, Instant momento) {
        this.aiCode = codigo;
        this.aiConfidence = confianca;
        this.aiReasoning = justificativa;
        this.aiSource = origem;
        this.aiModel = modelo;
        this.aiClassifiedAt = momento;
    }

    public boolean isAiVerified() {
        return aiCode != null && aiSource != null && aiSource.doServidor();
    }

    public User getOwner() { return owner; }
    public String getContentType() { return contentType; }
    public byte[] getData() { return data; }
    public int getWidth() { return width; }
    public int getHeight() { return height; }
    public long getDhash() { return dhash; }
    public String getSha256() { return sha256; }
    public CodigoCategoria getAiCode() { return aiCode; }
    public Double getAiConfidence() { return aiConfidence; }
    public String getAiReasoning() { return aiReasoning; }
    public OrigemIa getAiSource() { return aiSource; }
    public String getAiModel() { return aiModel; }
    public Instant getAiClassifiedAt() { return aiClassifiedAt; }
}
