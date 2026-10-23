package com.pastryuniverse.analytics;

import com.pastryuniverse.common.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Receives anonymous page activity from the shop: no names, no cookies, just a random session id. */
@RestController
@RequestMapping("/api/events")
public class AnalyticsController {

    private static final Set<String> TYPES = Set.of("page_view", "product_view", "add_to_cart", "checkout_start", "heartbeat");

    private final JdbcTemplate jdbc;
    private final VisitorTracker visitors;
    private final RateLimiter limiter;

    public AnalyticsController(JdbcTemplate jdbc, VisitorTracker visitors, RateLimiter limiter) {
        this.jdbc = jdbc;
        this.visitors = visitors;
        this.limiter = limiter;
    }

    public record Event(String sessionId, String type, String path, String product, String referrer) {}

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void record(@RequestBody Event e, HttpServletRequest http) {
        if (e == null || e.sessionId() == null || e.sessionId().isBlank() || e.sessionId().length() > 64) return;
        if (!TYPES.contains(e.type())) return;
        limiter.check("events:" + http.getRemoteAddr(), 240, Duration.ofMinutes(1));
        visitors.touch(e.sessionId());
        if ("heartbeat".equals(e.type())) return;
        jdbc.update("INSERT INTO analytics_events (session_id, type, path, product_slug, referrer) VALUES (?, ?, ?, ?, ?)",
                e.sessionId(), e.type(), cut(e.path(), 200), cut(e.product(), 80), cut(e.referrer(), 300));
    }

    private static String cut(String s, int max) {
        if (s == null || s.isBlank()) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
