package br.com.ecotechzero.lixozero.collection;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

/** Ecoponto / ponto de entrega voluntária (PEV) com os materiais aceitos. */
@Entity
@Table(name = "collection_points")
public class CollectionPoint extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 200)
    private String address;

    @Column(nullable = false, length = 80)
    private String neighborhood;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(name = "opening_hours", nullable = false, length = 120)
    private String openingHours;

    @Column(nullable = false)
    private boolean active = true;

    @ElementCollection
    @CollectionTable(name = "collection_point_categories", joinColumns = @JoinColumn(name = "collection_point_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "category_code", length = 20)
    private Set<CategoryCode> categories = new HashSet<>();

    protected CollectionPoint() {
    }

    public CollectionPoint(String name) {
        this.name = name;
    }

    public void apply(CollectionDtos.CollectionPointInput in) {
        this.name = in.name().strip();
        this.address = in.address().strip();
        this.neighborhood = in.neighborhood().strip();
        this.latitude = in.latitude();
        this.longitude = in.longitude();
        this.openingHours = in.openingHours().strip();
        this.active = in.active();
        this.categories.clear();
        this.categories.addAll(in.categories());
    }

    public boolean accepts(CategoryCode code) {
        return categories.contains(code);
    }

    public String getName() { return name; }
    public String getAddress() { return address; }
    public String getNeighborhood() { return neighborhood; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
    public String getOpeningHours() { return openingHours; }
    public boolean isActive() { return active; }

    public Set<CategoryCode> getCategories() {
        return categories.isEmpty() ? Set.of() : EnumSet.copyOf(categories);
    }
}
