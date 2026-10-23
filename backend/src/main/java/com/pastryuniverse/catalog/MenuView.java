package com.pastryuniverse.catalog;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Everything the shop front needs in one response. */
public record MenuView(List<Item> items, Delivery delivery, Store store) {

    public record Item(
            String id,
            String name,
            String category,
            String tag,
            String description,
            List<Size> sizes,
            Integer priceMin,
            boolean inStock) {}

    public record Size(String key, String label, List<Choice> choices, Integer priceMin, Integer priceMax, boolean inStock) {}

    public record Choice(long variantId, String label, int price, boolean inStock) {}

    public record Delivery(String pickupAddress, String pickupNote, List<Zone> zones) {}

    public record Zone(long id, String name, String areas, int fee) {}

    public record Store(
            String phone,
            String whatsapp,
            String email,
            String instagram,
            String address,
            List<String> ticker,
            String announcement,
            boolean shopOpen,
            List<String> timeSlots,
            List<LocalDate> availableDates,
            List<LocalDate> fullDates,
            Map<String, List<String>> fullSlots) {}
}
