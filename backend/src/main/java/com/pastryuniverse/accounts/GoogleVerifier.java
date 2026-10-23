package com.pastryuniverse.accounts;

import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.config.AppProperties;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/** Checks the ID token Google's sign-in button gives the browser. */
@Component
public class GoogleVerifier {

    public record GoogleUser(String sub, String email, String name, String picture) {}

    private static final List<String> ISSUERS = List.of("accounts.google.com", "https://accounts.google.com");

    private final String clientId;
    private volatile NimbusJwtDecoder decoder;

    public GoogleVerifier(AppProperties props) {
        this.clientId = props.googleClientId();
    }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank();
    }

    public GoogleUser verify(String idToken) {
        if (!isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Google sign-in isn't set up yet.");
        }
        try {
            Jwt jwt = decoder().decode(idToken);
            if (!Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Verify your Google email address first.");
            }
            return new GoogleUser(jwt.getSubject(), jwt.getClaimAsString("email"), jwt.getClaimAsString("name"), jwt.getClaimAsString("picture"));
        } catch (JwtException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Google sign-in failed. Please try again.");
        }
    }

    private NimbusJwtDecoder decoder() {
        if (decoder == null) {
            NimbusJwtDecoder d = NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build();
            d.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                    new JwtTimestampValidator(),
                    jwt -> ISSUERS.contains(String.valueOf(jwt.getClaims().get("iss")))
                            ? OAuth2TokenValidatorResult.success()
                            : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Wrong issuer", null)),
                    jwt -> jwt.getAudience() != null && jwt.getAudience().contains(clientId)
                            ? OAuth2TokenValidatorResult.success()
                            : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Wrong audience", null))));
            decoder = d;
        }
        return decoder;
    }
}
