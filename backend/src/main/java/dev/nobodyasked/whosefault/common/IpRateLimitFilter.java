package dev.nobodyasked.whosefault.common;

import dev.nobodyasked.whosefault.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** IP당 분당 요청 수 제한. 폴링 5초 간격이면 정상 사용자는 분당 30회 안팎이다. */
@Component
public class IpRateLimitFilter extends OncePerRequestFilter {

    static final int PER_MINUTE = 240;

    private final RateLimiter limiter;
    private final AppProperties props;

    public IpRateLimitFilter(RateLimiter limiter, AppProperties props) {
        this.limiter = limiter;
        this.props = props;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/") || "OPTIONS".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String ip = ClientIp.of(req, props.trustProxyHeaders());
        if (!limiter.tryAcquire("ip:" + ip, PER_MINUTE, 60_000)) {
            res.setStatus(429);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\":\"rate_limited\",\"message\":\"요청이 너무 많아요. 잠시 후 다시 시도해주세요.\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
