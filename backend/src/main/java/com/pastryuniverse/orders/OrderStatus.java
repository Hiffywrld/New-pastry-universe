package com.pastryuniverse.orders;

public enum OrderStatus {
    AWAITING_PAYMENT,
    PAYMENT_REVIEW,
    CONFIRMED,
    BAKING,
    READY,
    OUT_FOR_DELIVERY,
    COMPLETED,
    CANCELLED;

    public boolean isOpen() {
        return this != COMPLETED && this != CANCELLED;
    }
}
