package com.pastryuniverse.kitchen;

import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.orders.OrderService;
import com.pastryuniverse.orders.OrderStatus;
import com.pastryuniverse.orders.OrderViews;
import com.pastryuniverse.settings.SettingsService;
import com.pastryuniverse.settings.StoreSettings;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Kitchen tools: the calendar, baking plan, riders and customers. */
@RestController
@RequestMapping("/api/admin")
public class KitchenController {

    private final CalendarService calendar;
    private final KitchenService kitchen;
    private final RiderService riders;
    private final CustomerAdminService customers;
    private final SettingsService settings;
    private final OrderService orders;

    public KitchenController(CalendarService calendar, KitchenService kitchen, RiderService riders,
                             CustomerAdminService customers, SettingsService settings, OrderService orders) {
        this.calendar = calendar;
        this.kitchen = kitchen;
        this.riders = riders;
        this.customers = customers;
        this.settings = settings;
        this.orders = orders;
    }

    // Calendar ------------------------------------------------------------------

    public record CalendarView(LocalDate today, Integer dailyLimit, Integer slotLimit, List<String> timeSlots,
                               List<CalendarService.Day> days) {}

    @GetMapping("/calendar")
    public CalendarView calendar(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate today = calendar.today();
        LocalDate start = from == null ? today.minusDays(3) : from;
        LocalDate end = to == null ? start.plusDays(30) : to;
        if (end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > 92) throw ApiException.badRequest("Pick up to three months at a time.");
        StoreSettings s = settings.get();
        return new CalendarView(today, s.dailyLimitOrNull(), s.slotLimitOrNull(), s.timeSlotsOrDefault(), calendar.range(s, start, end));
    }

    public record DayRequest(Boolean closed, Integer maxOrders, String note) {}

    @PutMapping("/calendar/days/{date}")
    public CalendarService.Day setDay(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date, @RequestBody DayRequest req) {
        if (date.isBefore(calendar.today())) throw ApiException.badRequest("That day has passed.");
        return calendar.setDay(settings.get(), date, Boolean.TRUE.equals(req.closed()), req.maxOrders(), req.note());
    }

    public record LimitsRequest(Integer dailyLimit, Integer slotLimit) {}

    @PutMapping("/calendar/limits")
    @PreAuthorize("hasRole('OWNER')")
    public CalendarView setLimits(@RequestBody LimitsRequest req) {
        if ((req.dailyLimit() != null && req.dailyLimit() < 0) || (req.slotLimit() != null && req.slotLimit() < 0)) {
            throw ApiException.badRequest("Limits can't be below zero.");
        }
        settings.update(settings.get().withLimits(req.dailyLimit(), req.slotLimit()));
        return calendar(null, null);
    }

    // Baking plan ---------------------------------------------------------------

    @GetMapping("/day")
    public KitchenService.DayPlan day(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return kitchen.day(date == null ? calendar.today() : date);
    }

    public record BulkRequest(List<Long> ids, OrderStatus status) {}

    @PostMapping("/orders/bulk-status")
    public List<OrderViews.Summary> bulk(@RequestBody BulkRequest req, @AuthenticationPrincipal Jwt me) {
        if (req.status() == null) throw ApiException.badRequest("Choose a status.");
        return orders.bulkStatus(req.ids(), req.status(), actor(me));
    }

    // Riders --------------------------------------------------------------------

    @GetMapping("/riders")
    public List<RiderService.RiderView> riders() {
        return riders.list();
    }

    public record RiderRequest(String name, String phone) {}

    @PostMapping("/riders")
    public RiderService.RiderView addRider(@RequestBody RiderRequest req) {
        return riders.create(req.name(), req.phone());
    }

    @DeleteMapping("/riders/{id}")
    public void removeRider(@PathVariable long id) {
        riders.remove(id);
    }

    // Customers -----------------------------------------------------------------

    @GetMapping("/customers")
    public List<CustomerAdminService.Row> customers(@RequestParam(required = false) String q, @RequestParam(required = false) String sort) {
        return customers.list(q, sort);
    }

    @GetMapping("/customers/{id}")
    public CustomerAdminService.Detail customer(@PathVariable long id) {
        return customers.detail(id);
    }

    public record NotesRequest(String notes, List<String> tags) {}

    @PutMapping("/customers/{id}")
    public CustomerAdminService.Detail annotate(@PathVariable long id, @RequestBody NotesRequest req) {
        return customers.annotate(id, req.notes(), req.tags());
    }

    private static String actor(Jwt me) {
        String name = me.getClaimAsString("name");
        return name == null || name.isBlank() ? me.getClaimAsString("email") : name;
    }
}
