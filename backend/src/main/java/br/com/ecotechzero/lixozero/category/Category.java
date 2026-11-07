package br.com.ecotechzero.lixozero.category;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.common.ConversorListaTexto;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.util.List;

/** Categoria de resíduo com regras de pontuação, fator de CO2 e orientações de descarte. */
@Entity
@Table(name = "categories")
public class Category extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, unique = true)
    private CodigoCategoria code;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, length = 500)
    private String description;

    @Convert(converter = ConversorListaTexto.class)
    @Column(nullable = false, columnDefinition = "text")
    private List<String> guidance = List.of();

    @Column(name = "points_per_kg", nullable = false)
    private int pointsPerKg;

    /** kg de CO2 equivalente evitados por kg encaminhado corretamente. */
    @Column(name = "co2_factor_kg", nullable = false)
    private double co2FactorKg;

    @Column(nullable = false)
    private boolean recyclable;

    @Column(nullable = false, length = 7)
    private String color;

    @Column(nullable = false, length = 40)
    private String icon;

    @Column(name = "max_kg_per_disposal", nullable = false)
    private double maxKgPerDisposal;

    @Column(nullable = false)
    private boolean active = true;

    protected Category() {
    }

    public Category(CodigoCategoria code) {
        this.code = code;
    }

    public void apply(DtosCategoria.CategoryInput in) {
        this.code = in.code();
        this.name = in.name().strip();
        this.description = in.description().strip();
        this.guidance = in.guidance().stream().map(String::strip).filter(s -> !s.isEmpty()).toList();
        this.pointsPerKg = in.pointsPerKg();
        this.co2FactorKg = in.co2FactorKg();
        this.recyclable = in.recyclable();
        this.color = in.color().toUpperCase();
        this.icon = in.icon();
        this.maxKgPerDisposal = in.maxKgPerDisposal();
        this.active = in.active();
    }

    public CodigoCategoria getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public List<String> getGuidance() { return guidance; }
    public int getPointsPerKg() { return pointsPerKg; }
    public double getCo2FactorKg() { return co2FactorKg; }
    public boolean isRecyclable() { return recyclable; }
    public String getColor() { return color; }
    public String getIcon() { return icon; }
    public double getMaxKgPerDisposal() { return maxKgPerDisposal; }
    public boolean isActive() { return active; }
}
