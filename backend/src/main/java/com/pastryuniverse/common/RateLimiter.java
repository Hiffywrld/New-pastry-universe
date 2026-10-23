package com.pastryuniverse.common;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Small in-memory limiter to stop floods of orders, uploads or login attempts. */
@Component
public class RateLimiter {

    private record Window(long start, int count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public void check(String key, int limit, Duration per) {
        long now = System.currentTimeMillis();
        Window w = windows.compute(key, (k, old) -> {
            if (old == null || now - old.start() > per.toMillis()) return new Window(now, 1);
            return new Window(old.start(), old.count() + 1);
        });
        if (w.count() > limit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many tries. Wait a minute and try again.");
        }
    }

    /** Forget every window (used by tests). */
    public void reset() {
        windows.clear();
    }

    @Scheduled(fixedRate = 300_000)
    void sweep() {
        long cutoff = System.currentTimeMillis() - Duration.ofMinutes(30).toMillis();
        windows.entrySet().removeIf(e -> e.getValue().start() < cutoff);
    }
}
