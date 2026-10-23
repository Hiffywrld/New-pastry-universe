package com.pastryuniverse.admin;

import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.common.RateLimiter;
import com.pastryuniverse.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AuthController {

    private final AdminUserRepository users;
    private final PasswordEncoder encoder;
    private final JwtEncoder jwt;
    private final AppProperties props;
    private final RateLimiter limiter;

    public AuthController(AdminUserRepository users, PasswordEncoder encoder, JwtEncoder jwt, AppProperties props, RateLimiter limiter) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.props = props;
        this.limiter = limiter;
    }

    public record LoginRequest(String email, String password) {}

    public record Me(long id, String email, String name, String role) {}

    public record LoginResponse(String token, Instant expiresAt, Me user) {}

    @PostMapping("/auth/login")
    @Transactional
    public LoginResponse login(@RequestBody LoginRequest req, HttpServletRequest http) {
        limiter.check("login:" + http.getRemoteAddr(), 6, Duration.ofMinutes(5));
        String email = req.email() == null ? "" : req.email().trim();
        AdminUser user = users.findByEmailIgnoreCase(email)
                .filter(u -> req.password() != null && encoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "That email and password don't match."));
        user.touchLogin();

        Instant now = Instant.now();
        Instant expires = now.plus(props.jwtHours() <= 0 ? 12 : props.jwtHours(), ChronoUnit.HOURS);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("pastry-universe")
                .subject(String.valueOf(user.getId()))
                .issuedAt(now)
                .expiresAt(expires)
                .claim("email", user.getEmail())
                .claim("name", user.getName())
                .claim("role", user.getRole())
                .build();
        String token = jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new LoginResponse(token, expires, new Me(user.getId(), user.getEmail(), user.getName(), user.getRole()));
    }

    @GetMapping("/me")
    public Me me(@AuthenticationPrincipal Jwt principal) {
        return new Me(Long.parseLong(principal.getSubject()), principal.getClaimAsString("email"),
                principal.getClaimAsString("name"), principal.getClaimAsString("role"));
    }
}
