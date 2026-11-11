package dev.nobodyasked.whosefault.auth;

import dev.nobodyasked.whosefault.common.Ids;
import dev.nobodyasked.whosefault.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * 로그인 없는 익명 사용자 토큰. "uid.서명" 형태이고 서명은 HMAC-SHA256.
 * 남의 uid를 사칭해 투표나 댓글을 조작하는 것을 막는 용도다.
 */
@Component
public class TokenService {

    private final byte[] secret;

    public TokenService(AppProperties props) {
        String s = props.tokenSecret();
        if (s == null || s.length() < 32) {
            throw new IllegalStateException("whosefault.token-secret(TOKEN_SECRET)은 32자 이상이어야 합니다.");
        }
        this.secret = s.getBytes(StandardCharsets.UTF_8);
    }

    public String issue() {
        String uid = Ids.random(20);
        return uid + "." + sign(uid);
    }

    /** 올바른 토큰이면 uid, 아니면 null. */
    public String verify(String token) {
        if (token == null) return null;
        int dot = token.indexOf('.');
        if (dot <= 0 || dot == token.length() - 1) return null;
        String uid = token.substring(0, dot);
        if (!Ids.valid(uid)) return null;
        byte[] expected = sign(uid).getBytes(StandardCharsets.US_ASCII);
        byte[] actual = token.substring(dot + 1).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, actual) ? uid : null;
    }

    private String sign(String uid) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] sig = mac.doFinal(uid.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
