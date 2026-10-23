package com.pastryuniverse.analytics;

import com.pastryuniverse.live.LiveHub;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Counts people on the site right now from the heartbeats their browsers send. */
@Component
public class VisitorTracker {

    private static final long WINDOW_MS = 75_000;

    private final Map<String, Long> lastSeen = new ConcurrentHashMap<>();
    private final AtomicInteger lastBroadcast = new AtomicInteger(-1);
    private final LiveHub live;

    public VisitorTracker(LiveHub live) {
        this.live = live;
    }

    public void touch(String sessionId) {
        lastSeen.put(sessionId, System.currentTimeMillis());
    }

    public int count() {
        long cutoff = System.currentTimeMillis() - WINDOW_MS;
        lastSeen.entrySet().removeIf(e -> e.getValue() < cutoff);
        return lastSeen.size();
    }

    @Scheduled(fixedRate = 5_000)
    void broadcast() {
        int now = count();
        if (live.adminCount() > 0 && lastBroadcast.getAndSet(now) != now) {
            live.toAdmins("visitors", Map.of("count", now));
        }
    }
}
