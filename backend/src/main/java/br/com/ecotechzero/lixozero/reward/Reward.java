package br.com.ecotechzero.lixozero.reward;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.DynamicUpdate;

/** Recompensa do catálogo, trocada por pontos. O estoque é decrementado com a linha travada. */
@Entity
@Table(name = "rewards")
@DynamicUpdate
public class Reward extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(name = "cost_points", nullable = false)
    private int costPoints;

    @Column(nullable = false)
    private int stock;

    @Column(nullable = false, length = 40)
    private String icon;

    @Column(length = 120)
    private String partner;

    @Column(nullable = false)
    private boolean active = true;

    protected Reward() {
    }

    public Reward(String name) {
        this.name = name;
    }

    public void apply(DtosRecompensa.RewardInput in) {
        this.name = in.name().strip();
        this.description = in.description().strip();
        this.costPoints = in.costPoints();
        this.stock = in.stock();
        this.icon = in.icon();
        this.partner = in.partner() == null || in.partner().isBlank() ? null : in.partner().strip();
        this.active = in.active();
    }

    public void decrementStock() {
        if (stock <= 0) {
            throw new IllegalStateException("sem estoque");
        }
        stock--;
    }

    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getCostPoints() { return costPoints; }
    public int getStock() { return stock; }
    public String getIcon() { return icon; }
    public String getPartner() { return partner; }
    public boolean isActive() { return active; }
}
