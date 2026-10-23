package com.pastryuniverse.kitchen;

import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.common.Ids;
import com.pastryuniverse.common.Phones;
import com.pastryuniverse.orders.Fulfilment;
import com.pastryuniverse.orders.Order;
import com.pastryuniverse.orders.OrderItem;
import com.pastryuniverse.orders.OrderRepository;
import com.pastryuniverse.orders.OrderService;
import com.pastryuniverse.orders.OrderStatus;
import com.pastryuniverse.orders.OrderViews;
import com.pastryuniverse.settings.SettingsService;
import com.pastryuniverse.settings.StoreSettings;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Rider links: the kitchen creates one per rider, and the rider opens it on their phone. */
@Service
public class RiderService {

    private final RiderRepository riders;
    private final OrderRepository orders;
    private final OrderService orderService;
    private final SettingsService settings;
    private final CalendarService calendar;

    public RiderService(RiderRepository riders, OrderRepository orders, OrderService orderService,
                        SettingsService settings, CalendarService calendar) {
        this.riders = riders;
        this.orders = orders;
        this.orderService = orderService;
        this.settings = settings;
        this.calendar = calendar;
    }

    public record RiderView(long id, String name, String phone, String token, Instant createdAt, Instant lastSeenAt) {}

    public record Stop(
            long id,
            String code,
            String timeSlot,
            String status,
            String statusLabel,
            String zone,
            String address,
            String landmark,
            String name,
            String phone,
            String phoneDisplay,
            boolean gift,
            String from,
            String giftNote,
            String notes,
            List<String> items,
            int itemCount,
            boolean mine) {}

    public record RiderDay(String rider, LocalDate date, LocalDate today, String kitchenPhone, List<Stop> stops) {}

    // Kitchen side -------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<RiderView> list() {
        return riders.findByActiveTrueOrderByCreatedAtAsc().stream().map(RiderService::view).toList();
    }

    @Transactional
    public RiderView create(String name, String phone) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) throw ApiException.badRequest("Enter the rider's name.");
        if (clean.length() > 80) clean = clean.substring(0, 80);
        String p = phone == null || phone.isBlank() ? null : Phones.normalize(phone);
        return view(riders.save(new Rider(Ids.trackingToken() + Ids.trackingToken().substring(0, 8), clean, p)));
    }

    @Transactional
    public void remove(long id) {
        riders.findById(id).ifPresent(Rider::deactivate);
    }

    // Rider side ---------------------------------------------------------------

    @Transactional
    public RiderDay day(String token, LocalDate date) {
        Rider rider = byToken(token);
        rider.seen();
        LocalDate today = calendar.today();
        LocalDate d = date == null ? today : date;
        if (d.isBefore(today.minusDays(1)) || d.isAfter(today.plusDays(7))) throw ApiException.badRequest("Pick a day this week.");
        StoreSettings s = settings.get();
        List<Stop> stops = KitchenService.sorted(orders.findByDeliveryDateAndStatusNot(d, OrderStatus.CANCELLED), s).stream()
                .filter(o -> o.getFulfilment() == Fulfilment.DELIVERY && KitchenService.PAID.contains(o.getStatus()))
                .map(o -> stop(o, rider))
                .toList();
        return new RiderDay(rider.getName(), d, today, s.phone(), stops);
    }

    @Transactional
    public Stop update(String token, long orderId, OrderStatus next) {
        Rider rider = byToken(token);
        LocalDate today = calendar.today();
        Order order = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order not found."));
        if (order.getDeliveryDate().isBefore(today.minusDays(1)) || order.getDeliveryDate().isAfter(today.plusDays(7))) {
            throw ApiException.notFound("Order not found.");
        }
        orderService.riderUpdate(orderId, next, rider.getId(), "Rider: " + rider.getName());
        return stop(order, rider);
    }

    private Rider byToken(String token) {
        return riders.findByTokenAndActiveTrue(token == null ? "" : token)
                .orElseThrow(() -> ApiException.notFound("This rider link isn't active. Ask the kitchen for a new one."));
    }

    private static Stop stop(Order o, Rider rider) {
        boolean gift = o.isGift();
        String phone = gift && o.getGiftRecipientPhone() != null ? o.getGiftRecipientPhone() : o.getCustomerPhone();
        List<String> items = o.getItems().stream().map(i -> i.getQuantity() + "× " + i.describe()).toList();
        int count = o.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
        return new Stop(o.getId(), o.getCode(), o.getTimeSlot(), o.getStatus().name(),
                OrderViews.label(o.getStatus(), o.getFulfilment()), o.getZoneName(), o.getAddress(), o.getLandmark(),
                gift ? o.getGiftRecipientName() : o.getCustomerName(), phone, Phones.display(phone),
                gift, gift ? o.getCustomerName() : null, gift ? o.getGiftNote() : null, o.getNotes(),
                items, count, rider.getId().equals(o.getRiderId()));
    }

    private static RiderView view(Rider r) {
        return new RiderView(r.getId(), r.getName(), Phones.display(r.getPhone()), r.getToken(), r.getCreatedAt(), r.getLastSeenAt());
    }
}
