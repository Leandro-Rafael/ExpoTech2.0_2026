package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/** Leitura enviada por uma lixeira inteligente (histórico para os gráficos). */
@Entity
@Table(name = "bin_readings")
public class BinReading extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bin_id", nullable = false)
    private SmartBin bin;

    @Column(name = "fill_level", nullable = false)
    private int fillLevel;

    @Column(name = "battery_level", nullable = false)
    private int batteryLevel;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    protected BinReading() {
    }

    public BinReading(SmartBin bin, int fillLevel, int batteryLevel, Instant recordedAt) {
        this.bin = bin;
        this.fillLevel = fillLevel;
        this.batteryLevel = batteryLevel;
        this.recordedAt = recordedAt;
        setCreatedAt(recordedAt);
    }

    public int getFillLevel() { return fillLevel; }
    public int getBatteryLevel() { return batteryLevel; }
    public Instant getRecordedAt() { return recordedAt; }
}
