package com.pastryuniverse.kitchen;

import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.common.RateLimiter;
import com.pastryuniverse.orders.OrderStatus;
import java.time.Duration;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The rider's page. No login: the secret link is the key. */
@RestController
@RequestMapping("/api/rider")
public class RiderController {

    private final RiderService riders;
    private final RateLimiter limiter;

    public RiderController(RiderService riders, RateLimiter limiter) {
        this.riders = riders;
        this.limiter = limiter;
    }

    @GetMapping("/{token}")
    public RiderService.RiderDay day(@PathVariable String token,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        limiter.check("rider:" + token, 120, Duration.ofMinutes(1));
        return riders.day(token, date);
    }

    public record StatusRequest(OrderStatus status) {}

    @PostMapping("/{token}/orders/{id}")
    public RiderService.Stop update(@PathVariable String token, @PathVariable long id, @RequestBody StatusRequest req) {
        limiter.check("rider:" + token, 120, Duration.ofMinutes(1));
        if (req.status() == null) throw ApiException.badRequest("Choose picked up or delivered.");
        return riders.update(token, id, req.status());
    }
}
