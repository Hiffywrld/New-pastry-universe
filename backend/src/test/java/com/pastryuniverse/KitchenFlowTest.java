package com.pastryuniverse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** The delivery calendar, baking plan, rider links and customer list. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class KitchenFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.pastryuniverse.common.RateLimiter limiter;

    JsonNode menu;
    String token;
    String day;
    String slotA;
    String slotB;

    @BeforeEach
    void setUp() throws Exception {
        limiter.reset();
        jdbc.update("TRUNCATE orders, customers, analytics_events, rewards, game_sessions, calendar_days, riders RESTART IDENTITY CASCADE");
        jdbc.update("UPDATE store_settings SET data = data - 'dailyLimit' - 'slotLimit'");
        token = login();
        reloadMenu();
        day = menu.get("store").get("availableDates").get(0).asText();
        slotA = menu.get("store").get("timeSlots").get(0).asText();
        slotB = menu.get("store").get("timeSlots").get(1).asText();
    }

    @Test
    void aDayFillsUpAtItsLimitAndFreesUpWhenAnOrderIsCancelled() throws Exception {
        admin(put("/api/admin/calendar/limits").contentType(MediaType.APPLICATION_JSON).content("{\"dailyLimit\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyLimit").value(2));

        order("0803 111 1111", slotA, 1, null).andExpect(status().isCreated());
        JsonNode second = read(order("0803 222 2222", slotB, 1, null).andExpect(status().isCreated()));
        order("0803 333 3333", slotA, 1, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("That day is fully booked. Pick another day."));

        reloadMenu();
        assertThat(dates("availableDates")).doesNotContain(day);
        assertThat(dates("fullDates")).contains(day);

        long id = idOf(second.get("code").asText());
        admin(post("/api/admin/orders/" + id + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk());
        order("0803 333 3333", slotA, 1, null).andExpect(status().isCreated());
    }

    @Test
    void aDeliveryTimeFillsUpOnItsOwn() throws Exception {
        admin(put("/api/admin/calendar/limits").contentType(MediaType.APPLICATION_JSON).content("{\"slotLimit\":1}"))
                .andExpect(status().isOk());
        order("0803 111 1111", slotA, 1, null).andExpect(status().isCreated());
        order("0803 222 2222", slotA, 1, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("That time is fully booked. Pick another time or day."));
        order("0803 222 2222", slotB, 1, null).andExpect(status().isCreated());

        reloadMenu();
        assertThat(menu.get("store").get("fullSlots").get(day).get(0).asText()).isEqualTo(slotA);
    }

    @Test
    void theKitchenCanCloseADay() throws Exception {
        admin(put("/api/admin/calendar/days/" + day).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"closed\":true,\"note\":\"Family wedding\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.closed").value(true))
                .andExpect(jsonPath("$.note").value("Family wedding"));
        reloadMenu();
        assertThat(dates("availableDates")).doesNotContain(day);
        order("0803 111 1111", slotA, 1, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("We're closed that day. Pick another day."));

        JsonNode cal = read(admin(get("/api/admin/calendar")).andExpect(status().isOk()));
        boolean found = false;
        for (JsonNode d : cal.get("days")) if (d.get("date").asText().equals(day)) found = d.get("closed").asBoolean();
        assertThat(found).isTrue();

        // Opening it again puts it back.
        admin(put("/api/admin/calendar/days/" + day).contentType(MediaType.APPLICATION_JSON).content("{\"closed\":false}"))
                .andExpect(status().isOk());
        reloadMenu();
        assertThat(dates("availableDates")).contains(day);
    }

    @Test
    void theBakingPlanAddsUpPaidOrdersAndListsUnpaidOnesSeparately() throws Exception {
        long id1 = idOf(read(order("0803 111 1111", slotA, 2, null).andExpect(status().isCreated())).get("code").asText());
        long id2 = idOf(read(order("0803 222 2222", slotB, 3, null).andExpect(status().isCreated())).get("code").asText());
        order("0803 333 3333", slotA, 4, null).andExpect(status().isCreated());
        confirm(id1);
        confirm(id2);

        JsonNode plan = read(admin(get("/api/admin/day?date=" + day)).andExpect(status().isOk()));
        assertThat(plan.get("toBake")).hasSize(1);
        assertThat(plan.get("toBake").get(0).get("quantity").asInt()).isEqualTo(5);
        assertThat(plan.get("toBake").get(0).get("orders").asInt()).isEqualTo(2);
        assertThat(plan.get("unpaid").get(0).get("quantity").asInt()).isEqualTo(4);
        assertThat(plan.get("orders")).hasSize(3);
        assertThat(plan.get("capacity").get("orders").asInt()).isEqualTo(3);

        admin(post("/api/admin/orders/bulk-status").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[" + id1 + "," + id2 + "],\"status\":\"READY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("READY"));
        plan = read(admin(get("/api/admin/day?date=" + day)));
        assertThat(plan.get("toBake").get(0).get("baked").asInt()).isEqualTo(5);
    }

    @Test
    void ridersSeePaidDeliveriesAndMarkThemDelivered() throws Exception {
        JsonNode rider = read(admin(post("/api/admin/riders").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Tunde\",\"phone\":\"0805 555 5555\"}")).andExpect(status().isOk()));
        String link = rider.get("token").asText();
        long zone = menu.get("delivery").get("zones").get(0).get("id").asLong();

        JsonNode paid = read(order("0803 111 1111", slotA, 1, zone).andExpect(status().isCreated()));
        JsonNode unpaid = read(order("0803 222 2222", slotA, 1, zone).andExpect(status().isCreated()));
        order("0803 333 3333", slotA, 1, null).andExpect(status().isCreated()); // pickup, not for the rider
        long paidId = idOf(paid.get("code").asText());
        confirm(paidId);

        JsonNode list = read(mvc.perform(get("/api/rider/" + link + "?date=" + day)).andExpect(status().isOk()));
        assertThat(list.get("rider").asText()).isEqualTo("Tunde");
        assertThat(list.get("stops")).hasSize(1);
        assertThat(list.get("stops").get(0).get("address").asText()).isEqualTo("12 Allen Avenue, Ikeja");

        mvc.perform(post("/api/rider/" + link + "/orders/" + idOf(unpaid.get("code").asText()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"OUT_FOR_DELIVERY\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/rider/" + link + "/orders/" + paidId).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"OUT_FOR_DELIVERY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OUT_FOR_DELIVERY"))
                .andExpect(jsonPath("$.mine").value(true));
        mvc.perform(post("/api/rider/" + link + "/orders/" + paidId).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk());

        JsonNode tracked = read(mvc.perform(get("/api/orders/track/" + paid.get("token").asText())));
        assertThat(tracked.get("statusLabel").asText()).isEqualTo("Delivered");

        mvc.perform(get("/api/rider/not-a-real-link")).andExpect(status().isNotFound());
    }

    @Test
    void theCustomerListAddsUpEachCustomerAndKeepsNotes() throws Exception {
        long a1 = idOf(read(order("0803 111 1111", slotA, 2, null)).get("code").asText());
        long a2 = idOf(read(order("0803 111 1111", slotB, 1, null)).get("code").asText());
        order("0806 222 2222", slotA, 1, null);
        confirm(a1);
        confirm(a2);

        JsonNode list = read(admin(get("/api/admin/customers?sort=spent")).andExpect(status().isOk()));
        assertThat(list).hasSize(2);
        JsonNode top = list.get(0);
        assertThat(top.get("phone").asText()).isEqualTo("0803 111 1111");
        assertThat(top.get("orders").asInt()).isEqualTo(2);
        assertThat(top.get("spent").asInt()).isGreaterThan(0);
        assertThat(top.get("favourite").asText()).isEqualTo("Banana Bread");

        long id = top.get("id").asLong();
        admin(put("/api/admin/customers/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"notes\":\"Prefers morning delivery\",\"tags\":[\"Regular\",\"regular\",\" Office \"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").value("Prefers morning delivery"))
                .andExpect(jsonPath("$.row.tags.length()").value(2))
                .andExpect(jsonPath("$.orders.length()").value(2));

        JsonNode found = read(admin(get("/api/admin/customers?q=0806")));
        assertThat(found).hasSize(1);
        assertThat(found.get(0).get("phone").asText()).isEqualTo("0806 222 2222");
    }

    // Helpers ------------------------------------------------------------------

    private ResultActions order(String phone, String slot, int qty, Long zoneId) throws Exception {
        ObjectNode body = json.createObjectNode();
        long variant = menu.get("items").get(0).get("sizes").get(0).get("choices").get(0).get("variantId").asLong();
        body.putArray("items").addObject().put("variantId", variant).put("quantity", qty);
        body.putObject("customer").put("name", "Test Customer").put("phone", phone);
        body.put("fulfilment", zoneId == null ? "PICKUP" : "DELIVERY");
        if (zoneId != null) body.put("zoneId", zoneId).put("address", "12 Allen Avenue, Ikeja");
        body.put("deliveryDate", day);
        body.put("timeSlot", slot);
        return mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(body.toString()));
    }

    private void confirm(long id) throws Exception {
        admin(post("/api/admin/orders/" + id + "/payment/confirm")).andExpect(status().isOk());
    }

    private long idOf(String code) {
        return jdbc.queryForObject("select id from orders where code = ?", Long.class, code);
    }

    private ResultActions admin(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req) throws Exception {
        return mvc.perform(req.header("Authorization", "Bearer " + token));
    }

    private java.util.List<String> dates(String field) {
        java.util.List<String> out = new java.util.ArrayList<>();
        menu.get("store").get(field).forEach(n -> out.add(n.asText()));
        return out;
    }

    private void reloadMenu() throws Exception {
        menu = read(mvc.perform(get("/api/menu")).andExpect(status().isOk()));
    }

    private String login() throws Exception {
        return read(mvc.perform(post("/api/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"owner@test.local\",\"password\":\"test-password\"}")).andExpect(status().isOk()))
                .get("token").asText();
    }

    private JsonNode read(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }
}
