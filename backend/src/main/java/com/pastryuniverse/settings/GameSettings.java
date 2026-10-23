package com.pastryuniverse.settings;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Rules for the Topping Rush welcome game. The discount depends on how many
 * of the 3 orders the player finishes; a flawless run with time to spare
 * gets the top prize.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GameSettings(
        Boolean enabled,
        List<Integer> percentByOrders,
        Integer perfectPercent,
        Integer perfectMinTimeLeft,
        Integer maxDiscount,
        Integer validDays) {

    public static final GameSettings DEFAULTS = new GameSettings(true, List.of(5, 10, 15, 25), 40, 8, 5000, 14);

    @JsonIgnore
    public GameSettings withDefaults() {
        return new GameSettings(
                enabled == null ? DEFAULTS.enabled : enabled,
                percentByOrders == null || percentByOrders.size() != 4 ? DEFAULTS.percentByOrders : percentByOrders,
                perfectPercent == null ? DEFAULTS.perfectPercent : perfectPercent,
                perfectMinTimeLeft == null ? DEFAULTS.perfectMinTimeLeft : perfectMinTimeLeft,
                maxDiscount == null ? DEFAULTS.maxDiscount : maxDiscount,
                validDays == null ? DEFAULTS.validDays : validDays);
    }

    /** The discount earned for a finished game. */
    @JsonIgnore
    public int percentFor(int ordersCompleted, int timeLeft, int mistakes) {
        GameSettings g = withDefaults();
        int orders = Math.max(0, Math.min(3, ordersCompleted));
        int pct = g.percentByOrders.get(orders);
        if (orders == 3 && mistakes == 0 && timeLeft >= g.perfectMinTimeLeft) pct = Math.max(pct, g.perfectPercent);
        return Math.max(0, Math.min(100, pct));
    }
}
