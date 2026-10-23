package com.pastryuniverse.catalog;

import com.pastryuniverse.kitchen.CalendarService;
import com.pastryuniverse.settings.SettingsService;
import com.pastryuniverse.settings.StoreSettings;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MenuService {

    private final ProductRepository products;
    private final DeliveryZoneRepository zones;
    private final SettingsService settings;
    private final CalendarService calendar;

    public MenuService(ProductRepository products, DeliveryZoneRepository zones, SettingsService settings, CalendarService calendar) {
        this.products = products;
        this.zones = zones;
        this.settings = settings;
        this.calendar = calendar;
    }

    @Transactional(readOnly = true)
    public MenuView menu() {
        StoreSettings s = settings.get();
        List<MenuView.Item> items = products.findMenu().stream().map(this::toItem).filter(i -> !i.sizes().isEmpty()).toList();
        List<MenuView.Zone> zoneViews = zones.findByActiveTrueOrderByFeeAscSortOrderAsc().stream()
                .map(z -> new MenuView.Zone(z.getId(), z.getName(), z.getAreas(), z.getFee()))
                .toList();
        MenuView.Delivery delivery = new MenuView.Delivery(s.pickupAddress(), s.pickupNote(), zoneViews);
        CalendarService.ShopCalendar cal = calendar.forShop(s);
        MenuView.Store store = new MenuView.Store(
                s.phone(), s.whatsapp(), s.email(), s.instagram(), s.address(),
                s.ticker() == null ? List.of() : s.ticker(),
                s.announcement(), s.acceptsOrders(), s.timeSlotsOrDefault(),
                cal.availableDates(), cal.fullDates(), cal.fullSlots());
        return new MenuView(items, delivery, store);
    }

    private MenuView.Item toItem(Product p) {
        Map<String, List<Variant>> bySize = new LinkedHashMap<>();
        p.getVariants().stream()
                .filter(Variant::isActive)
                .sorted((a, b) -> a.getSizeSort() != b.getSizeSort()
                        ? Integer.compare(a.getSizeSort(), b.getSizeSort())
                        : Integer.compare(a.getOptionSort(), b.getOptionSort()))
                .forEach(v -> bySize.computeIfAbsent(v.getSizeKey(), k -> new ArrayList<>()).add(v));

        List<MenuView.Size> sizes = new ArrayList<>();
        for (List<Variant> vs : bySize.values()) {
            List<MenuView.Choice> choices = vs.stream()
                    .map(v -> new MenuView.Choice(v.getId(), v.getOptionLabel(), v.getPrice(), v.isAvailable()))
                    .toList();
            int min = vs.stream().mapToInt(Variant::getPrice).min().orElse(0);
            int max = vs.stream().mapToInt(Variant::getPrice).max().orElse(0);
            boolean inStock = vs.stream().anyMatch(Variant::isAvailable);
            sizes.add(new MenuView.Size(vs.get(0).getSizeKey(), vs.get(0).getSizeLabel(), choices, min, max, inStock));
        }
        Integer priceMin = sizes.stream().map(MenuView.Size::priceMin).min(Integer::compare).orElse(null);
        boolean inStock = sizes.stream().anyMatch(MenuView.Size::inStock);
        return new MenuView.Item(p.getSlug(), p.getName(), p.getCategory(), p.getTag(), p.getDescription(), sizes, priceMin, inStock);
    }
}
