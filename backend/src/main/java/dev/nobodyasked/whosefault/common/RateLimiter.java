package dev.nobodyasked.whosefault.common;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.stereotype.Component;

/**
 * 고정 창(fixed window) 레이트리밋. 서버 한 대 기준 메모리 구현이다.
 * 서버를 여러 대로 늘리면 Redis INCR + EXPIRE로 바꿔야 한다.
 */
@Component
public class RateLimiter {

    private record Window(long start, int count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final LongSupplier clock;

    public RateLimiter() {
        this(System::currentTimeMillis);
    }

    public RateLimiter(LongSupplier clock) {
        this.clock = clock;
    }

    /** key에 대해 windowMs 안에 limit번까지 허용. 허용되면 true. */
    public boolean tryAcquire(String key, int limit, long windowMs) {
        long now = clock.getAsLong();
        if (windows.size() > 200_000) cleanup(now, windowMs);
        Window w = windows.compute(key, (k, old) -> {
            if (old == null || now - old.start() >= windowMs) return new Window(now, 1);
            return new Window(old.start(), old.count() + 1);
        });
        return w.count() <= limit;
    }

    private void cleanup(long now, long windowMs) {
        windows.entrySet().removeIf(e -> now - e.getValue().start() >= Math.max(windowMs, 3_600_000L));
    }
}
