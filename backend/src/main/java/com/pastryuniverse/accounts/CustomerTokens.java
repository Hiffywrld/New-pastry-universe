package com.pastryuniverse.accounts;

import com.pastryuniverse.orders.Customer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Component;

/** Login tokens for shoppers (30 days), signed with the same key as staff tokens but a CUSTOMER role. */
@Component
public class CustomerTokens {

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;

    public CustomerTokens(JwtEncoder encoder, JwtDecoder decoder) {
        this.encoder = encoder;
        this.decoder = decoder;
    }

    public String issue(Customer c) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("pastry-universe")
                .subject(String.valueOf(c.getId()))
                .issuedAt(now)
                .expiresAt(now.plus(30, ChronoUnit.DAYS))
                .claim("role", "CUSTOMER")
                .claim("name", c.getName())
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    /** Account id from an optional "Bearer ..." header, or null if missing or invalid. */
    public Long accountIdFrom(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        try {
            Jwt jwt = decoder.decode(authorization.substring(7));
            return "CUSTOMER".equals(jwt.getClaimAsString("role")) ? Long.valueOf(jwt.getSubject()) : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
