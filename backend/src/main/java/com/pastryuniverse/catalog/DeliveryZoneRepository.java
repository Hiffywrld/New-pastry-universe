package com.pastryuniverse.catalog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryZoneRepository extends JpaRepository<DeliveryZone, Long> {

    List<DeliveryZone> findByActiveTrueOrderByFeeAscSortOrderAsc();
}
