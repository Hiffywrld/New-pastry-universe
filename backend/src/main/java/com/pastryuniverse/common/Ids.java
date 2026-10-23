package com.pastryuniverse.common;

import java.security.SecureRandom;

public final class Ids {

    private static final SecureRandom RANDOM = new SecureRandom();
    // No 0/O, 1/I/L: easy to read out over the phone and type into a bank app.
    private static final String CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final String TOKEN_CHARS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private Ids() {}

    /** Short order code customers put in their transfer description, e.g. PU-7KX4M. */
    public static String orderCode() {
        return "PU-" + random(CODE_CHARS, 5);
    }

    /** Secret token for the public tracking link. */
    public static String trackingToken() {
        return random(TOKEN_CHARS, 24);
    }

    private static String random(String alphabet, int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        return sb.toString();
    }
}
