package com.pastryuniverse.catalog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "delivery_zones")
public class DeliveryZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String areas;
    private int fee;
    private int sortOrder;
    private boolean active = true;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getAreas() { return areas; }
    public int getFee() { return fee; }
    public int getSortOrder() { return sortOrder; }
    public boolean isActive() { return active; }
}
