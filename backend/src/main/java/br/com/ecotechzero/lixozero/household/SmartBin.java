package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.DynamicUpdate;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Lixeira inteligente (IoT) de uma residência. O dispositivo se autentica com deviceId + deviceKey;
 * guardamos apenas o hash SHA-256 da chave (exibida ao usuário uma única vez, na criação).
 */
@Entity
@Table(name = "smart_bins")
@DynamicUpdate
public class SmartBin extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "household_id", nullable = false)
    private Household household;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "capacity_liters", nullable = false)
    private int capacityLiters;

    @Column(name = "fill_level", nullable = false)
    private int fillLevel;

    @Column(name = "battery_level", nullable = false)
    private int batteryLevel = 100;

    @Column(name = "auto_request_threshold", nullable = false)
    private int autoRequestThreshold;

    @Column(name = "last_reading_at")
    private Instant lastReadingAt;

    @Column(name = "device_id", nullable = false, unique = true)
    private UUID deviceId;

    @Column(name = "device_key_hash", nullable = false, length = 64)
    private String deviceKeyHash;

    /** Lixeiras de demonstração alimentadas pelo simulador IoT. */
    @Column(nullable = false)
    private boolean simulated;

    protected SmartBin() {
    }

    public SmartBin(Household household, Category category, String name, int capacityLiters, int autoRequestThreshold,
                    UUID deviceId, String deviceKeyHash) {
        this.household = household;
        this.category = category;
        this.name = name;
        this.capacityLiters = capacityLiters;
        this.autoRequestThreshold = autoRequestThreshold;
        this.deviceId = deviceId;
        this.deviceKeyHash = deviceKeyHash;
    }

    public void applyReading(int fill, int battery, Instant at) {
        this.fillLevel = fill;
        this.batteryLevel = battery;
        this.lastReadingAt = at;
    }

    /** Status calculado a partir da última leitura. */
    public SmartBinStatus statusAt(Instant now, Duration offlineAfter) {
        if (lastReadingAt == null || lastReadingAt.plus(offlineAfter).isBefore(now)) {
            return SmartBinStatus.OFFLINE;
        }
        if (fillLevel >= 90) {
            return SmartBinStatus.FULL;
        }
        if (fillLevel >= Math.min(autoRequestThreshold, 75) || batteryLevel <= 15) {
            return SmartBinStatus.ATTENTION;
        }
        return SmartBinStatus.OK;
    }

    public Household getHousehold() { return household; }
    public Category getCategory() { return category; }
    public String getName() { return name; }
    public int getCapacityLiters() { return capacityLiters; }
    public int getFillLevel() { return fillLevel; }
    public int getBatteryLevel() { return batteryLevel; }
    public int getAutoRequestThreshold() { return autoRequestThreshold; }
    public Instant getLastReadingAt() { return lastReadingAt; }
    public UUID getDeviceId() { return deviceId; }
    public String getDeviceKeyHash() { return deviceKeyHash; }
    public boolean isSimulated() { return simulated; }
    public void setSimulated(boolean simulated) { this.simulated = simulated; }
}
