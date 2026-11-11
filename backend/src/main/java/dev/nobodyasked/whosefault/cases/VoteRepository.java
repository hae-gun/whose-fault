package dev.nobodyasked.whosefault.cases;

import java.util.List;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class VoteRepository {

    public record VoteRow(String uid, String choice, int faultA, boolean disagree) {}

    private final JdbcClient jdbc;

    public VoteRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 한 사람 한 표. 이미 있으면 바꾼다. (UPDATE 먼저, 없으면 INSERT, 동시 INSERT 충돌 시 다시 UPDATE) */
    public void upsert(String caseId, String uid, String choice, int faultA, boolean disagree, long now) {
        if (update(caseId, uid, choice, faultA, disagree, now) > 0) return;
        try {
            jdbc.sql("""
                            INSERT INTO votes (case_id, uid, choice, fault_a, disagree, updated_at)
                            VALUES (:c, :u, :choice, :a, :d, :now)""")
                    .param("c", caseId).param("u", uid).param("choice", choice).param("a", faultA)
                    .param("d", disagree).param("now", now)
                    .update();
        } catch (DuplicateKeyException e) {
            update(caseId, uid, choice, faultA, disagree, now);
        }
    }

    private int update(String caseId, String uid, String choice, int faultA, boolean disagree, long now) {
        return jdbc.sql("""
                        UPDATE votes SET choice = :choice, fault_a = :a, disagree = :d, updated_at = :now
                        WHERE case_id = :c AND uid = :u""")
                .param("c", caseId).param("u", uid).param("choice", choice).param("a", faultA)
                .param("d", disagree).param("now", now)
                .update();
    }

    public List<VoteRow> byCase(String caseId) {
        return jdbc.sql("SELECT uid, choice, fault_a, disagree FROM votes WHERE case_id = :c")
                .param("c", caseId)
                .query((rs, i) -> new VoteRow(rs.getString("uid"), rs.getString("choice"), rs.getInt("fault_a"), rs.getBoolean("disagree")))
                .list();
    }

    public Optional<VoteRow> find(String caseId, String uid) {
        return jdbc.sql("SELECT uid, choice, fault_a, disagree FROM votes WHERE case_id = :c AND uid = :u")
                .param("c", caseId).param("u", uid)
                .query((rs, i) -> new VoteRow(rs.getString("uid"), rs.getString("choice"), rs.getInt("fault_a"), rs.getBoolean("disagree")))
                .optional();
    }
}
