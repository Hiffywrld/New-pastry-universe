package com.pastryuniverse.catalog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProductRepository extends JpaRepository<Product, Long> {

    @Query("select distinct p from Product p left join fetch p.variants where p.active = true order by p.sortOrder")
    List<Product> findMenu();
}
