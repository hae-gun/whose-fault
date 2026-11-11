package dev.nobodyasked.whosefault.common;

import java.security.SecureRandom;

public final class Ids {
    private static final String ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Ids() {}

    public static String random(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    /** 경로 변수로 들어온 id가 우리가 만든 형식인지 검사 (SQL과 로그를 깨끗하게 유지). */
    public static boolean valid(String id) {
        if (id == null || id.isEmpty() || id.length() > 24) return false;
        for (int i = 0; i < id.length(); i++) if (ALPHABET.indexOf(id.charAt(i)) < 0) return false;
        return true;
    }
}
