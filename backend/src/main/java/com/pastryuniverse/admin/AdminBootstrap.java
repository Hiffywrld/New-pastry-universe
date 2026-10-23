package com.pastryuniverse.admin;

import com.pastryuniverse.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the first owner account from ADMIN_EMAIL / ADMIN_PASSWORD when there are no staff yet. */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AdminUserRepository users;
    private final PasswordEncoder encoder;
    private final AppProperties props;

    public AdminBootstrap(AdminUserRepository users, PasswordEncoder encoder, AppProperties props) {
        this.users = users;
        this.encoder = encoder;
        this.props = props;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() > 0) return;
        AppProperties.BootstrapAdmin b = props.bootstrapAdmin();
        if (b == null || b.email() == null || b.email().isBlank() || b.password() == null || b.password().length() < 8) {
            log.warn("No staff accounts yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) to create the owner account.");
            return;
        }
        String name = b.name() == null || b.name().isBlank() ? "Owner" : b.name();
        users.save(new AdminUser(b.email().trim().toLowerCase(), name, encoder.encode(b.password()), "OWNER"));
        log.info("Created owner account for {}", b.email());
    }
}
