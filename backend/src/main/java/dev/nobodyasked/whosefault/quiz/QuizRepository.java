package dev.nobodyasked.whosefault.quiz;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class QuizRepository {

    public record Answer(String qid, int guess, int answer) {}
    public record ShareStat(String qid, long clicks, long visits, long answers) {}
    public record KindCount(String qid, String kind, long n) {}
    public record QuestionStat(String qid, int n, int exact, double avgDiff, double avgGuess, int answer) {}

    private final JdbcClient jdbc;

    public QuizRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insertResult(String id, String uid, int score, String grade, long now) {
        jdbc.sql("INSERT INTO quiz_results (id, uid, score, grade, created_at) VALUES (:id, :u, :s, :g, :t)")
                .param("id", id).param("u", uid).param("s", score).param("g", grade).param("t", now).update();
    }

    public void insertAnswer(String resultId, Answer a, long now) {
        jdbc.sql("INSERT INTO quiz_answers (result_id, qid, guess, answer, created_at) VALUES (:r, :q, :g, :a, :t)")
                .param("r", resultId).param("q", a.qid()).param("g", a.guess()).param("a", a.answer()).param("t", now).update();
    }

    public void insertEvent(String kind, String grade, String qid, String uid, long now) {
        jdbc.sql("INSERT INTO events (kind, grade, qid, uid, created_at) VALUES (:k, :g, :q, :u, :t)")
                .param("k", kind).param("g", grade).param("q", qid).param("u", uid).param("t", now).update();
    }

    public List<KindCount> shareCounts() {
        return jdbc.sql("SELECT qid, kind, COUNT(*) AS n FROM events WHERE qid IS NOT NULL AND kind LIKE 'qshare%' GROUP BY qid, kind")
                .query((rs, i) -> new KindCount(rs.getString("qid"), rs.getString("kind"), rs.getLong("n"))).list();
    }

    public long countResults(long since) {
        return jdbc.sql("SELECT COUNT(*) FROM quiz_results WHERE created_at >= :s").param("s", since).query(Long.class).single();
    }

    public long countPlayers(long since) {
        return jdbc.sql("SELECT COUNT(DISTINCT uid) FROM quiz_results WHERE created_at >= :s").param("s", since).query(Long.class).single();
    }

    public Double avgScore() {
        return jdbc.sql("SELECT AVG(score) FROM quiz_results").query(Double.class).optional().orElse(null);
    }

    public long countEvents(String kind, long since) {
        return jdbc.sql("SELECT COUNT(*) FROM events WHERE kind = :k AND created_at >= :s")
                .param("k", kind).param("s", since).query(Long.class).single();
    }

    public List<Map.Entry<String, Long>> gradeCounts() {
        return jdbc.sql("SELECT grade, COUNT(*) AS n FROM quiz_results GROUP BY grade")
                .query((rs, i) -> Map.entry(rs.getString("grade"), rs.getLong("n"))).list();
    }

    public List<Long> resultTimesSince(long since) {
        return jdbc.sql("SELECT created_at FROM quiz_results WHERE created_at >= :s LIMIT 100000")
                .param("s", since).query(Long.class).list();
    }

    public List<Long> eventTimesSince(String kind, long since) {
        return jdbc.sql("SELECT created_at FROM events WHERE kind = :k AND created_at >= :s LIMIT 100000")
                .param("k", kind).param("s", since).query(Long.class).list();
    }

    public List<QuestionStat> questionStats() {
        return jdbc.sql("""
                        SELECT qid, COUNT(*) AS n,
                               SUM(CASE WHEN guess = answer THEN 1 ELSE 0 END) AS exact,
                               AVG(ABS(guess - answer)) AS avg_diff,
                               AVG(guess) AS avg_guess,
                               MAX(answer) AS answer
                        FROM quiz_answers GROUP BY qid""")
                .query((rs, i) -> new QuestionStat(rs.getString("qid"), rs.getInt("n"), rs.getInt("exact"),
                        rs.getDouble("avg_diff"), rs.getDouble("avg_guess"), rs.getInt("answer")))
                .list();
    }
}
