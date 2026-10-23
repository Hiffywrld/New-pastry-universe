package com.pastryuniverse.kitchen;

import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.config.AppProperties;
import com.pastryuniverse.settings.SettingsService;
import com.pastryuniverse.settings.StoreSettings;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * How many orders each day can take. A day is full when it reaches its limit
 * (the shop-wide daily limit, or that day's own), and a delivery time is full
 * when it reaches the per-time limit. Cancelled orders don't count.
 */
@Service
public class CalendarService {

    private final NamedParameterJdbcTemplate jdbc;
    private final CalendarDayRepository days;
    private final SettingsService settings;
    private final AppProperties props;

    public CalendarService(NamedParameterJdbcTemplate jdbc, CalendarDayRepository days, SettingsService settings, AppProperties props) {
        this.jdbc = jdbc;
        this.days = days;
        this.settings = settings;
        this.props = props;
    }

    public record Slot(String label, int orders, boolean full) {}

    public record Day(
            LocalDate date,
            boolean closed,
            boolean weekdayClosed,
            String note,
            Integer limit,
            Integer customLimit,
            int orders,
            int paidOrders,
            long revenue,
            boolean full,
            List<Slot> slots) {}

    /** What the shop's date picker needs. */
    public record ShopCalendar(List<LocalDate> availableDates, List<LocalDate> fullDates, Map<String, List<String>> fullSlots) {}

    private record Count(int orders, int paid, long revenue) {}

    @Transactional(readOnly = true)
    public List<Day> range(StoreSettings s, LocalDate from, LocalDate to) {
        Map<LocalDate, Map<String, Count>> counts = counts(from, to);
        Map<LocalDate, CalendarDay> custom = days.findByDayBetween(from, to).stream()
                .collect(Collectors.toMap(CalendarDay::getDay, Function.identity()));
        List<Day> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            out.add(day(s, d, counts.getOrDefault(d, Map.of()), custom.get(d)));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public Day day(StoreSettings s, LocalDate date) {
        return range(s, date, date).get(0);
    }

    @Transactional(readOnly = true)
    public ShopCalendar forShop(StoreSettings s) {
        List<LocalDate> window = settings.availableDates(s);
        if (window.isEmpty()) return new ShopCalendar(List.of(), List.of(), Map.of());
        List<Day> all = range(s, window.get(0), window.get(window.size() - 1));
        List<LocalDate> open = new ArrayList<>();
        List<LocalDate> full = new ArrayList<>();
        Map<String, List<String>> fullSlots = new LinkedHashMap<>();
        for (Day d : all) {
            if (!window.contains(d.date()) || d.closed()) continue;
            boolean everySlotFull = d.slots().stream().allMatch(Slot::full);
            if (d.full() || everySlotFull) {
                full.add(d.date());
                continue;
            }
            open.add(d.date());
            List<String> taken = d.slots().stream().filter(Slot::full).map(Slot::label).toList();
            if (!taken.isEmpty()) fullSlots.put(d.date().toString(), taken);
        }
        return new ShopCalendar(open, full, fullSlots);
    }

    /**
     * Checks a new order still fits, holding a lock on that day until the
     * order is saved so two people can't take the last spot at once.
     * Must run inside the transaction that saves the order.
     */
    public void checkBookable(StoreSettings s, LocalDate date, String slot) {
        jdbc.getJdbcTemplate().queryForObject("select 1 from (select pg_advisory_xact_lock(?)) l", Integer.class, 7_700_000L + date.toEpochDay());
        if (!settings.availableDates(s).contains(date)) throw ApiException.badRequest("That date isn't available. Pick another day.");
        if (!s.timeSlotsOrDefault().contains(slot)) throw ApiException.badRequest("Pick one of the available times.");
        Day d = day(s, date);
        if (d.closed()) throw ApiException.conflict("We're closed that day. Pick another day.");
        if (d.full()) throw ApiException.conflict("That day is fully booked. Pick another day.");
        boolean slotFull = d.slots().stream().anyMatch(x -> x.label().equals(slot) && x.full());
        if (slotFull) throw ApiException.conflict("That time is fully booked. Pick another time or day.");
    }

    @Transactional
    public Day setDay(StoreSettings s, LocalDate date, boolean closed, Integer maxOrders, String note) {
        if (maxOrders != null && maxOrders < 0) throw ApiException.badRequest("The limit can't be below zero.");
        String cleanNote = note == null || note.isBlank() ? null : note.trim();
        if (cleanNote != null && cleanNote.length() > 160) cleanNote = cleanNote.substring(0, 160);
        CalendarDay row = days.findById(date).orElseGet(() -> new CalendarDay(date));
        row.update(closed, maxOrders, cleanNote);
        if (row.isDefault()) {
            if (days.existsById(date)) days.delete(row);
        } else {
            days.save(row);
        }
        days.flush();
        return day(s, date);
    }

    private Day day(StoreSettings s, LocalDate d, Map<String, Count> bySlot, CalendarDay custom) {
        boolean weekdayClosed = s.closedWeekdaysOrEmpty().contains(d.getDayOfWeek().getValue());
        Integer customLimit = custom == null ? null : custom.getMaxOrders();
        Integer limit = customLimit != null ? customLimit : s.dailyLimitOrNull();
        int orders = bySlot.values().stream().mapToInt(Count::orders).sum();
        int paid = bySlot.values().stream().mapToInt(Count::paid).sum();
        long revenue = bySlot.values().stream().mapToLong(Count::revenue).sum();
        boolean full = limit != null && orders >= limit;
        Integer slotLimit = s.slotLimitOrNull();
        List<String> labels = new ArrayList<>(s.timeSlotsOrDefault());
        // Orders booked for a time that has since been removed still show up.
        bySlot.keySet().stream().filter(k -> !labels.contains(k)).forEach(labels::add);
        List<Slot> slots = labels.stream().map(label -> {
            int n = bySlot.getOrDefault(label, new Count(0, 0, 0)).orders();
            return new Slot(label, n, full || (slotLimit != null && n >= slotLimit));
        }).toList();
        boolean closed = weekdayClosed || (custom != null && custom.isClosed());
        return new Day(d, closed, weekdayClosed, custom == null ? null : custom.getNote(), limit, customLimit,
                orders, paid, revenue, full, slots);
    }

    private Map<LocalDate, Map<String, Count>> counts(LocalDate from, LocalDate to) {
        Map<LocalDate, Map<String, Count>> out = new HashMap<>();
        jdbc.query("""
                select delivery_date, time_slot, count(*) as orders,
                       count(*) filter (where payment_status = 'CONFIRMED') as paid,
                       coalesce(sum(total) filter (where payment_status = 'CONFIRMED'), 0) as revenue
                from orders
                where status <> 'CANCELLED' and delivery_date between :from and :to
                group by delivery_date, time_slot
                """, new MapSqlParameterSource().addValue("from", from).addValue("to", to), rs -> {
            LocalDate d = rs.getObject("delivery_date", LocalDate.class);
            out.computeIfAbsent(d, k -> new HashMap<>())
                    .put(rs.getString("time_slot"), new Count(rs.getInt("orders"), rs.getInt("paid"), rs.getLong("revenue")));
        });
        return out;
    }

    public LocalDate today() {
        return LocalDate.now(props.zone());
    }
}
