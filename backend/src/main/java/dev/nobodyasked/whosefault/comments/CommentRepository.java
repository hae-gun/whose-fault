package dev.nobodyasked.whosefault.comments;

import java.util.List;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class CommentRepository {

    public record CommentRow(String id, String caseId, String uid, String body, String choice, int faultA, long createdAt) {}
    public record LikeRow(String commentId, String uid) {}

    private final JdbcClient jdbc;

    public CommentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static final String COLS = "id, case_id, uid, body, choice, fault_a, created_at";

    private static CommentRow map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new CommentRow(rs.getString("id"), rs.getString("case_id"), rs.getString("uid"), rs.getString("body"),
                rs.getString("choice"), rs.getInt("fault_a"), rs.getLong("created_at"));
    }

    public void insert(CommentRow c) {
        jdbc.sql("INSERT INTO comments (" + COLS + ") VALUES (:id, :c, :u, :b, :choice, :a, :t)")
                .param("id", c.id()).param("c", c.caseId()).param("u", c.uid()).param("b", c.body())
                .param("choice", c.choice()).param("a", c.faultA()).param("t", c.createdAt())
                .update();
    }

    public List<CommentRow> byCase(String caseId, int limit) {
        return jdbc.sql("SELECT " + COLS + " FROM comments WHERE case_id = :c ORDER BY created_at DESC LIMIT :limit")
                .param("c", caseId).param("limit", limit)
                .query((rs, i) -> map(rs)).list();
    }

    public int countByCase(String caseId) {
        return jdbc.sql("SELECT COUNT(*) FROM comments WHERE case_id = :c").param("c", caseId).query(Integer.class).single();
    }

    public List<CommentRow> recent(int limit) {
        return jdbc.sql("SELECT " + COLS + " FROM comments ORDER BY created_at DESC LIMIT :limit")
                .param("limit", limit).query((rs, i) -> map(rs)).list();
    }

    public Optional<CommentRow> find(String id) {
        return jdbc.sql("SELECT " + COLS + " FROM comments WHERE id = :id").param("id", id).query((rs, i) -> map(rs)).optional();
    }

    public void delete(String id) {
        jdbc.sql("DELETE FROM likes WHERE comment_id = :id").param("id", id).update();
        jdbc.sql("DELETE FROM reports WHERE kind = 'comment' AND target_id = :id").param("id", id).update();
        jdbc.sql("DELETE FROM comments WHERE id = :id").param("id", id).update();
    }

    public List<LikeRow> likesByCase(String caseId) {
        return jdbc.sql("SELECT comment_id, uid FROM likes WHERE case_id = :c").param("c", caseId)
                .query((rs, i) -> new LikeRow(rs.getString("comment_id"), rs.getString("uid"))).list();
    }

    public void like(String commentId, String caseId, String uid, long now) {
        try {
            jdbc.sql("INSERT INTO likes (comment_id, uid, case_id, created_at) VALUES (:id, :u, :c, :t)")
                    .param("id", commentId).param("u", uid).param("c", caseId).param("t", now).update();
        } catch (DuplicateKeyException ignored) {
            // 이미 공감함
        }
    }

    public void unlike(String commentId, String uid) {
        jdbc.sql("DELETE FROM likes WHERE comment_id = :id AND uid = :u").param("id", commentId).param("u", uid).update();
    }
}
