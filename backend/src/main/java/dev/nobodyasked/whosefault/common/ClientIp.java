package dev.nobodyasked.whosefault.common;

import jakarta.servlet.http.HttpServletRequest;

public final class ClientIp {
    private ClientIp() {}

    public static String of(HttpServletRequest req, boolean trustProxyHeaders) {
        if (trustProxyHeaders) {
            String cf = req.getHeader("CF-Connecting-IP");
            if (cf != null && !cf.isBlank()) return cf.trim();
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
