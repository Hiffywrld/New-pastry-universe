package com.pastryuniverse.orders;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String code;
    private String trackingToken;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    private String customerName;
    private String customerPhone;
    private String customerEmail;

    @Enumerated(EnumType.STRING)
    private Fulfilment fulfilment;

    private Long zoneId;
    private String zoneName;
    private String address;
    private String landmark;
    private LocalDate deliveryDate;
    private String timeSlot;
    private String giftRecipientName;
    private String giftRecipientPhone;
    private String giftNote;
    private String notes;
    private int subtotal;
    private int deliveryFee;
    private int discount;
    private String rewardCode;
    private Long accountId;
    private Long riderId;
    private int total;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus;

    private Instant paidAt;
    private String sessionId;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC, id ASC")
    private List<OrderEvent> events = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC, id ASC")
    private List<PaymentReceipt> receipts = new ArrayList<>();

    protected Order() {}

    public Order(String code, String trackingToken, Customer customer) {
        this.code = code;
        this.trackingToken = trackingToken;
        this.customer = customer;
        this.customerName = customer.getName();
        this.customerPhone = customer.getPhone();
        this.customerEmail = customer.getEmail();
        this.status = OrderStatus.AWAITING_PAYMENT;
        this.paymentStatus = PaymentStatus.UNPAID;
    }

    public void addItem(OrderItem item) {
        items.add(item);
    }

    public void recalculate() {
        this.subtotal = items.stream().mapToInt(OrderItem::getLineTotal).sum();
        this.total = Math.max(0, subtotal - discount) + deliveryFee;
    }

    public void moveTo(OrderStatus next, String note, String actor) {
        this.status = next;
        this.updatedAt = Instant.now();
        events.add(new OrderEvent(this, next, note, actor));
    }

    public void addReceipt(PaymentReceipt receipt) {
        receipts.add(receipt);
        this.updatedAt = Instant.now();
    }

    public void markPaid(Instant at) {
        this.paymentStatus = PaymentStatus.CONFIRMED;
        this.paidAt = at;
    }

    public void setPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
        this.updatedAt = Instant.now();
    }

    public void setDelivery(Fulfilment fulfilment, Long zoneId, String zoneName, int fee, String address, String landmark) {
        this.fulfilment = fulfilment;
        this.zoneId = zoneId;
        this.zoneName = zoneName;
        this.deliveryFee = fee;
        this.address = address;
        this.landmark = landmark;
    }

    public void setSchedule(LocalDate date, String timeSlot) {
        this.deliveryDate = date;
        this.timeSlot = timeSlot;
    }

    public void setGift(String recipientName, String recipientPhone, String note) {
        this.giftRecipientName = recipientName;
        this.giftRecipientPhone = recipientPhone;
        this.giftNote = note;
    }

    public void applyDiscount(int amount, String code) {
        this.discount = Math.max(0, Math.min(amount, subtotal));
        this.rewardCode = code;
        recalculate();
    }

    public void setAccountId(Long accountId) { this.accountId = accountId; }
    public void setRiderId(Long riderId) { this.riderId = riderId; }
    public Long getRiderId() { return riderId; }
    public Customer getCustomer() { return customer; }
    public Long getAccountId() { return accountId; }
    public int getDiscount() { return discount; }
    public String getRewardCode() { return rewardCode; }

    public void setNotes(String notes) { this.notes = notes; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getTrackingToken() { return trackingToken; }
    public String getCustomerName() { return customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public String getCustomerEmail() { return customerEmail; }
    public Fulfilment getFulfilment() { return fulfilment; }
    public Long getZoneId() { return zoneId; }
    public String getZoneName() { return zoneName; }
    public String getAddress() { return address; }
    public String getLandmark() { return landmark; }
    public LocalDate getDeliveryDate() { return deliveryDate; }
    public String getTimeSlot() { return timeSlot; }
    public String getGiftRecipientName() { return giftRecipientName; }
    public String getGiftRecipientPhone() { return giftRecipientPhone; }
    public String getGiftNote() { return giftNote; }
    public String getNotes() { return notes; }
    public int getSubtotal() { return subtotal; }
    public int getDeliveryFee() { return deliveryFee; }
    public int getTotal() { return total; }
    public OrderStatus getStatus() { return status; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public Instant getPaidAt() { return paidAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<OrderItem> getItems() { return items; }
    public List<OrderEvent> getEvents() { return events; }
    public List<PaymentReceipt> getReceipts() { return receipts; }

    public boolean isGift() {
        return giftRecipientName != null && !giftRecipientName.isBlank();
    }
}
