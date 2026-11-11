package dev.nobodyasked.whosefault.auth;

import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.ClientIp;
import dev.nobodyasked.whosefault.common.RateLimiter;
import dev.nobodyasked.whosefault.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SessionController {

    private final TokenService tokens;
    private final RateLimiter limiter;
    private final AppProperties props;

    public SessionController(TokenService tokens, RateLimiter limiter, AppProperties props) {
        this.tokens = tokens;
        this.limiter = limiter;
        this.props = props;
    }

    /** 익명 세션 발급. 브라우저는 받은 토큰을 localStorage에 두고 계속 쓴다. */
    @PostMapping("/api/session")
    public Map<String, String> create(HttpServletRequest req) {
        String ip = ClientIp.of(req, props.trustProxyHeaders());
        if (!limiter.tryAcquire("session:" + ip, 30, 3_600_000)) {
            throw ApiException.tooMany("잠시 후 다시 시도해주세요.");
        }
        return Map.of("token", tokens.issue());
    }
}
