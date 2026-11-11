package dev.nobodyasked.whosefault.players;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PlayerRepository {

    private final JdbcClient jdbc;

    public PlayerRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 최고점만 남긴다. */
    public void saveBest(String uid, int best, long now) {
        int n = jdbc.sql("UPDATE players SET best = :b, updated_at = :now WHERE uid = :u AND best < :b")
                .param("b", best).param("now", now).param("u", uid).update();
        if (n > 0) return;
        try {
            jdbc.sql("INSERT INTO players (uid, best, updated_at) VALUES (:u, :b, :now)")
                    .param("u", uid).param("b", best).param("now", now).update();
        } catch (DuplicateKeyException ignored) {
            // 이미 더 높은 점수가 있음
        }
    }

    public Map<String, Integer> bestOf(Collection<String> uids) {
        Map<String, Integer> out = new HashMap<>();
        if (uids.isEmpty()) return out;
        jdbc.sql("SELECT uid, best FROM players WHERE uid IN (:uids)").param("uids", uids)
                .query((rs, i) -> Map.entry(rs.getString("uid"), rs.getInt("best")))
                .list().forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }
}
