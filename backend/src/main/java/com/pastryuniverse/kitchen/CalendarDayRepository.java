package com.pastryuniverse.kitchen;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarDayRepository extends JpaRepository<CalendarDay, LocalDate> {

    List<CalendarDay> findByDayBetween(LocalDate from, LocalDate to);
}
