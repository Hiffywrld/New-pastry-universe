package com.pastryuniverse.kitchen;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.common.Phones;
import com.pastryuniverse.orders.Customer;
import com.pastryuniverse.orders.CustomerRepository;
import com.pastryuniverse.orders.Order;
import com.pastryuniverse.orders.OrderItem;
import com.pastryuniverse.orders.OrderRepository;
import com.pastryuniverse.orders.OrderStatus;
import com.pastryuniverse.orders.OrderViews;
import com.pastryuniverse.orders.PaymentStatus;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The kitchen's customer list: who orders, how often, what they love. */
@Service
public class CustomerAdminService {

    private final NamedParameterJdbcTemplate jdbc;
    private final CustomerRepository customers;
    private final OrderRepository orders;
    private final ObjectMapper json;

    public CustomerAdminService(NamedParameterJdbcTemplate jdbc, CustomerRepository customers, OrderRepository orders, ObjectMapper json) {
        this.jdbc = jdbc;
        this.customers = customers;
        this.orders = orders;
        this.json = json;
    }

    public record Row(
            long id,
            String name,
            String phone,
            String email,
            String avatarUrl,
            int orders,
            long spent,
            Instant firstOrder,
            Instant lastOrder,
            String favourite,
            List<String> tags,
            boolean hasNotes,
            boolean signedIn,
            boolean noOrdersYet) {}

    public record Favourite(String product, int quantity) {}

    public record Detail(Row row, String notes, Instant joinedAt, long averageOrder, List<Favourite> favourites,
                         List<OrderViews.Summary> orders) {}

    private static final Map<String, String> SORTS = Map.of(
            "recent", "last_order desc nulls last, c.id desc",
            "spent", "spent desc, orders desc",
            "orders", "orders desc, spent desc",
            "name", "lower(c.name) asc");

    @Transactional(readOnly = true)
    public List<Row> list(String q, String sort) {
        String term = q == null ? "" : q.trim();
        String digits = term.replaceAll("\\D", "");
        if (digits.startsWith("0")) digits = "234" + digits.substring(1);
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("q", term)
                .addValue("like", "%" + term.toLowerCase(Locale.ROOT) + "%")
                .addValue("digits", digits.length() >= 3 ? "%" + digits + "%" : "");
        String order = SORTS.getOrDefault(sort == null ? "recent" : sort, SORTS.get("recent"));
        List<Row> rows = jdbc.query("""
                select c.id, c.name, c.phone, c.email, c.avatar_url, c.tags::text as tags,
                       (c.notes is not null and c.notes <> '') as has_notes,
                       count(o.id) filter (where o.status <> 'CANCELLED') as orders,
                       coalesce(sum(o.total) filter (where o.payment_status = 'CONFIRMED' and o.status <> 'CANCELLED'), 0) as spent,
                       min(o.created_at) as first_order,
                       max(o.created_at) as last_order,
                       (c.google_sub is not null or bool_or(o.account_id is not null)) as signed_in,
                       count(o.id) = 0 as no_orders
                from customers c
                left join orders o on o.customer_id = c.id
                where (:q = '' or lower(c.name) like :like or lower(coalesce(c.email, '')) like :like
                       or (:digits <> '' and regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') like :digits))
                group by c.id
                having count(o.id) > 0
                    or (c.google_sub is not null and not exists (select 1 from orders x where x.account_id = c.id))
                order by %s
                limit 500
                """.formatted(order), p, (rs, i) -> new Row(
                rs.getLong("id"), rs.getString("name"), Phones.display(rs.getString("phone")), rs.getString("email"),
                rs.getString("avatar_url"), rs.getInt("orders"), rs.getLong("spent"),
                instant(rs.getTimestamp("first_order")), instant(rs.getTimestamp("last_order")), null,
                tags(rs.getString("tags")), rs.getBoolean("has_notes"), rs.getBoolean("signed_in"), rs.getBoolean("no_orders")));
        Map<Long, String> fav = favourites();
        return rows.stream().map(r -> new Row(r.id(), r.name(), r.phone(), r.email(), r.avatarUrl(), r.orders(), r.spent(),
                r.firstOrder(), r.lastOrder(), fav.get(r.id()), r.tags(), r.hasNotes(), r.signedIn(), r.noOrdersYet())).toList();
    }

