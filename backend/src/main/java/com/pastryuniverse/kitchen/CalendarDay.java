package com.pastryuniverse.kitchen;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/** A day the kitchen changed from the usual: closed, or taking a different number of orders. */
@Entity
@Table(name = "calendar_days")
public class CalendarDay {

    @Id
    private LocalDate day;

    private boolean closed;

    @Column(name = "max_orders")
    private Integer maxOrders;

    private String note;
    private Instant updatedAt = Instant.now();

    protected CalendarDay() {}

    public CalendarDay(LocalDate day) {
        this.day = day;
    }

    public void update(boolean closed, Integer maxOrders, String note) {
        this.closed = closed;
        this.maxOrders = maxOrders;
        this.note = note;
        this.updatedAt = Instant.now();
    }

    public boolean isDefault() {
        return !closed && maxOrders == null && (note == null || note.isBlank());
    }

    public LocalDate getDay() { return day; }
    public boolean isClosed() { return closed; }
    public Integer getMaxOrders() { return maxOrders; }
    public String getNote() { return note; }
}
