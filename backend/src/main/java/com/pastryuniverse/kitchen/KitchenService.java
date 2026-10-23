package com.pastryuniverse.kitchen;

import com.pastryuniverse.orders.Order;
import com.pastryuniverse.orders.OrderItem;
import com.pastryuniverse.orders.OrderRepository;
import com.pastryuniverse.orders.OrderStatus;
import com.pastryuniverse.orders.OrderViews;
import com.pastryuniverse.settings.SettingsService;
import com.pastryuniverse.settings.StoreSettings;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The baking plan: what to make for a day, added up from that day's orders. */
@Service
public class KitchenService {

    static final Set<OrderStatus> PAID = EnumSet.of(OrderStatus.CONFIRMED, OrderStatus.BAKING, OrderStatus.READY,
            OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED);
    static final Set<OrderStatus> BAKED = EnumSet.of(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED);
    static final Set<OrderStatus> UNPAID = EnumSet.of(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_REVIEW);

    private final OrderRepository orders;
    private final SettingsService settings;
    private final CalendarService calendar;

    public KitchenService(OrderRepository orders, SettingsService settings, CalendarService calendar) {
        this.orders = orders;
        this.settings = settings;
        this.calendar = calendar;
    }

    /** One line of the plan: e.g. 6 × Banana Bread, Medium, Raisins (2 already baked). */
    public record Total(String slug, String product, String size, String option, int quantity, int baked, int orders) {}

    public record DayPlan(LocalDate date, CalendarService.Day capacity, List<Total> toBake, List<Total> unpaid,
                          List<OrderViews.Detail> orders) {}

    @Transactional(readOnly = true)
    public DayPlan day(LocalDate date) {
        StoreSettings s = settings.get();
        List<Order> list = sorted(orders.findByDeliveryDateAndStatusNot(date, OrderStatus.CANCELLED), s);
        return new DayPlan(date, calendar.day(s, date),
                totals(list.stream().filter(o -> PAID.contains(o.getStatus())).toList()),
                totals(list.stream().filter(o -> UNPAID.contains(o.getStatus())).toList()),
                list.stream().map(OrderViews::toDetail).toList());
    }

    /** Orders in delivery-time order, then by when they were placed. */
    static List<Order> sorted(List<Order> list, StoreSettings s) {
        List<String> slots = s.timeSlotsOrDefault();
        List<Order> out = new ArrayList<>(list);
        out.sort(Comparator.<Order>comparingInt(o -> {
                    int i = slots.indexOf(o.getTimeSlot());
                    return i < 0 ? slots.size() : i;
                })
                .thenComparing(Order::getCreatedAt));
        return out;
    }

    private static List<Total> totals(List<Order> list) {
        record Key(String slug, String product, String size, String option) {}
        Map<Key, int[]> sums = new LinkedHashMap<>();
        for (Order o : list) {
            boolean baked = BAKED.contains(o.getStatus());
            for (OrderItem i : o.getItems()) {
                Key k = new Key(i.getProductSlug(), i.getProductName(), i.getSizeLabel(), i.getOptionLabel());
                int[] v = sums.computeIfAbsent(k, x -> new int[3]);
                v[0] += i.getQuantity();
                if (baked) v[1] += i.getQuantity();
                v[2] += 1;
            }
        }
        return sums.entrySet().stream()
                .map(e -> new Total(e.getKey().slug(), e.getKey().product(), e.getKey().size(), e.getKey().option(),
                        e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .sorted(Comparator.comparing(Total::product).thenComparing(Total::size).thenComparing(Total::option))
                .toList();
    }
}
