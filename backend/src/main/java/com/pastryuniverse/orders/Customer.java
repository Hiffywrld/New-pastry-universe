package com.pastryuniverse.orders;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String phone;
    private String email;
    private String googleSub;
    private String avatarUrl;
    private Instant lastLoginAt;
    private String notes;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> tags = new ArrayList<>();
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    protected Customer() {}

    public Customer(String name, String phone, String email) {
        this.name = name;
        this.phone = phone;
        this.email = email;
    }

    public void refresh(String name, String email) {
        this.name = name;
        if (email != null && !email.isBlank()) this.email = email;
        this.updatedAt = Instant.now();
    }

    /** A signed-in shopper, created from their Google account. */
    public static Customer fromGoogle(String sub, String name, String email, String avatarUrl) {
        Customer c = new Customer(name, null, email);
        c.googleSub = sub;
        c.avatarUrl = avatarUrl;
        return c;
    }

    public void signedIn(String name, String email, String avatarUrl) {
        if (name != null && !name.isBlank()) this.name = name;
        if (email != null && !email.isBlank()) this.email = email;
        this.avatarUrl = avatarUrl;
        this.lastLoginAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    /** Staff notes and tags, from the kitchen's customer list. */
    public void annotate(String notes, List<String> tags) {
        this.notes = notes;
        this.tags = tags == null ? new ArrayList<>() : new ArrayList<>(tags);
        this.updatedAt = Instant.now();
    }

    public String getNotes() { return notes; }
    public List<String> getTags() { return tags == null ? List.of() : tags; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public String getAvatarUrl() { return avatarUrl; }
    public String getGoogleSub() { return googleSub; }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
}
