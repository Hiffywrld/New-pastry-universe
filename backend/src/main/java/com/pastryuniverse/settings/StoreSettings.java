package com.pastryuniverse.settings;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Everything the owner can change about the shop, stored as one JSON document. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StoreSettings(
        String bankName,
        String accountName,
        String accountNumber,
        String phone,
        String whatsapp,
        String email,
        String instagram,
        String address,
        String pickupAddress,
        String pickupNote,
        Integer leadDays,
        Integer maxDaysAhead,
        List<Integer> closedWeekdays,
        List<String> timeSlots,
        List<String> ticker,
        String announcement,
        Boolean shopOpen) {

    @JsonIgnore
    public int leadDaysOrDefault() {
        return leadDays == null ? 1 : Math.max(0, leadDays);
    }

    @JsonIgnore
    public int maxDaysAheadOrDefault() {
        return maxDaysAhead == null ? 21 : Math.max(1, Math.min(90, maxDaysAhead));
    }

    @JsonIgnore
    public List<Integer> closedWeekdaysOrEmpty() {
        return closedWeekdays == null ? List.of() : closedWeekdays;
    }

    @JsonIgnore
    public List<String> timeSlotsOrDefault() {
        return timeSlots == null || timeSlots.isEmpty() ? List.of("9am – 12pm", "12pm – 3pm", "3pm – 6pm") : timeSlots;
    }

    @JsonIgnore
    public boolean acceptsOrders() {
        return shopOpen == null || shopOpen;
    }

    @JsonIgnore
    public boolean hasBankDetails() {
        return notBlank(bankName) && notBlank(accountName) && notBlank(accountNumber);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
