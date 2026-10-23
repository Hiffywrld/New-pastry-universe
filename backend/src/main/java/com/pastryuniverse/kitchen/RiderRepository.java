package com.pastryuniverse.kitchen;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RiderRepository extends JpaRepository<Rider, Long> {

    Optional<Rider> findByTokenAndActiveTrue(String token);

    List<Rider> findByActiveTrueOrderByCreatedAtAsc();
}
