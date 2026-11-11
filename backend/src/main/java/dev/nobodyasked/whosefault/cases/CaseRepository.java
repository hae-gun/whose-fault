package dev.nobodyasked.whosefault.cases;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class CaseRepository {

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
