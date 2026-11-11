package dev.nobodyasked.whosefault.auth;

import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class Auth {

    private final TokenService tokens;
    private final AppProperties props;

    public Auth(TokenService tokens, AppProperties props) {
        this.tokens = tokens;
        this.props = props;
    }

    /** 토큰이 있고 올바르면 uid, 아니면 null. */
    public String optionalUid(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        if (h == null || !h.startsWith("Bearer ")) return null;
        return tokens.verify(h.substring(7).trim());
    }

    public String requireUid(HttpServletRequest req) {
        String uid = optionalUid(req);
        if (uid == null) throw ApiException.unauthorized();
        return uid;
    }

    public boolean isAdmin(HttpServletRequest req) {
        String configured = props.adminToken();
        String given = req.getHeader("X-Admin-Token");
        if (configured == null || configured.isBlank() || given == null) return false;
        return MessageDigest.isEqual(configured.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
    }

    public void requireAdmin(HttpServletRequest req) {
        if (!isAdmin(req)) throw new ApiException(HttpStatus.FORBIDDEN, "admin_only", "관리자만 할 수 있어요.");
    }
}
