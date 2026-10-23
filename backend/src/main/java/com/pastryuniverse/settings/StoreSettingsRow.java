package com.pastryuniverse.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "store_settings")
public class StoreSettingsRow {

    @Id
    private Integer id = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private StoreSettings data;

    private Instant updatedAt = Instant.now();

    public StoreSettings getData() {
        return data;
    }

    public void setData(StoreSettings data) {
        this.data = data;
        this.updatedAt = Instant.now();
    }
}
