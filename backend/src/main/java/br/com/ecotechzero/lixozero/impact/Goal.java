package br.com.ecotechzero.lixozero.impact;

import br.com.ecotechzero.lixozero.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Meta de reciclagem da comunidade para um ano (taxa de reciclagem e kg destinados). */
@Entity
@Table(name = "goals")
public class Goal extends BaseEntity {

    @Column(nullable = false)
    private int year;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "target_recycling_rate", nullable = false)
    private double targetRecyclingRate;

    @Column(name = "target_kg", nullable = false)
    private double targetKg;

    protected Goal() {
    }

    public Goal(int year, String title, double targetRecyclingRate, double targetKg) {
        this.year = year;
        this.title = title;
        this.targetRecyclingRate = targetRecyclingRate;
        this.targetKg = targetKg;
    }

    public void apply(ImpactDtos.GoalInput in) {
        this.year = in.year();
        this.title = in.title().strip();
        this.targetRecyclingRate = in.targetRecyclingRate();
        this.targetKg = in.targetKg();
    }

    public int getYear() { return year; }
    public String getTitle() { return title; }
    public double getTargetRecyclingRate() { return targetRecyclingRate; }
    public double getTargetKg() { return targetKg; }
}
