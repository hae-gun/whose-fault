package dev.nobodyasked.whosefault.reports;

import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ReportRepository {

    public record ReportRow(String kind, String targetId, String caseId, String uid, String reason, long createdAt) {}

    private final JdbcClient jdbc;

    public ReportRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static ReportRow map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ReportRow(rs.getString("kind"), rs.getString("target_id"), rs.getString("case_id"),
                rs.getString("uid"), rs.getString("reason"), rs.getLong("created_at"));
    }

    /** 같은 사람이 같은 대상을 다시 신고하면 사유만 바꾼다. */
    public void upsert(ReportRow r) {
        try {
            jdbc.sql("""
                            INSERT INTO reports (kind, target_id, case_id, uid, reason, created_at)
                            VALUES (:k, :t, :c, :u, :r, :now)""")
                    .param("k", r.kind()).param("t", r.targetId()).param("c", r.caseId()).param("u", r.uid())
                    .param("r", r.reason()).param("now", r.createdAt()).update();
        } catch (DuplicateKeyException e) {
            jdbc.sql("UPDATE reports SET reason = :r, created_at = :now WHERE kind = :k AND target_id = :t AND uid = :u")
                    .param("k", r.kind()).param("t", r.targetId()).param("u", r.uid())
                    .param("r", r.reason()).param("now", r.createdAt()).update();
        }
    }

    public List<ReportRow> byCase(String caseId) {
        return jdbc.sql("SELECT kind, target_id, case_id, uid, reason, created_at FROM reports WHERE case_id = :c")
                .param("c", caseId).query((rs, i) -> map(rs)).list();
    }

    public List<ReportRow> recent(int limit) {
        return jdbc.sql("SELECT kind, target_id, case_id, uid, reason, created_at FROM reports ORDER BY created_at DESC LIMIT :limit")
                .param("limit", limit).query((rs, i) -> map(rs)).list();
    }

    public void dismiss(String kind, String targetId) {
        jdbc.sql("DELETE FROM reports WHERE kind = :k AND target_id = :t").param("k", kind).param("t", targetId).update();
    }
}
