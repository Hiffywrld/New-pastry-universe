package com.pastryuniverse.accounts;

import com.pastryuniverse.common.ApiException;
import com.pastryuniverse.orders.Customer;
import com.pastryuniverse.orders.CustomerRepository;
import com.pastryuniverse.orders.OrderRepository;
import com.pastryuniverse.orders.OrderViews;
import com.pastryuniverse.settings.GameSettings;
import com.pastryuniverse.settings.SettingsService;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {

    /** Length of a Topping Rush game. */
    public static final int GAME_SECONDS = 45;
    /** Nobody finishes an order in under this many seconds. */
    private static final int MIN_SECONDS_PER_ORDER = 5;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    private final CustomerRepository customers;
    private final RewardRepository rewards;
    private final GameSessionRepository games;
    private final OrderRepository orders;
    private final SettingsService settings;
    private final GoogleVerifier google;
    private final CustomerTokens tokens;

    public AccountService(CustomerRepository customers, RewardRepository rewards, GameSessionRepository games,
                          OrderRepository orders, SettingsService settings, GoogleVerifier google, CustomerTokens tokens) {
        this.customers = customers;
        this.rewards = rewards;
        this.games = games;
        this.orders = orders;
        this.settings = settings;
        this.google = google;
        this.tokens = tokens;
    }

    // Views ------------------------------------------------------------------

    public record Profile(long id, String name, String email, String avatarUrl) {}

    public record RewardView(String code, int percent, int maxAmount, Instant expiresAt, boolean redeemed, boolean expired) {}

    public record GameStatus(boolean enabled, boolean played, int seconds, int topPercent) {}

    public record OrderLine(String code, String token, int total, String status, String statusLabel, String itemsText,
                            Instant createdAt) {}

    public record Me(Profile profile, RewardView reward, GameStatus game, List<OrderLine> orders) {}

    public record SignIn(String token, Me me) {}

    public record GameStart(String sessionId, long seed, int seconds) {}

    public record GameResult(int ordersCompleted, int timeLeft, int mistakes, RewardView reward) {}

    // Sign-in ------------------------------------------------------------------

    @Transactional
    public SignIn signInWithGoogle(String credential) {
        GoogleVerifier.GoogleUser g = google.verify(credential);
        Customer c = customers.findByGoogleSub(g.sub())
                .orElseGet(() -> Customer.fromGoogle(g.sub(), nameOr(g), g.email(), g.picture()));
        c.signedIn(nameOr(g), g.email(), g.picture());
        c = customers.save(c);
        return new SignIn(tokens.issue(c), me(c.getId()));
    }

    @Transactional(readOnly = true)
    public Me me(long accountId) {
        Customer c = account(accountId);
        GameSettings g = settings.get().gameOrDefault();
        RewardView reward = rewards.findByAccountId(accountId).map(AccountService::view).orElse(null);
        boolean played = games.findByAccountId(accountId).isPresent() || reward != null;
        List<OrderLine> history = orders.findTop20ByAccountIdOrderByCreatedAtDesc(accountId).stream()
                .map(o -> {
                    OrderViews.Summary s = OrderViews.toSummary(o);
                    return new OrderLine(o.getCode(), o.getTrackingToken(), o.getTotal(), o.getStatus().name(),
                            OrderViews.label(o.getStatus(), o.getFulfilment()), s.itemsText(), o.getCreatedAt());
                })
                .toList();
        return new Me(new Profile(c.getId(), c.getName(), c.getEmail(), c.getAvatarUrl()), reward,
                new GameStatus(Boolean.TRUE.equals(g.enabled()), played, GAME_SECONDS, g.perfectPercent()), history);
    }

    // Topping Rush ---------------------------------------------------------------

    @Transactional
    public GameStart startGame(long accountId) {
        account(accountId);
        GameSettings g = settings.get().gameOrDefault();
        if (!Boolean.TRUE.equals(g.enabled())) throw ApiException.conflict("The game is closed right now.");
        if (rewards.findByAccountId(accountId).isPresent()) throw ApiException.conflict("You've already played. Your reward is on your account page.");
        GameSession existing = games.findByAccountId(accountId).orElse(null);
        if (existing != null) {
            // One go only: an abandoned game counts as finished with what you had.
            if (!existing.isFinished()) {
                existing.finish(0, 0, 0);
                issueReward(accountId, 0, 0, 0);
            }
            throw ApiException.conflict("You already started a game, so that was your go. Your reward is on your account page.");
        }
        GameSession session = games.save(new GameSession(randomId(20), accountId, RANDOM.nextLong()));
        return new GameStart(session.getId(), session.getSeed(), GAME_SECONDS);
    }

    @Transactional
    public GameResult finishGame(long accountId, String sessionId, int ordersCompleted, int timeLeft, int mistakes) {
        GameSession session = games.findById(sessionId == null ? "" : sessionId)
                .filter(s -> s.getAccountId() == accountId)
                .orElseThrow(() -> ApiException.notFound("Game not found."));
        if (session.isFinished()) throw ApiException.conflict("This game is already over.");

        // Sanity checks so a tampered result can't claim the top prize.
        long elapsed = Duration.between(session.getStartedAt(), Instant.now()).toSeconds();
        int orders = clamp(ordersCompleted, 0, 3);
        int left = clamp(timeLeft, 0, GAME_SECONDS);
        int used = GAME_SECONDS - left;
        if (elapsed + 2 < used) left = clamp(GAME_SECONDS - (int) elapsed, 0, GAME_SECONDS);
        used = GAME_SECONDS - left;
        if (orders * MIN_SECONDS_PER_ORDER > used + 1) orders = Math.max(0, used / MIN_SECONDS_PER_ORDER);
        if (elapsed > GAME_SECONDS + 30) left = 0;
        int errs = Math.max(0, mistakes);

        session.finish(orders, left, errs);
        Reward reward = issueReward(accountId, orders, left, errs);
        return new GameResult(orders, left, errs, view(reward));
    }

    // Helpers --------------------------------------------------------------------

    private Reward issueReward(long accountId, int orders, int timeLeft, int mistakes) {
        GameSettings g = settings.get().gameOrDefault();
        int pct = g.percentFor(orders, timeLeft, mistakes);
        String code;
        do {
            code = "PU" + randomCode(6);
        } while (rewards.existsByCode(code));
        return rewards.save(new Reward(accountId, code, pct, g.maxDiscount(), Instant.now().plus(g.validDays(), ChronoUnit.DAYS)));
    }

    static RewardView view(Reward r) {
        boolean expired = Instant.now().isAfter(r.getExpiresAt());
        return new RewardView(r.getCode(), r.getPercent(), r.getMaxAmount(), r.getExpiresAt(), r.getRedeemedAt() != null, expired);
    }

    private Customer account(long id) {
        return customers.findById(id).filter(c -> c.getGoogleSub() != null)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Please sign in again."));
    }

    private static String nameOr(GoogleVerifier.GoogleUser g) {
        if (g.name() != null && !g.name().isBlank()) return g.name();
        return g.email() == null ? "Friend" : g.email().split("@")[0];
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static String randomId(int n) {
        String chars = "abcdefghijkmnopqrstuvwxyz23456789";
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        return sb.toString();
    }

    private static String randomCode(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        return sb.toString();
    }
}
