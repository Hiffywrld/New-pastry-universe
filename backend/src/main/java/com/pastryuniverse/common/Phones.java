package com.pastryuniverse.common;

public final class Phones {

    private Phones() {}

    /** Turns 0803 123 4567, 234803..., +234 803... into +2348031234567. */
    public static String normalize(String raw) {
        if (raw == null) throw ApiException.badRequest("Enter your phone number.");
        String d = raw.replaceAll("[^0-9+]", "");
        if (d.startsWith("+234")) d = d.substring(4);
        else if (d.startsWith("234") && d.length() > 10) d = d.substring(3);
        else if (d.startsWith("0")) d = d.substring(1);
        if (!d.matches("[789][01]\\d{8}")) {
            throw ApiException.badRequest("Enter a Nigerian phone number, like 0803 123 4567.");
        }
        return "+234" + d;
    }

    /** +2348031234567 -> 0803 123 4567 */
    public static String display(String e164) {
        if (e164 == null || !e164.startsWith("+234") || e164.length() != 14) return e164;
        String local = "0" + e164.substring(4);
        return local.substring(0, 4) + " " + local.substring(4, 7) + " " + local.substring(7);
    }
}
