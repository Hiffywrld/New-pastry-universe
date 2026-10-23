package com.pastryuniverse.orders;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "order_events")
public class OrderEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private Order order;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    private String note;
    private String actor;
    private Instant createdAt = Instant.now();

    protected OrderEvent() {}

    public OrderEvent(Order order, OrderStatus status, String note, String actor) {
        this.order = order;
        this.status = status;
        this.note = note;
        this.actor = actor;
    }

    public OrderStatus getStatus() { return status; }
    public String getNote() { return note; }
    public String getActor() { return actor; }
    public Instant getCreatedAt() { return createdAt; }
}
