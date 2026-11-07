package br.com.ecotechzero.lixozero.gamification;

import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** Desafio por período (ex.: "Reciclar 10 kg de plástico em novembro"), com bônus pago uma vez. */
@Entity
@Table(name = "challenges")
public class Challenge extends BaseEntity {

    public enum Metric { KG, COUNT }

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "category_code", length = 20)
    private CodigoCategoria categoryCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Metric metric;

    @Column(nullable = false)
    private double target;

    @Column(name = "bonus_points", nullable = false)
    private int bonusPoints;

    @Column(name = "starts_at", nullable = false)
    private LocalDate startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalDate endsAt;

    @Column(nullable = false)
    private boolean active = true;

    protected Challenge() {
    }

    public Challenge(String title) {
        this.title = title;
    }

    public void apply(DtosGamificacao.ChallengeInput in) {
        this.title = in.title().strip();
        this.description = in.description().strip();
        this.categoryCode = in.categoryCode();
        this.metric = in.metric();
        this.target = in.target();
        this.bonusPoints = in.bonusPoints();
        this.startsAt = in.startsAt();
        this.endsAt = in.endsAt();
        this.active = in.active();
    }

    public boolean covers(LocalDate day) {
        return !day.isBefore(startsAt) && !day.isAfter(endsAt);
    }

    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public CodigoCategoria getCategoryCode() { return categoryCode; }
    public Metric getMetric() { return metric; }
    public double getTarget() { return target; }
    public int getBonusPoints() { return bonusPoints; }
    public LocalDate getStartsAt() { return startsAt; }
    public LocalDate getEndsAt() { return endsAt; }
    public boolean isActive() { return active; }
}
