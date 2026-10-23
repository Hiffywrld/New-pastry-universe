package com.pastryuniverse.kitchen;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A rider with a private link to the day's deliveries. */
@Entity
@Table(name = "riders")
public class Rider {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String token;
    private String name;
    private String phone;
    private boolean active = true;
    private Instant createdAt = Instant.now();
    private Instant lastSeenAt;

    protected Rider() {}

    public Rider(String token, String name, String phone) {
        this.token = token;
        this.name = name;
        this.phone = phone;
    }

    public void deactivate() { this.active = false; }
    public void seen() { this.lastSeenAt = Instant.now(); }

    public Long getId() { return id; }
    public String getToken() { return token; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
}
