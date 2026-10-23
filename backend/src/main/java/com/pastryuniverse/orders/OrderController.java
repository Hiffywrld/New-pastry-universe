package com.pastryuniverse.orders;

import com.pastryuniverse.common.RateLimiter;
import com.pastryuniverse.live.LiveHub;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orders;
    private final RateLimiter limiter;
    private final LiveHub live;

    public OrderController(OrderService orders, RateLimiter limiter, LiveHub live) {
        this.orders = orders;
        this.limiter = limiter;
        this.live = live;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderViews.PublicOrder create(@Valid @RequestBody CreateOrderRequest req, HttpServletRequest http) {
        limiter.check("order:" + http.getRemoteAddr(), 8, Duration.ofMinutes(10));
        return orders.create(req);
    }

    @GetMapping("/track/{token}")
    public OrderViews.PublicOrder track(@PathVariable String token) {
        return orders.track(token);
    }

    @GetMapping(path = "/track/{token}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String token) {
        return live.openTracker(token, orders.track(token));
    }

    @PostMapping(path = "/track/{token}/receipt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public OrderViews.PublicOrder receipt(@PathVariable String token, @RequestPart("file") MultipartFile file,
                                          HttpServletRequest http) {
        limiter.check("receipt:" + http.getRemoteAddr(), 10, Duration.ofMinutes(10));
        return orders.uploadReceipt(token, file);
    }

    public record LookupRequest(String code, String phone) {}

    @PostMapping("/lookup")
    public Map<String, String> lookup(@RequestBody LookupRequest req, HttpServletRequest http) {
        limiter.check("lookup:" + http.getRemoteAddr(), 10, Duration.ofMinutes(5));
        return Map.of("token", orders.lookup(req.code(), req.phone()));
    }
}
