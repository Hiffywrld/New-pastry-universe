package com.pastryuniverse.admin;

import com.pastryuniverse.analytics.DashboardService;
import com.pastryuniverse.analytics.VisitorTracker;
import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.config.AppProperties;
import com.pastryuniverse.live.LiveHub;
import com.pastryuniverse.orders.OrderService;
import com.pastryuniverse.orders.OrderStatus;
import com.pastryuniverse.orders.OrderViews;
import com.pastryuniverse.orders.PaymentReceipt;
import com.pastryuniverse.settings.SettingsService;
import com.pastryuniverse.settings.StoreSettings;
import com.pastryuniverse.storage.FileStorage;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final OrderService orders;
    private final DashboardService dashboard;
    private final SettingsService settings;
    private final FileStorage storage;
    private final LiveHub live;
    private final VisitorTracker visitors;
    private final AppProperties props;

    public AdminController(OrderService orders, DashboardService dashboard, SettingsService settings, FileStorage storage,
                           LiveHub live, VisitorTracker visitors, AppProperties props) {
        this.orders = orders;
        this.dashboard = dashboard;
        this.settings = settings;
        this.storage = storage;
        this.live = live;
        this.visitors = visitors;
        this.props = props;
    }

    @GetMapping("/dashboard")
    public DashboardService.Dashboard dashboard() {
        return dashboard.build();
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return live.openAdmin(Map.of("visitors", visitors.count()));
    }

    // Orders -----------------------------------------------------------------

    /** Open orders, plus orders finished today, for the orders board. */
    @GetMapping("/orders")
    public List<OrderViews.Summary> board() {
        return orders.board(LocalDate.now(props.zone()).atStartOfDay(props.zone()).toInstant());
    }

    @GetMapping("/orders/recent")
    public List<OrderViews.Summary> recent() {
        return orders.recent();
    }

    @GetMapping("/orders/{id}")
    public OrderViews.Detail order(@PathVariable long id) {
        return orders.detail(id);
    }

    public record StatusRequest(OrderStatus status, String note) {}

    @PostMapping("/orders/{id}/status")
    public OrderViews.Detail status(@PathVariable long id, @RequestBody StatusRequest req, @AuthenticationPrincipal Jwt me) {
        if (req.status() == null) throw ApiException.badRequest("Choose a status.");
        return orders.changeStatus(id, req.status(), req.note(), actor(me));
    }

    @PostMapping("/orders/{id}/payment/confirm")
    public OrderViews.Detail confirm(@PathVariable long id, @AuthenticationPrincipal Jwt me) {
        return orders.confirmPayment(id, actor(me));
    }

    public record RejectRequest(String reason) {}

    @PostMapping("/orders/{id}/payment/reject")
    public OrderViews.Detail reject(@PathVariable long id, @RequestBody(required = false) RejectRequest req, @AuthenticationPrincipal Jwt me) {
        return orders.rejectPayment(id, req == null ? null : req.reason(), actor(me));
    }

    @GetMapping("/orders/{id}/receipts/{receiptId}")
    public ResponseEntity<Resource> receipt(@PathVariable long id, @PathVariable long receiptId) {
        PaymentReceipt r = orders.receipt(id, receiptId);
        Resource file = storage.load(r.getStorageKey());
        if (!file.exists()) throw ApiException.notFound("The receipt file is missing.");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(r.getContentType()))
                .cacheControl(CacheControl.noStore())
                .body(file);
    }

    // Settings ---------------------------------------------------------------

    @GetMapping("/settings")
    public StoreSettings getSettings() {
        return settings.get();
    }

    @PutMapping("/settings")
    @PreAuthorize("hasRole('OWNER')")
    public StoreSettings putSettings(@RequestBody StoreSettings next) {
        return settings.update(next);
    }

    private static String actor(Jwt me) {
        String name = me.getClaimAsString("name");
        return name == null || name.isBlank() ? me.getClaimAsString("email") : name;
    }
}