    @Transactional(readOnly = true)
    public Detail detail(long id) {
        Customer c = customers.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found."));
        List<Order> list = new ArrayList<>(orders.findByCustomerIdOrderByCreatedAtDesc(id));
        if (list.isEmpty()) list.addAll(orders.findTop20ByAccountIdOrderByCreatedAtDesc(id));
        List<Order> counted = list.stream().filter(o -> o.getStatus() != OrderStatus.CANCELLED).toList();
        long spent = counted.stream().filter(o -> o.getPaymentStatus() == PaymentStatus.CONFIRMED).mapToLong(Order::getTotal).sum();
        long paidCount = counted.stream().filter(o -> o.getPaymentStatus() == PaymentStatus.CONFIRMED).count();
        Map<String, Integer> byProduct = new LinkedHashMap<>();
        for (Order o : counted) for (OrderItem i : o.getItems()) byProduct.merge(i.getProductName(), i.getQuantity(), Integer::sum);
        List<Favourite> favs = byProduct.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5).map(e -> new Favourite(e.getKey(), e.getValue())).toList();
        Instant first = counted.stream().map(Order::getCreatedAt).min(Comparator.naturalOrder()).orElse(null);
        Instant last = counted.stream().map(Order::getCreatedAt).max(Comparator.naturalOrder()).orElse(null);
        boolean signedIn = c.getGoogleSub() != null || list.stream().anyMatch(o -> o.getAccountId() != null);
        Row row = new Row(c.getId(), c.getName(), Phones.display(c.getPhone()), c.getEmail(), c.getAvatarUrl(), counted.size(), spent,
                first, last, favs.isEmpty() ? null : favs.get(0).product(), c.getTags(),
                c.getNotes() != null && !c.getNotes().isBlank(), signedIn, list.isEmpty());
        return new Detail(row, c.getNotes(), c.getCreatedAt(), paidCount == 0 ? 0 : spent / paidCount, favs,
                list.stream().map(OrderViews::toSummary).toList());
    }

    @Transactional
    public Detail annotate(long id, String notes, List<String> tags) {
        Customer c = customers.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found."));
        String n = notes == null || notes.isBlank() ? null : notes.trim();
        if (n != null && n.length() > 2000) throw ApiException.badRequest("Keep notes under 2,000 characters.");
        Set<String> seen = new LinkedHashSet<>();
        List<String> clean = new ArrayList<>();
        for (String t : tags == null ? List.<String>of() : tags) {
            String v = t == null ? "" : t.trim().replaceAll("\\s+", " ");
            if (v.isEmpty()) continue;
            if (v.length() > 24) throw ApiException.badRequest("Keep each tag under 24 characters.");
            if (seen.add(v.toLowerCase(Locale.ROOT))) clean.add(v);
        }
        if (clean.size() > 8) throw ApiException.badRequest("Use up to 8 tags.");
        c.annotate(n, clean);
        customers.saveAndFlush(c);
        return detail(id);
    }

    /** Each customer's most-ordered treat. */
    private Map<Long, String> favourites() {
        Map<Long, String> out = new HashMap<>();
        jdbc.query("""
                select distinct on (o.customer_id) o.customer_id, i.product_name
                from orders o join order_items i on i.order_id = o.id
                where o.status <> 'CANCELLED'
                group by o.customer_id, i.product_name
                order by o.customer_id, sum(i.quantity) desc, i.product_name
                """, rs -> {
            out.put(rs.getLong("customer_id"), rs.getString("product_name"));
        });
        return out;
    }

    private List<String> tags(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            return json.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static Instant instant(Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}
