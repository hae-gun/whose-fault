package dev.nobodyasked.whosefault.cases;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class CaseRepository {

    /** 사고별 참여 집계. recent는 since 이후, active는 activeSince 이후 참여한 서로 다른 사람 수 */
    public record Activity(int votes, int recentVotes, int comments, int recentComments, int active) {
        static final Activity NONE = new Activity(0, 0, 0, 0, 0);
    }

    public record CaseRow(String id, String title, String descr, String spec, String authorUid, long createdAt, int reports) {}

    private final JdbcClient jdbc;

    public CaseRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(String id, String title, String descr, String spec, String authorUid, long now) {
        jdbc.sql("INSERT INTO cases (id, title, descr, spec, author_uid, created_at) VALUES (:id, :title, :descr, :spec, :uid, :now)")
                .param("id", id).param("title", title).param("descr", descr).param("spec", spec)
                .param("uid", authorUid).param("now", now)
                .update();
    }

    public List<CaseRow> recent(int limit) {
        return jdbc.sql("""
                        SELECT c.id, c.title, c.descr, c.spec, c.author_uid, c.created_at,
                               (SELECT COUNT(*) FROM reports r WHERE r.kind = 'case' AND r.target_id = c.id) AS reports
                        FROM cases c ORDER BY c.created_at DESC LIMIT :limit""")
                .param("limit", limit)
                .query((rs, i) -> new CaseRow(rs.getString("id"), rs.getString("title"), rs.getString("descr"),
                        rs.getString("spec"), rs.getString("author_uid"), rs.getLong("created_at"), rs.getInt("reports")))
                .list();
    }

    public Map<String, Activity> activity(long since, long activeSince) {
        Map<String, int[]> m = new HashMap<>();
        jdbc.sql("""
                        SELECT case_id, COUNT(*) AS n, SUM(CASE WHEN updated_at >= :since THEN 1 ELSE 0 END) AS r
                        FROM votes GROUP BY case_id""")
                .param("since", since)
                .query((rs, i) -> { int[] v = m.computeIfAbsent(rs.getString("case_id"), k -> new int[5]);
                    v[0] = rs.getInt("n"); v[1] = rs.getInt("r"); return null; }).list();
        jdbc.sql("""
                        SELECT case_id, COUNT(*) AS n, SUM(CASE WHEN created_at >= :since THEN 1 ELSE 0 END) AS r
                        FROM comments GROUP BY case_id""")
                .param("since", since)
                .query((rs, i) -> { int[] v = m.computeIfAbsent(rs.getString("case_id"), k -> new int[5]);
                    v[2] = rs.getInt("n"); v[3] = rs.getInt("r"); return null; }).list();
        jdbc.sql("""
                        SELECT case_id, COUNT(DISTINCT uid) AS n FROM (
                          SELECT case_id, uid FROM votes WHERE updated_at >= :a
                          UNION SELECT case_id, uid FROM comments WHERE created_at >= :a) t
                        GROUP BY case_id""")
                .param("a", activeSince)
                .query((rs, i) -> { int[] v = m.computeIfAbsent(rs.getString("case_id"), k -> new int[5]);
                    v[4] = rs.getInt("n"); return null; }).list();
        Map<String, Activity> out = new HashMap<>();
        m.forEach((k, v) -> out.put(k, new Activity(v[0], v[1], v[2], v[3], v[4])));
        return out;
    }

    public Optional<String> title(String id) {
        return jdbc.sql("SELECT title FROM cases WHERE id = :id").param("id", id).query(String.class).optional();
    }

    public boolean exists(String id) {
        return title(id).isPresent();
    }

    public long countByAuthorSince(String uid, long since) {
        return jdbc.sql("SELECT COUNT(*) FROM cases WHERE author_uid = :uid AND created_at >= :since")
                .param("uid", uid).param("since", since).query(Long.class).single();
    }

    /** 사고와 거기 달린 투표, 댓글, 공감, 신고를 모두 지운다. */
    public void deleteCascade(String id) {
        jdbc.sql("DELETE FROM likes WHERE case_id = :id").param("id", id).update();
        jdbc.sql("DELETE FROM comments WHERE case_id = :id").param("id", id).update();
        jdbc.sql("DELETE FROM votes WHERE case_id = :id").param("id", id).update();
        jdbc.sql("DELETE FROM reports WHERE case_id = :id").param("id", id).update();
        jdbc.sql("DELETE FROM cases WHERE id = :id").param("id", id).update();
    }
}
