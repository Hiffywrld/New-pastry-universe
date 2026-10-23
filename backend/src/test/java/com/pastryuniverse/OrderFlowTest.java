package com.pastryuniverse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Runs against a real Postgres database (see application-test.yml). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.pastryuniverse.common.RateLimiter limiter;

    JsonNode menu;

    @BeforeEach
    void setUp() throws Exception {
        limiter.reset();
        jdbc.update("TRUNCATE orders, customers, analytics_events, rewards, game_sessions, calendar_days, riders RESTART IDENTITY CASCADE");
        jdbc.update("UPDATE store_settings SET data = data - 'dailyLimit' - 'slotLimit'");
        menu = read(mvc.perform(get("/api/menu")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void menuHasHerProductsAndDeliveryZones() {
        assertThat(menu.get("items")).hasSize(9);
        assertThat(menu.get("items").get(0).get("name").asText()).isEqualTo("Banana Bread");
        assertThat(menu.get("delivery").get("zones")).hasSize(27);
        assertThat(menu.get("store").get("availableDates").size()).isGreaterThan(5);
    }

    @Test
    void pricesComeFromTheServerAndDeliveryFeeIsAdded() throws Exception {
        JsonNode medium = size("banana-bread", "medium");
        long coconut = choice(medium, "Coconut chips").get("variantId").asLong();
        JsonNode zone = menu.get("delivery").get("zones").get(0);

        JsonNode order = placeOrder(coconut, 3, "DELIVERY", zone.get("id").asLong());

        assertThat(order.get("subtotal").asInt()).isEqualTo(3 * 3500);
        assertThat(order.get("deliveryFee").asInt()).isEqualTo(zone.get("fee").asInt());
        assertThat(order.get("total").asInt()).isEqualTo(3 * 3500 + zone.get("fee").asInt());
        assertThat(order.get("status").asText()).isEqualTo("AWAITING_PAYMENT");
        assertThat(order.get("code").asText()).startsWith("PU-");
    }

    @Test
    void rejectsBadPhoneNumbers() throws Exception {
        ObjectNode body = orderBody(firstVariant(), 1, "PICKUP", null);
        ((ObjectNode) body.get("customer")).put("phone", "12345");
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Enter a Nigerian phone number, like 0803 123 4567."));
    }

    @Test
    void deliveryNeedsAnAreaAndAddress() throws Exception {
        ObjectNode body = orderBody(firstVariant(), 1, "DELIVERY", null);
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Choose your delivery area."));
    }

    @Test
    void staffEndpointsNeedALogin() throws Exception {
        mvc.perform(get("/api/admin/orders")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"owner@test.local\",\"password\":\"nope\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void fullBankTransferFlow() throws Exception {
        String token = login();

        // Owner adds bank details.
        JsonNode settings = read(mvc.perform(get("/api/admin/settings").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString());
        ((ObjectNode) settings).put("bankName", "Test Bank").put("accountName", "Pastry Universe").put("accountNumber", "0123456789");
        mvc.perform(put("/api/admin/settings").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(settings.toString())).andExpect(status().isOk());

        // Customer orders and sees where to pay.
        JsonNode order = placeOrder(firstVariant(), 2, "PICKUP", null);
        String tracking = order.get("token").asText();
        assertThat(order.get("bank").get("accountNumber").asText()).isEqualTo("0123456789");

        // Customer uploads a receipt.
        MockMultipartFile file = new MockMultipartFile("file", "receipt.png", "image/png", new byte[] {1, 2, 3, 4});
        JsonNode afterUpload = read(mvc.perform(multipart("/api/orders/track/" + tracking + "/receipt").file(file))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(afterUpload.get("status").asText()).isEqualTo("PAYMENT_REVIEW");
        assertThat(afterUpload.get("receiptUploaded").asBoolean()).isTrue();

        // Staff confirm the payment and start baking.
        JsonNode board = read(mvc.perform(get("/api/admin/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long id = board.get(0).get("id").asLong();
        mvc.perform(post("/api/admin/orders/" + id + "/payment/confirm").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.summary.paymentStatus").value("CONFIRMED"));
        mvc.perform(post("/api/admin/orders/" + id + "/status").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"BAKING\"}"))
                .andExpect(status().isOk());

        // Customer sees progress, and bank details are no longer shown.
        JsonNode tracked = read(mvc.perform(get("/api/orders/track/" + tracking)).andReturn().getResponse().getContentAsString());
        assertThat(tracked.get("statusLabel").asText()).isEqualTo("In the oven");
        assertThat(tracked.has("bank")).isFalse();

        // Dashboard counts the sale.
        JsonNode dash = read(mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(dash.get("kpis").get("salesToday").asInt()).isEqualTo(order.get("total").asInt());
        assertThat(dash.get("bestSellers").get(0).get("quantity").asInt()).isEqualTo(2);
    }

    @Test
    void customersCanFindTheirOrderByCodeAndPhone() throws Exception {
        JsonNode order = placeOrder(firstVariant(), 1, "PICKUP", null);
        mvc.perform(post("/api/orders/lookup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + order.get("code").asText().toLowerCase() + "\",\"phone\":\"+234 803 123 4567\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(order.get("token").asText()));
        mvc.perform(post("/api/orders/lookup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + order.get("code").asText() + "\",\"phone\":\"0809 999 9999\"}"))
                .andExpect(status().isNotFound());
    }

    // Helpers ------------------------------------------------------------------

    private String login() throws Exception {
        String body = mvc.perform(post("/api/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"owner@test.local\",\"password\":\"test-password\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return read(body).get("token").asText();
    }

    private JsonNode placeOrder(long variantId, int qty, String fulfilment, Long zoneId) throws Exception {
        String body = mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content(orderBody(variantId, qty, fulfilment, zoneId).toString()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return read(body);
    }

    private ObjectNode orderBody(long variantId, int qty, String fulfilment, Long zoneId) {
        ObjectNode body = json.createObjectNode();
        body.putArray("items").addObject().put("variantId", variantId).put("quantity", qty);
        body.putObject("customer").put("name", "Ada Obi").put("phone", "0803 123 4567");
        body.put("fulfilment", fulfilment);
        if (zoneId != null) body.put("zoneId", zoneId).put("address", "12 Allen Avenue, Ikeja");
        body.put("deliveryDate", menu.get("store").get("availableDates").get(0).asText());
        body.put("timeSlot", menu.get("store").get("timeSlots").get(0).asText());
        return body;
    }

    private long firstVariant() {
        return menu.get("items").get(0).get("sizes").get(0).get("choices").get(0).get("variantId").asLong();
    }

    private JsonNode size(String item, String key) {
        for (JsonNode i : menu.get("items")) {
            if (!i.get("id").asText().equals(item)) continue;
            for (JsonNode s : i.get("sizes")) if (s.get("key").asText().equals(key)) return s;
        }
        throw new AssertionError("No size " + key);
    }

    private JsonNode choice(JsonNode size, String label) {
        for (JsonNode c : size.get("choices")) if (c.get("label").asText().equals(label)) return c;
        throw new AssertionError("No choice " + label);
    }

    private JsonNode read(String s) throws Exception {
        return json.readTree(s);
    }
}
