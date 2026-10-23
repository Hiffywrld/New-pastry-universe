package com.pastryuniverse.orders;

import com.pastryuniverse.common.Phones;
import com.pastryuniverse.settings.StoreSettings;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/** The shapes orders are sent to the browser in. */
public final class OrderViews {

    private OrderViews() {}

    public record Line(String slug, String name, String size, String option, int quantity, int unitPrice, int lineTotal) {}

    public record Step(String status, String label, Instant at, boolean done) {}

    public record Bank(String bankName, String accountName, String accountNumber) {}

    public record GiftView(String recipientName, String recipientPhone, String note) {}

    /** What the customer sees on their tracking page. */
    public record PublicOrder(
            String code,
            String token,
            String status,
            String statusLabel,
            String paymentStatus,
            String fulfilment,
            List<Line> items,
            int subtotal,
            int deliveryFee,
            int total,
            String zoneName,
            String address,
            String landmark,
            LocalDate deliveryDate,
            String timeSlot,
            String customerName,
            GiftView gift,
            String notes,
            boolean receiptUploaded,
            String rejectedReason,
            Bank bank,
            String pickupAddress,
            String whatsapp,
            List<Step> timeline,
            Instant createdAt) {}

    /** A card on the admin orders board. */
    public record Summary(
            long id,
            String code,
            String customerName,
            String customerPhone,
            int total,
            String status,
            String paymentStatus,
            String fulfilment,
            String zoneName,
            LocalDate deliveryDate,
            String timeSlot,
            int itemCount,
            String itemsText,
            boolean hasReceipt,
            boolean gift,
            Instant createdAt,
            Instant updatedAt) {}

    public record ReceiptView(long id, String contentType, long sizeBytes, Instant createdAt) {}

    public record EventView(String status, String label, String note, String actor, Instant at) {}

    /** Everything about an order, for staff. */
    public record Detail(
            Summary summary,
            String customerEmail,
            String address,
            String landmark,
            GiftView gift,
            String notes,
            List<Line> items,
            int subtotal,
            int deliveryFee,
            String trackingToken,
            Instant paidAt,
            List<ReceiptView> receipts,
            List<EventView> events) {}

    public static String label(OrderStatus s, Fulfilment f) {
        boolean pickup = f == Fulfilment.PICKUP;
        return switch (s) {
            case AWAITING_PAYMENT -> "Order placed";
            case PAYMENT_REVIEW -> "Checking payment";
            case CONFIRMED -> "Payment confirmed";
            case BAKING -> "In the oven";
            case READY -> pickup ? "Ready for pickup" : "Packed and ready";
            case OUT_FOR_DELIVERY -> "Out for delivery";
            case COMPLETED -> pickup ? "Collected" : "Delivered";
            case CANCELLED -> "Cancelled";
        };
    }

    static List<Line> lines(Order o) {
        return o.getItems().stream()
                .map(i -> new Line(i.getProductSlug(), i.getProductName(), i.getSizeLabel(), i.getOptionLabel(),
                        i.getQuantity(), i.getUnitPrice(), i.getLineTotal()))
                .toList();
    }

    static List<Step> timeline(Order o) {
        List<OrderStatus> steps = new ArrayList<>(List.of(
                OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_REVIEW, OrderStatus.CONFIRMED,
                OrderStatus.BAKING, OrderStatus.READY));
        if (o.getFulfilment() == Fulfilment.DELIVERY) steps.add(OrderStatus.OUT_FOR_DELIVERY);
        steps.add(OrderStatus.COMPLETED);
        int current = steps.indexOf(o.getStatus());
        List<Step> out = new ArrayList<>();
        for (int i = 0; i < steps.size(); i++) {
            OrderStatus st = steps.get(i);
            Instant at = null;
            for (OrderEvent e : o.getEvents()) if (e.getStatus() == st) at = e.getCreatedAt();
            boolean done = current >= 0 && i <= current;
            out.add(new Step(st.name(), label(st, o.getFulfilment()), done ? at : null, done));
        }
        return out;
    }

    public static PublicOrder toPublic(Order o, StoreSettings s) {
        boolean awaiting = o.getStatus() == OrderStatus.AWAITING_PAYMENT || o.getStatus() == OrderStatus.PAYMENT_REVIEW;
        Bank bank = awaiting && s.hasBankDetails() ? new Bank(s.bankName(), s.accountName(), s.accountNumber()) : null;
        String rejected = null;
        if (o.getPaymentStatus() == PaymentStatus.REJECTED) {
            for (OrderEvent e : o.getEvents()) if (e.getStatus() == OrderStatus.AWAITING_PAYMENT && e.getNote() != null) rejected = e.getNote();
        }
        String firstName = o.getCustomerName().trim().split("\\s+")[0];
        GiftView gift = o.isGift() ? new GiftView(o.getGiftRecipientName(), null, o.getGiftNote()) : null;
        return new PublicOrder(
                o.getCode(), o.getTrackingToken(), o.getStatus().name(), label(o.getStatus(), o.getFulfilment()),
                o.getPaymentStatus().name(), o.getFulfilment().name(), lines(o),
                o.getSubtotal(), o.getDeliveryFee(), o.getTotal(), o.getZoneName(), o.getAddress(), o.getLandmark(),
                o.getDeliveryDate(), o.getTimeSlot(), firstName, gift, o.getNotes(),
                !o.getReceipts().isEmpty(), rejected, bank,
                o.getFulfilment() == Fulfilment.PICKUP ? s.pickupAddress() : null,
                s.whatsapp(), timeline(o), o.getCreatedAt());
    }

    public static Summary toSummary(Order o) {
        int count = o.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
        String text = o.getItems().stream()
                .map(i -> i.getQuantity() + "× " + i.describe())
                .collect(Collectors.joining(", "));
        return new Summary(o.getId(), o.getCode(), o.getCustomerName(), Phones.display(o.getCustomerPhone()), o.getTotal(),
                o.getStatus().name(), o.getPaymentStatus().name(), o.getFulfilment().name(), o.getZoneName(),
                o.getDeliveryDate(), o.getTimeSlot(), count, text, !o.getReceipts().isEmpty(), o.isGift(),
                o.getCreatedAt(), o.getUpdatedAt());
    }

    public static Detail toDetail(Order o) {
        GiftView gift = o.isGift()
                ? new GiftView(o.getGiftRecipientName(), Phones.display(o.getGiftRecipientPhone()), o.getGiftNote())
                : null;
        List<ReceiptView> receipts = o.getReceipts().stream()
                .map(r -> new ReceiptView(r.getId(), r.getContentType(), r.getSizeBytes(), r.getCreatedAt()))
                .toList();
        List<EventView> events = o.getEvents().stream()
                .map(e -> new EventView(e.getStatus().name(), label(e.getStatus(), o.getFulfilment()), e.getNote(), e.getActor(), e.getCreatedAt()))
                .toList();
        return new Detail(toSummary(o), o.getCustomerEmail(), o.getAddress(), o.getLandmark(), gift, o.getNotes(),
                lines(o), o.getSubtotal(), o.getDeliveryFee(), o.getTrackingToken(), o.getPaidAt(), receipts, events);
    }
}
