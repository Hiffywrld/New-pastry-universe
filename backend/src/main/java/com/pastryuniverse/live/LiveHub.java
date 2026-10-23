package com.pastryuniverse.live;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Pushes live updates to browsers with Server-Sent Events: the admin dashboard
 * (new orders, payments, visitor count) and each customer's tracking page.
 */
@Component
public class LiveHub {

    private final List<SseEmitter> admins = new CopyOnWriteArrayList<>();
    private final Map<String, List<SseEmitter>> trackers = new ConcurrentHashMap<>();

    public SseEmitter openAdmin(Object hello) {
        SseEmitter emitter = new SseEmitter(0L);
        register(admins, emitter);
        sendOne(emitter, "hello", hello);
        return emitter;
    }

    public SseEmitter openTracker(String token, Object hello) {
        SseEmitter emitter = new SseEmitter(0L);
        List<SseEmitter> list = trackers.computeIfAbsent(token, k -> new CopyOnWriteArrayList<>());
        register(list, emitter);
        emitter.onCompletion(() -> trackers.computeIfPresent(token, (k, v) -> v.isEmpty() ? null : v));
        sendOne(emitter, "order", hello);
        return emitter;
    }

    public void toAdmins(String event, Object data) {
        admins.forEach(e -> sendOne(e, event, data));
    }

    public void toTracker(String token, String event, Object data) {
        List<SseEmitter> list = trackers.get(token);
        if (list != null) list.forEach(e -> sendOne(e, event, data));
    }

    public int adminCount() {
        return admins.size();
    }

    /** Runs the action once the current database transaction has committed. */
    public static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    /** Keeps connections open through proxies that drop idle streams. */
    @Scheduled(fixedRate = 20_000)
    void ping() {
        admins.forEach(this::comment);
        trackers.values().forEach(list -> list.forEach(this::comment));
    }

    private void register(List<SseEmitter> list, SseEmitter emitter) {
        list.add(emitter);
        emitter.onCompletion(() -> list.remove(emitter));
        emitter.onTimeout(() -> list.remove(emitter));
        emitter.onError(e -> list.remove(emitter));
    }

    private void sendOne(SseEmitter emitter, String event, Object data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            emitter.completeWithError(e);
        }
    }

    private void comment(SseEmitter emitter) {
        try {
            emitter.send(SseEmitter.event().comment("ping"));
        } catch (IOException | IllegalStateException e) {
            emitter.completeWithError(e);
        }
    }
}
