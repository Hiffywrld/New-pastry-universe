package com.pastryuniverse.analytics;

import com.pastryuniverse.config.AppProperties;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private final NamedParameterJdbcTemplate jdbc;
    private final VisitorTracker visitors;
    private final AppProperties props;

    public DashboardService(NamedParameterJdbcTemplate jdbc, VisitorTracker visitors, AppProperties props) {
        this.jdbc = jdbc;
        this.visitors = visitors;
        this.props = props;
    }

    public record Kpis(long salesToday, long paidOrdersToday, long salesYesterday, long ordersToday,
                       long awaitingReview, long awaitingPayment, long dueTomorrow, int visitorsNow,
                       long signupsToday, long gamesToday) {}

    public record DayPoint(LocalDate day, long revenue, long orders) {}

    public record Seller(String name, String slug, long quantity, long revenue) {}

    public record Area(String name, long orders, long revenue) {}

    public record FunnelStep(String key, String label, long count) {}

    public record Dashboard(Kpis kpis, List<DayPoint> revenue, List<Seller> bestSellers, List<Area> topAreas,
                            List<FunnelStep> funnel, Instant generatedAt) {}

    @Transactional(readOnly = true)
    public Dashboard build() {
        ZoneId zone = props.zone();
        LocalDate today = LocalDate.now(zone);
        Timestamp todayStart = ts(today.atStartOfDay(zone).toInstant());
        Timestamp yesterdayStart = ts(today.minusDays(1).atStartOfDay(zone).toInstant());
        Timestamp since14 = ts(today.minusDays(13).atStartOfDay(zone).toInstant());
        Timestamp since30 = ts(today.minusDays(29).atStartOfDay(zone).toInstant());

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("today", todayStart)
                .addValue("yesterday", yesterdayStart)
                .addValue("since14", since14)
                .addValue("since30", since30)
                .addValue("tz", zone.getId())
                .addValue("tomorrow", today.plusDays(1));

        Map<String, Object> sales = jdbc.queryForMap("""
                SELECT COALESCE(SUM(total) FILTER (WHERE paid_at >= :today), 0) AS sales_today,
                       COUNT(*) FILTER (WHERE paid_at >= :today) AS paid_today,
                       COALESCE(SUM(total) FILTER (WHERE paid_at >= :yesterday AND paid_at < :today), 0) AS sales_yesterday
                FROM orders WHERE status <> 'CANCELLED' AND paid_at >= :yesterday
                """, p);
        Map<String, Object> counts = jdbc.queryForMap("""
                SELECT COUNT(*) FILTER (WHERE created_at >= :today AND status <> 'CANCELLED') AS orders_today,
                       COUNT(*) FILTER (WHERE status = 'PAYMENT_REVIEW') AS awaiting_review,
                       COUNT(*) FILTER (WHERE status = 'AWAITING_PAYMENT') AS awaiting_payment,
                       COUNT(*) FILTER (WHERE delivery_date = :tomorrow AND status IN ('CONFIRMED','BAKING','READY')) AS due_tomorrow
                FROM orders
                """, p);
        Map<String, Object> accounts = jdbc.queryForMap(
                "SELECT (SELECT COUNT(*) FROM customers WHERE google_sub IS NOT NULL AND created_at >= :today) AS signups, "
                        + "(SELECT COUNT(*) FROM game_sessions WHERE started_at >= :today) AS games", p);
        Kpis kpis = new Kpis(num(sales.get("sales_today")), num(sales.get("paid_today")), num(sales.get("sales_yesterday")),
                num(counts.get("orders_today")), num(counts.get("awaiting_review")), num(counts.get("awaiting_payment")),
                num(counts.get("due_tomorrow")), visitors.count(), num(accounts.get("signups")), num(accounts.get("games")));

        Map<LocalDate, DayPoint> byDay = new HashMap<>();
        jdbc.query("""
                SELECT (paid_at AT TIME ZONE :tz)::date AS day, SUM(total) AS revenue, COUNT(*) AS orders
                FROM orders WHERE paid_at >= :since14 AND status <> 'CANCELLED'
                GROUP BY 1
                """, p, rs -> {
            LocalDate d = rs.getDate("day").toLocalDate();
            byDay.put(d, new DayPoint(d, rs.getLong("revenue"), rs.getLong("orders")));
        });
        List<DayPoint> revenue = new ArrayList<>();
        for (int i = 13; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            revenue.add(byDay.getOrDefault(d, new DayPoint(d, 0, 0)));
        }

        List<Seller> sellers = jdbc.query("""
                SELECT oi.product_name, oi.product_slug, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue
                FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE o.paid_at >= :since30 AND o.status <> 'CANCELLED'
                GROUP BY oi.product_name, oi.product_slug ORDER BY qty DESC LIMIT 6
                """, p, (rs, i) -> new Seller(rs.getString(1), rs.getString(2), rs.getLong(3), rs.getLong(4)));

        List<Area> areas = jdbc.query("""
                SELECT COALESCE(zone_name, 'Pickup') AS name, COUNT(*) AS orders, SUM(total) AS revenue
                FROM orders WHERE paid_at >= :since30 AND status <> 'CANCELLED'
                GROUP BY 1 ORDER BY orders DESC, revenue DESC LIMIT 6
                """, p, (rs, i) -> new Area(rs.getString(1), rs.getLong(2), rs.getLong(3)));

        Map<String, Long> sessions = new HashMap<>();
        jdbc.query("""
                SELECT type, COUNT(DISTINCT session_id) AS n FROM analytics_events
                WHERE created_at >= :today GROUP BY type
                """, p, rs -> {
            sessions.put(rs.getString("type"), rs.getLong("n"));
        });
        List<FunnelStep> funnel = List.of(
                new FunnelStep("visited", "Visited", sessions.getOrDefault("page_view", 0L)),
                new FunnelStep("viewed", "Looked at a treat", sessions.getOrDefault("product_view", 0L)),
                new FunnelStep("cart", "Added to cart", sessions.getOrDefault("add_to_cart", 0L)),
                new FunnelStep("checkout", "Started checkout", sessions.getOrDefault("checkout_start", 0L)),
                new FunnelStep("ordered", "Placed an order", kpis.ordersToday()),
                new FunnelStep("paid", "Paid", kpis.paidOrdersToday()));

        return new Dashboard(kpis, revenue, sellers, areas, funnel, Instant.now());
    }

    private static Timestamp ts(Instant i) {
        return Timestamp.from(i);
    }

    private static long num(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }
}
