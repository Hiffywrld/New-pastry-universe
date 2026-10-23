package com.pastryuniverse.catalog;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VariantRepository extends JpaRepository<Variant, Long> {

    @Query("select v from Variant v join fetch v.product where v.id in :ids")
    List<Variant> findWithProduct(@Param("ids") Collection<Long> ids);
}
