package com.pastryuniverse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pastryuniverse.accounts.GoogleVerifier;
import com.pastryuniverse.settings.GameSettings;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.pastryuniverse.common.RateLimiter limiter;
    @MockitoBean GoogleVerifier google;

    JsonNode menu;

    @BeforeEach
    void setUp() throws Exception {
        limiter.reset();
        jdbc.update("TRUNCATE orders, customers, analytics_events, rewards, game_sessions, calendar_days, riders RESTART IDENTITY CASCADE");
        jdbc.update("UPDATE store_settings SET data = data - 'dailyLimit' - 'slotLimit'");
        when(google.isConfigured()).thenReturn(true);
        when(google.verify(anyString())).thenAnswer(inv -> {
            String token = inv.getArgument(0);
            return new GoogleVerifier.GoogleUser("sub-" + token, token + "@example.com", "Ada " + token, null);
        });
        menu = json.readTree(mvc.perform(get("/api/menu")).andReturn().getResponse().getContentAsString());
    }

    @Test
    void topPrizeNeedsAFlawlessFastRun() {
        GameSettings g = GameSettings.DEFAULTS;
        assertThat(g.percentFor(0, 0, 0)).isEqualTo(5);
        assertThat(g.percentFor(1, 0, 3)).isEqualTo(10);
        assertThat(g.percentFor(2, 12, 0)).isEqualTo(15);
        assertThat(g.percentFor(3, 4, 0)).isEqualTo(25);
        assertThat(g.percentFor(3, 10, 1)).isEqualTo(25);
        assertThat(g.percentFor(3, 10, 0)).isEqualTo(40);
    }

    @Test
    void signUpPlayOnceAndUseTheDiscount() throws Exception {
        String token = signIn("one");
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.name").value("Ada one"))
                .andExpect(jsonPath("$.game.played").value(false));

        // A result sent straight away can't claim three finished orders.
        String sessionId = read(mvc.perform(post("/api/game/start").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("sessionId").asText();
        JsonNode result = read(mvc.perform(post("/api/game/finish").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"" + sessionId + "\",\"ordersCompleted\":3,\"timeLeft\":40,\"mistakes\":0}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(result.get("ordersCompleted").asInt()).isZero();
        assertThat(result.get("reward").get("percent").asInt()).isEqualTo(5);

        // One go only.
        mvc.perform(post("/api/game/start").header("Authorization", "Bearer " + token)).andExpect(status().isConflict());

        // The discount comes off the order, and the order shows on the account.
        ObjectNode body = orderBody();
        body.put("useReward", true);
        JsonNode order = read(mvc.perform(post("/api/orders").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        int subtotal = order.get("subtotal").asInt();
        assertThat(order.get("discount").asInt()).isEqualTo(Math.round(subtotal * 0.05f));
        assertThat(order.get("total").asInt()).isEqualTo(subtotal - order.get("discount").asInt());

        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.reward.redeemed").value(true))
                .andExpect(jsonPath("$.orders[0].code").value(order.get("code").asText()));

        // A second account can't reuse the discount on the same phone number.
        String other = signIn("two");
        String s2 = read(mvc.perform(post("/api/game/start").header("Authorization", "Bearer " + other))
                .andReturn().getResponse().getContentAsString()).get("sessionId").asText();
        mvc.perform(post("/api/game/finish").header("Authorization", "Bearer " + other).contentType(MediaType.APPLICATION_JSON)
                .content("{\"sessionId\":\"" + s2 + "\",\"ordersCompleted\":0,\"timeLeft\":0,\"mistakes\":0}")).andExpect(status().isOk());
        mvc.perform(post("/api/orders").header("Authorization", "Bearer " + other)
                        .contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("This phone number has already used a welcome discount."));
    }

    @Test
    void accountPagesNeedSigningIn() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/game/start")).andExpect(status().isUnauthorized());
    }

    private String signIn(String who) throws Exception {
        return read(mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"" + who + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();
    }

    private ObjectNode orderBody() {
        ObjectNode body = json.createObjectNode();
        body.putArray("items").addObject()
                .put("variantId", menu.get("items").get(0).get("sizes").get(2).get("choices").get(0).get("variantId").asLong())
                .put("quantity", 2);
        body.putObject("customer").put("name", "Ada Obi").put("phone", "0803 123 4567");
        body.put("fulfilment", "PICKUP");
        body.put("deliveryDate", menu.get("store").get("availableDates").get(0).asText());
        body.put("timeSlot", menu.get("store").get("timeSlots").get(0).asText());
        return body;
    }

    private JsonNode read(String s) throws Exception {
        return json.readTree(s);
    }
}
