package dev.nobodyasked.whosefault;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.nobodyasked.whosefault.auth.TokenService;
import dev.nobodyasked.whosefault.common.Nick;
import dev.nobodyasked.whosefault.common.RateLimiter;
import dev.nobodyasked.whosefault.common.TextFilter;
import dev.nobodyasked.whosefault.config.AppProperties;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class UnitTest {

    private static AppProperties props(String secret) {
        return new AppProperties(secret, "admin", List.of(), false, 3);
    }

    @Test
    void textFilterBlocksPlatePhoneAndSwearing() {
        assertThat(TextFilter.check("12가 3456 차가 박음")).contains("차량 번호");
        assertThat(TextFilter.check("010-1234-5678로 연락")).contains("전화번호");
        assertThat(TextFilter.check("시 발 뭐야")).contains("욕설");
        assertThat(TextFilter.check("A도 속도를 줄였어야죠")).isNull();
    }

    @Test
    void tokenRoundTripAndTamper() {
        TokenService t = new TokenService(props("0123456789abcdef0123456789abcdef"));
        String token = t.issue();
        String uid = t.verify(token);
        assertThat(uid).isNotNull().hasSize(20);
        assertThat(t.verify(token + "x")).isNull();
        assertThat(t.verify("other." + token.split("\\.")[1])).isNull();
        TokenService other = new TokenService(props("ffffffffffffffffffffffffffffffff"));
        assertThat(other.verify(token)).isNull();
    }

    @Test
    void tokenSecretMustBeLong() {
        assertThatThrownBy(() -> new TokenService(props("short"))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rateLimiterFixedWindow() {
        AtomicLong now = new AtomicLong(0);
        RateLimiter r = new RateLimiter(now::get);
        assertThat(r.tryAcquire("k", 2, 1000)).isTrue();
        assertThat(r.tryAcquire("k", 2, 1000)).isTrue();
        assertThat(r.tryAcquire("k", 2, 1000)).isFalse();
        now.set(1000);
        assertThat(r.tryAcquire("k", 2, 1000)).isTrue();
    }

    @Test
    void nickIsStableAndMatchesFrontend() {
        // 프론트 nick('abc') 결과와 같아야 한다: h=96354 -> 96354%12=6 "엑셀", 10+96354%90=64
        assertThat(Nick.of("abc")).isEqualTo("엑셀 운전자 64");
    }
}
