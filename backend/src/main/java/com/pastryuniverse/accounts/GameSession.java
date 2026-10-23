package com.pastryuniverse.accounts;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "game_sessions")
public class GameSession {

    @Id
    private String id;

    private Long accountId;
    private long seed;
    private Instant startedAt = Instant.now();
    private Instant finishedAt;
    private Integer ordersCompleted;
    private Integer timeLeft;
    private Integer mistakes;

    protected GameSession() {}

    public GameSession(String id, Long accountId, long seed) {
        this.id = id;
        this.accountId = accountId;
        this.seed = seed;
    }

    public void finish(int orders, int timeLeft, int mistakes) {
        this.finishedAt = Instant.now();
        this.ordersCompleted = orders;
        this.timeLeft = timeLeft;
        this.mistakes = mistakes;
    }

    public boolean isFinished() { return finishedAt != null; }
    public String getId() { return id; }
    public Long getAccountId() { return accountId; }
    public long getSeed() { return seed; }
    public Instant getStartedAt() { return startedAt; }
    public Integer getOrdersCompleted() { return ordersCompleted; }
    public Integer getTimeLeft() { return timeLeft; }
    public Integer getMistakes() { return mistakes; }
}
