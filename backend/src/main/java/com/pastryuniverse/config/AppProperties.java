package com.pastryuniverse.config;

import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String timezone,
        String corsOrigins,
        String jwtSecret,
        int jwtHours,
        String uploadDir,
        String googleClientId,
        BootstrapAdmin bootstrapAdmin) {

    public record BootstrapAdmin(String email, String password, String name) {}

    public ZoneId zone() {
        return ZoneId.of(timezone == null || timezone.isBlank() ? "Africa/Lagos" : timezone);
    }

    public List<String> corsOriginList() {
        if (corsOrigins == null || corsOrigins.isBlank()) return List.of();
        return Arrays.stream(corsOrigins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
