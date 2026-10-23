package com.pastryuniverse.settings;

import com.pastryuniverse.config.AppProperties;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    private final StoreSettingsRepository repo;
    private final AppProperties props;

    public SettingsService(StoreSettingsRepository repo, AppProperties props) {
        this.repo = repo;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public StoreSettings get() {
        return repo.findById(1).map(StoreSettingsRow::getData).orElseThrow();
    }

    @Transactional
    public StoreSettings update(StoreSettings next) {
        StoreSettingsRow row = repo.findById(1).orElseThrow();
        row.setData(next);
        return repo.save(row).getData();
    }

    /** Dates customers can choose for delivery or pickup, in Lagos time. */
    public List<LocalDate> availableDates(StoreSettings s) {
        LocalDate today = LocalDate.now(props.zone());
        LocalDate first = today.plusDays(s.leadDaysOrDefault());
        LocalDate last = today.plusDays(s.maxDaysAheadOrDefault());
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
            if (!s.closedWeekdaysOrEmpty().contains(d.getDayOfWeek().getValue())) dates.add(d);
        }
        return dates;
    }
}
