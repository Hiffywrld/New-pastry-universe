package com.pastryuniverse.accounts;

import com.pastryuniverse.common.RateLimiter;
import com.pastryuniverse.settings.SettingsService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AccountController {

    private final AccountService accounts;
    private final GoogleVerifier google;
    private final SettingsService settings;
    private final RateLimiter limiter;
    private final com.pastryuniverse.config.AppProperties props;

    public AccountController(AccountService accounts, GoogleVerifier google, SettingsService settings, RateLimiter limiter,
                             com.pastryuniverse.config.AppProperties props) {
        this.accounts = accounts;
        this.google = google;
        this.settings = settings;
        this.limiter = limiter;
        this.props = props;
    }

    /** What the sign-up page needs before anyone is logged in. */
    @GetMapping("/auth/config")
    public Map<String, Object> config() {
        var g = settings.get().gameOrDefault();
        return Map.of(
                "googleClientId", google.isConfigured() ? props.googleClientId() : "",
                "gameEnabled", Boolean.TRUE.equals(g.enabled()),
                "topPercent", g.perfectPercent(),
                "percentByOrders", g.percentByOrders(),
                "perfectMinTimeLeft", g.perfectMinTimeLeft(),
                "maxDiscount", g.maxDiscount(),
                "validDays", g.validDays());
    }

    public record GoogleRequest(String credential) {}

    @PostMapping("/auth/google")
    public AccountService.SignIn google(@RequestBody GoogleRequest req, HttpServletRequest http) {
        limiter.check("google:" + http.getRemoteAddr(), 20, Duration.ofMinutes(10));
        return accounts.signInWithGoogle(req.credential());
    }

    @GetMapping("/me")
    public AccountService.Me me(@AuthenticationPrincipal Jwt jwt) {
        return accounts.me(Long.parseLong(jwt.getSubject()));
    }

    @PostMapping("/game/start")
    public AccountService.GameStart start(@AuthenticationPrincipal Jwt jwt) {
        return accounts.startGame(Long.parseLong(jwt.getSubject()));
    }

    public record FinishRequest(String sessionId, int ordersCompleted, int timeLeft, int mistakes) {}

    @PostMapping("/game/finish")
    public AccountService.GameResult finish(@AuthenticationPrincipal Jwt jwt, @RequestBody FinishRequest req) {
        return accounts.finishGame(Long.parseLong(jwt.getSubject()), req.sessionId(), req.ordersCompleted(), req.timeLeft(), req.mistakes());
    }
}
