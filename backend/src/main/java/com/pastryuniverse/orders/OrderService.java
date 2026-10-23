package com.pastryuniverse.orders;

import com.pastryuniverse.accounts.Reward;
import com.pastryuniverse.accounts.RewardRepository;
import com.pastryuniverse.catalog.DeliveryZone;
import com.pastryuniverse.catalog.DeliveryZoneRepository;
import com.pastryuniverse.catalog.Variant;
import com.pastryuniverse.catalog.VariantRepository;
import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.common.Ids;
import com.pastryuniverse.common.Phones;
import com.pastryuniverse.kitchen.CalendarService;
import com.pastryuniverse.live.LiveHub;
import com.pastryuniverse.settings.SettingsService;
import com.pastryuniverse.settings.StoreSettings;
import com.pastryuniverse.storage.FileStorage;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class OrderService {

    private static final Map<String, String> RECEIPT_TYPES = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp",
            "image/heic", "heic", "image/heif", "heif", "application/pdf", "pdf");

    private final OrderRepository orders;
    private final CustomerRepository customers;
    private final VariantRepository variants;
    private final DeliveryZoneRepository zones;
    private final SettingsService settings;
    private final FileStorage storage;
    private final LiveHub live;
    private final RewardRepository rewards;
    private final CalendarService calendar;

    public OrderService(OrderRepository orders, CustomerRepository customers, VariantRepository variants,
                        DeliveryZoneRepository zones, SettingsService settings, FileStorage storage, LiveHub live,
                        RewardRepository rewards, CalendarService calendar) {
        this.rewards = rewards;
        this.calendar = calendar;
        this.orders = orders;
        this.customers = customers;
        this.variants = variants;
        this.zones = zones;
        this.settings = settings;
        this.storage = storage;
        this.live = live;
    }

    // Customer side ---------------------------------------------------------

    @Transactional
    public OrderViews.PublicOrder create(CreateOrderRequest req, Long accountId) {
        StoreSettings s = settings.get();
        if (!s.acceptsOrders()) throw ApiException.conflict("The shop isn't taking orders right now. Please check back soon.");

        // Merge repeated lines and price everything on the server.
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (CreateOrderRequest.Item item : req.items()) quantities.merge(item.variantId(), item.quantity(), Integer::sum);
        Map<Long, Variant> found = variants.findWithProduct(quantities.keySet()).stream()
                .collect(Collectors.toMap(Variant::getId, Function.identity()));
        for (Long id : quantities.keySet()) {
            Variant v = found.get(id);
            if (v == null) throw ApiException.badRequest("Something in your cart is no longer on the menu. Remove it and try again.");
            if (!v.isBuyable()) throw ApiException.conflict(v.getProduct().getName() + " (" + v.getSizeLabel() + ") is sold out. Remove it to continue.");
        }

        String phone = Phones.normalize(req.customer().phone());
        String name = req.customer().name().trim();
        String email = blankToNull(req.customer().email());
        Customer customer = customers.findByPhone(phone).orElseGet(() -> new Customer(name, phone, email));
        customer.refresh(name, email);
        customer = customers.save(customer);

        Order order = new Order(uniqueCode(), Ids.trackingToken(), customer);

        if (req.fulfilment() == Fulfilment.DELIVERY) {
            if (req.zoneId() == null) throw ApiException.badRequest("Choose your delivery area.");
            DeliveryZone zone = zones.findById(req.zoneId()).filter(DeliveryZone::isActive)
                    .orElseThrow(() -> ApiException.badRequest("Choose a delivery area from the list."));
            String address = blankToNull(req.address());
            if (address == null) throw ApiException.badRequest("Enter the delivery address.");
            order.setDelivery(Fulfilment.DELIVERY, zone.getId(), zone.getName(), zone.getFee(), address, blankToNull(req.landmark()));
        } else {
            order.setDelivery(Fulfilment.PICKUP, null, null, 0, null, null);
        }

        calendar.checkBookable(s, req.deliveryDate(), req.timeSlot());
        order.setSchedule(req.deliveryDate(), req.timeSlot());

        if (req.gift() != null && blankToNull(req.gift().recipientName()) != null) {
            String giftPhone = blankToNull(req.gift().recipientPhone()) == null ? null : Phones.normalize(req.gift().recipientPhone());
            order.setGift(req.gift().recipientName().trim(), giftPhone, blankToNull(req.gift().note()));
        }
        order.setNotes(blankToNull(req.notes()));
        order.setSessionId(blankToNull(req.sessionId()));

        quantities.forEach((id, qty) -> {
            Variant v = found.get(id);
            order.addItem(new OrderItem(order, v.getId(), v.getProduct().getId(), v.getProduct().getSlug(),
                    v.getProduct().getName(), v.getSizeLabel(), v.getOptionLabel(), v.getPrice(), qty));
        });
        order.recalculate();
        order.setAccountId(accountId);

        Reward reward = null;
        if (Boolean.TRUE.equals(req.useReward())) {
            if (accountId == null) throw ApiException.badRequest("Sign in to use your welcome discount.");
            reward = rewards.findByAccountId(accountId).filter(r -> r.isUsable(Instant.now()))
                    .orElseThrow(() -> ApiException.conflict("Your welcome discount has expired or was already used."));
            if (rewards.existsByRedeemedPhone(phone)) {
                throw ApiException.conflict("This phone number has already used a welcome discount.");
            }
            order.applyDiscount(reward.discountFor(order.getSubtotal()), reward.getCode());
        }

        order.moveTo(OrderStatus.AWAITING_PAYMENT, null, "Customer");
        Order saved = orders.save(order);
        if (reward != null) reward.redeem(saved.getId(), phone);

        OrderViews.Summary summary = OrderViews.toSummary(saved);
        LiveHub.afterCommit(() -> live.toAdmins("order", Map.of("kind", "created", "order", summary)));
        return OrderViews.toPublic(saved, s);
    }

    @Transactional(readOnly = true)
    public OrderViews.PublicOrder track(String token) {
        return OrderViews.toPublic(byToken(token), settings.get());
    }

    @Transactional(readOnly = true)
    public String lookup(String code, String phone) {
        String normalized = Phones.normalize(phone);
        return orders.findByCodeIgnoreCase(code == null ? "" : code.trim())
                .filter(o -> o.getCustomerPhone().equals(normalized))
                .map(Order::getTrackingToken)
                .orElseThrow(() -> ApiException.notFound("We couldn't find an order with that code and phone number."));
    }

    @Transactional
    public OrderViews.PublicOrder uploadReceipt(String token, MultipartFile file) {
        Order order = byToken(token);
        if (order.getStatus() != OrderStatus.AWAITING_PAYMENT && order.getStatus() != OrderStatus.PAYMENT_REVIEW) {
            throw ApiException.conflict("This order's payment is already confirmed.");
        }
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Choose a screenshot or PDF of your transfer receipt.");
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        String ext = RECEIPT_TYPES.get(type);
        if (ext == null) throw ApiException.badRequest("Upload a photo (JPG, PNG, HEIC) or a PDF of the receipt.");

        String key;
        try (InputStream in = file.getInputStream()) {
            key = storage.save("receipts/" + order.getCode(), ext, in);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "We couldn't save that file. Please try again.");
        }
        order.addReceipt(new PaymentReceipt(order, key, type, file.getSize(), file.getOriginalFilename()));
        order.setPaymentStatus(PaymentStatus.RECEIPT_UPLOADED);
        if (order.getStatus() != OrderStatus.PAYMENT_REVIEW) order.moveTo(OrderStatus.PAYMENT_REVIEW, "Receipt uploaded", "Customer");

        publish(order, "receipt");
        return OrderViews.toPublic(order, settings.get());
    }

    // Staff side --------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<OrderViews.Summary> board(Instant completedSince) {
        Set<OrderStatus> open = EnumSet.of(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_REVIEW, OrderStatus.CONFIRMED,
                OrderStatus.BAKING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY);
        return orders.findBoard(open, completedSince).stream().map(OrderViews::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public List<OrderViews.Summary> recent() {
        return orders.findRecent().stream().map(OrderViews::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public OrderViews.Detail detail(long id) {
        return OrderViews.toDetail(byId(id));
    }

    @Transactional
    public OrderViews.Detail changeStatus(long id, OrderStatus next, String note, String actor) {
        Order order = byId(id);
        if (next == order.getStatus()) return OrderViews.toDetail(order);
        if (next == OrderStatus.AWAITING_PAYMENT || next == OrderStatus.PAYMENT_REVIEW) {
            throw ApiException.badRequest("Payment steps change when the customer uploads a receipt or you confirm it.");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) throw ApiException.conflict("This order was cancelled.");
        // Moving an order forward means the money is in, e.g. cash on pickup.
        boolean needsPayment = next != OrderStatus.CANCELLED && order.getPaymentStatus() != PaymentStatus.CONFIRMED;
        if (needsPayment) order.markPaid(Instant.now());
        order.moveTo(next, blankToNull(note), actor);
        if (next == OrderStatus.CANCELLED && order.getRewardCode() != null) {
            rewards.findByCode(order.getRewardCode()).ifPresent(Reward::restore);
        }
        publish(order, "status");
        return OrderViews.toDetail(order);
    }

    @Transactional
    public OrderViews.Detail confirmPayment(long id, String actor) {
        Order order = byId(id);
        if (order.getPaymentStatus() == PaymentStatus.CONFIRMED) return OrderViews.toDetail(order);
        if (order.getStatus() == OrderStatus.CANCELLED) throw ApiException.conflict("This order was cancelled.");
        order.markPaid(Instant.now());
        order.moveTo(OrderStatus.CONFIRMED, "Payment received", actor);
        publish(order, "payment");
        return OrderViews.toDetail(order);
    }

    @Transactional
    public OrderViews.Detail rejectPayment(long id, String reason, String actor) {
        Order order = byId(id);
        if (order.getPaymentStatus() == PaymentStatus.CONFIRMED) throw ApiException.conflict("This payment is already confirmed.");
        order.setPaymentStatus(PaymentStatus.REJECTED);
        String note = blankToNull(reason) == null ? "We couldn't find your payment. Check the amount and upload the receipt again." : reason.trim();
        order.moveTo(OrderStatus.AWAITING_PAYMENT, note, actor);
        publish(order, "payment");
        return OrderViews.toDetail(order);
    }

    /** A rider marking a delivery as picked up or delivered from their link. */
    @Transactional
    public OrderViews.Detail riderUpdate(long id, OrderStatus next, long riderId, String actor) {
        Order order = byId(id);
        if (order.getFulfilment() != Fulfilment.DELIVERY) throw ApiException.badRequest("This order is for pickup.");
        if (next != OrderStatus.OUT_FOR_DELIVERY && next != OrderStatus.COMPLETED) throw ApiException.badRequest("Riders can only mark orders as picked up or delivered.");
        if (order.getStatus() == OrderStatus.CANCELLED) throw ApiException.conflict("This order was cancelled. Call the kitchen.");
        if (order.getPaymentStatus() != PaymentStatus.CONFIRMED) throw ApiException.conflict("This order isn't paid yet. Call the kitchen before you take it.");
        order.setRiderId(riderId);
        if (order.getStatus() != next) order.moveTo(next, null, actor);
        publish(order, "status");
        return OrderViews.toDetail(order);
    }

    /** Moves several orders at once, e.g. everything for tomorrow into the oven. */
    @Transactional
    public List<OrderViews.Summary> bulkStatus(List<Long> ids, OrderStatus next, String actor) {
        if (ids == null || ids.isEmpty()) throw ApiException.badRequest("Pick at least one order.");
        if (ids.size() > 200) throw ApiException.badRequest("That's too many orders at once.");
        return ids.stream().distinct().map(id -> changeStatus(id, next, null, actor).summary()).toList();
    }

    @Transactional(readOnly = true)
    public PaymentReceipt receipt(long orderId, long receiptId) {
        return byId(orderId).getReceipts().stream().filter(r -> r.getId() == receiptId).findFirst()
                .orElseThrow(() -> ApiException.notFound("Receipt not found."));
    }

    // Helpers -------------------------------------------------------------------

    private void publish(Order order, String kind) {
        OrderViews.Summary summary = OrderViews.toSummary(order);
        OrderViews.PublicOrder view = OrderViews.toPublic(order, settings.get());
        String token = order.getTrackingToken();
        LiveHub.afterCommit(() -> {
            live.toAdmins("order", Map.of("kind", kind, "order", summary));
            live.toTracker(token, "order", view);
        });
    }

    private Order byToken(String token) {
        return orders.findByTrackingToken(token).orElseThrow(() -> ApiException.notFound("We couldn't find that order."));
    }

    private Order byId(long id) {
        return orders.findById(id).orElseThrow(() -> ApiException.notFound("Order not found."));
    }

    private String uniqueCode() {
        for (int i = 0; i < 10; i++) {
            String code = Ids.orderCode();
            if (!orders.existsByCode(code)) return code;
        }
        throw new IllegalStateException("Could not generate an order code");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
