package dev.nobodyasked.whosefault.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * whosefault.* 설정.
 *
 * @param tokenSecret      익명 사용자 토큰 서명 키 (32자 이상)
 * @param adminToken       관리자 토큰. 비어 있으면 관리자 기능이 모두 막힌다
 * @param allowedOrigins   CORS 허용 Origin
 * @param trustProxyHeaders CF-Connecting-IP, X-Forwarded-For를 믿을지 (리버스 프록시 뒤일 때만 true)
 * @param hideAtReports    신고가 이 수 이상이면 일반 사용자에게 가림
 */
@ConfigurationProperties(prefix = "whosefault")
public record AppProperties(
        String tokenSecret,
        String adminToken,
        List<String> allowedOrigins,
        boolean trustProxyHeaders,
        int hideAtReports) {

    public AppProperties {
        if (allowedOrigins == null) allowedOrigins = List.of();
        if (hideAtReports <= 0) hideAtReports = 3;
    }
}
