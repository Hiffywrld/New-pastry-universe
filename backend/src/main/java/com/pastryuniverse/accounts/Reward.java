package com.pastryuniverse.accounts;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A one-time welcome discount won in Topping Rush. */
@Entity
@Table(name = "rewards")
public class Reward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long accountId;
    private String code;
    private int percent;
    private int maxAmount;
    private Instant expiresAt;
    private Instant redeemedAt;
    private Long redeemedOrderId;
    private String redeemedPhone;
    private Instant createdAt = Instant.now();

    protected Reward() {}

    public Reward(Long accountId, String code, int percent, int maxAmount, Instant expiresAt) {
        this.accountId = accountId;
        this.code = code;
        this.percent = percent;
        this.maxAmount = maxAmount;
        this.expiresAt = expiresAt;
    }

    public boolean isUsable(Instant now) {
        return percent > 0 && redeemedAt == null && now.isBefore(expiresAt);
    }

    public int discountFor(int subtotal) {
        return Math.min(maxAmount, Math.round(subtotal * percent / 100f));
    }

    public void redeem(long orderId, String phone) {
        this.redeemedAt = Instant.now();
        this.redeemedOrderId = orderId;
        this.redeemedPhone = phone;
    }

    /** Gives the reward back, e.g. when its order is cancelled. */
    public void restore() {
        this.redeemedAt = null;
        this.redeemedOrderId = null;
        this.redeemedPhone = null;
    }

    public Long getId() { return id; }
    public Long getAccountId() { return accountId; }
    public String getCode() { return code; }
    public int getPercent() { return percent; }
    public int getMaxAmount() { return maxAmount; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRedeemedAt() { return redeemedAt; }
}
