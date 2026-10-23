package com.pastryuniverse.orders;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record CreateOrderRequest(
        @NotEmpty(message = "Your cart is empty.") @Size(max = 40, message = "That's a lot of items. Split it into two orders.")
        List<@Valid Item> items,
        @NotNull(message = "Add your details.") @Valid Contact customer,
        @NotNull(message = "Choose delivery or pickup.") Fulfilment fulfilment,
        Long zoneId,
        @Size(max = 300, message = "Keep the address under 300 characters.") String address,
        @Size(max = 200, message = "Keep the landmark under 200 characters.") String landmark,
        @NotNull(message = "Choose a date.") LocalDate deliveryDate,
        @NotBlank(message = "Choose a time.") String timeSlot,
        @Valid Gift gift,
        @Size(max = 500, message = "Keep notes under 500 characters.") String notes,
        @Size(max = 64) String sessionId) {

    public record Item(
            @NotNull Long variantId,
            @Min(value = 1, message = "Quantity must be at least 1.") @Max(value = 50, message = "Maximum 50 of one item.") int quantity) {}

    public record Contact(
            @NotBlank(message = "Enter your name.") @Size(max = 80, message = "Keep your name under 80 characters.") String name,
            @NotBlank(message = "Enter your phone number.") String phone,
            @Email(message = "Enter a valid email address.") @Size(max = 160) String email) {}

    public record Gift(
            @Size(max = 80) String recipientName,
            String recipientPhone,
            @Size(max = 400, message = "Keep the note under 400 characters.") String note) {}
}
