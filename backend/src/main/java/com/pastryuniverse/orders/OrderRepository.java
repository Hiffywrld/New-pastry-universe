package com.pastryuniverse.orders;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByTrackingToken(String token);

    Optional<Order> findByCodeIgnoreCase(String code);

    boolean existsByCode(String code);

    @Query("select o from Order o where o.status in :statuses or (o.status = com.pastryuniverse.orders.OrderStatus.COMPLETED and o.updatedAt >= :since) order by o.deliveryDate asc, o.createdAt asc")
    List<Order> findBoard(@Param("statuses") Collection<OrderStatus> statuses, @Param("since") Instant since);

    @Query("select o from Order o order by o.createdAt desc limit 200")
    List<Order> findRecent();
}
