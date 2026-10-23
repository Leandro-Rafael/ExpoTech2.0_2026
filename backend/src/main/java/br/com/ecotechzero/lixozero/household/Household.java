package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Residência (Smart Home 2050): agrupa moradores e lixeiras inteligentes.
 * Endereço e coordenadas são opcionais e usados nas solicitações automáticas de coleta.
 */
@Entity
@Table(name = "households")
public class Household extends BaseEntity {

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 80)
    private String neighborhood;

    @Column(nullable = false, length = 80)
    private String city;

    @Column(length = 200)
    private String address;

    private Double latitude;

    private Double longitude;

    @Column(name = "invite_code", nullable = false, length = 12, unique = true)
    private String inviteCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    protected Household() {
    }

    public Household(String name, String neighborhood, String city, String inviteCode) {
        this.name = name;
        this.neighborhood = neighborhood;
        this.city = city;
        this.inviteCode = inviteCode;
    }

    public void setLocation(String address, Double latitude, Double longitude) {
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public String getName() { return name; }
    public String getNeighborhood() { return neighborhood; }
    public String getCity() { return city; }
    public String getAddress() { return address; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public String getInviteCode() { return inviteCode; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
}
