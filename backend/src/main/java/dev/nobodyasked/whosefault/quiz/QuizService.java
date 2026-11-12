package dev.nobodyasked.whosefault.quiz;

import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Ids;
import dev.nobodyasked.whosefault.common.RateLimiter;
import dev.nobodyasked.whosefault.players.PlayerRepository;
import dev.nobodyasked.whosefault.quiz.QuizRepository.Answer;
import dev.nobodyasked.whosefault.quiz.QuizRepository.QuestionStat;
import dev.nobodyasked.whosefault.quiz.QuizRepository.ShareStat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizService {

    public static final Set<String> GRADES = Set.of("ace", "veteran", "otaku", "newbie", "relicense");
    public static final Set<String> EVENT_KINDS = Set.of("quiz_start", "share_click", "share_visit",
            "qshare_click", "qshare_visit", "qshare_answer");
    private static final Pattern QID = Pattern.compile("[a-z0-9_]{1,16}");
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    static final int DAYS = 14;

    public record DayRow(String day, long starts, long completions) {}
    public record Totals(long completions, long players, long completionsToday, long playersToday,
                         long starts, long startsToday, Double avgScore, long shareClicks, long shareVisits) {}
    public record Stats(Totals totals, Map<String, Long> grades, List<DayRow> daily, List<QuestionStat> questions,
                        List<ShareStat> shares) {}

    private final QuizRepository repo;
    private final PlayerRepository players;
    private final RateLimiter limiter;

    public QuizService(QuizRepository repo, PlayerRepository players, RateLimiter limiter) {
        this.repo = repo;
        this.players = players;
        this.limiter = limiter;
    }

    @Transactional
    public void saveResult(String uid, Integer score, String grade, List<Answer> answers) {
        if (score == null || score < 0 || score > 100) throw ApiException.badRequest("invalid_score", "점수가 올바르지 않아요.");
        if (!GRADES.contains(grade)) throw ApiException.badRequest("invalid_grade", "등급이 올바르지 않아요.");
        List<Answer> list = answers == null ? List.of() : answers;
        if (list.size() > 20) throw ApiException.badRequest("too_many_answers", "답이 너무 많아요.");
        for (Answer a : list) {
            if (a == null || a.qid() == null || !QID.matcher(a.qid()).matches() || !validRatio(a.guess()) || !validRatio(a.answer())) {
                throw ApiException.badRequest("invalid_answer", "문제 답 형식이 올바르지 않아요.");
            }
        }
        if (!limiter.tryAcquire("quiz:" + uid, 1, 10_000)) throw ApiException.tooMany("잠시 후 다시 시도해주세요.");
        long now = System.currentTimeMillis();
        String id = Ids.random(12);
        repo.insertResult(id, uid, score, grade, now);
        for (Answer a : list) repo.insertAnswer(id, a, now);
        players.saveBest(uid, score, now);
    }

    public void event(String uid, String kind, String grade, String qid) {
        if (!EVENT_KINDS.contains(kind)) throw ApiException.badRequest("invalid_kind", "알 수 없는 이벤트예요.");
        String g = GRADES.contains(grade) ? grade : null;
        String q = qid != null && QID.matcher(qid).matches() ? qid : null;
        if (kind.startsWith("qshare_") && q == null) throw ApiException.badRequest("invalid_qid", "문제 번호가 올바르지 않아요.");
        if (!limiter.tryAcquire("event:" + uid, 60, 3_600_000)) return; // 넘치면 조용히 버린다
        repo.insertEvent(kind, g, q, uid, System.currentTimeMillis());
    }

    public Stats stats() {
        long today = LocalDate.now(KST).atStartOfDay(KST).toInstant().toEpochMilli();
        long from = LocalDate.now(KST).minusDays(DAYS - 1).atStartOfDay(KST).toInstant().toEpochMilli();
        Totals totals = new Totals(repo.countResults(0), repo.countPlayers(0), repo.countResults(today), repo.countPlayers(today),
                repo.countEvents("quiz_start", 0), repo.countEvents("quiz_start", today), repo.avgScore(),
                repo.countEvents("share_click", 0), repo.countEvents("share_visit", 0));

        Map<String, Long> grades = new LinkedHashMap<>();
        for (String g : List.of("ace", "veteran", "otaku", "newbie", "relicense")) grades.put(g, 0L);
        for (Map.Entry<String, Long> e : repo.gradeCounts()) grades.merge(e.getKey(), e.getValue(), Long::sum);

        Map<LocalDate, long[]> days = new LinkedHashMap<>();
        for (int i = DAYS - 1; i >= 0; i--) days.put(LocalDate.now(KST).minusDays(i), new long[2]);
        for (long t : repo.eventTimesSince("quiz_start", from)) bump(days, t, 0);
        for (long t : repo.resultTimesSince(from)) bump(days, t, 1);
        List<DayRow> daily = new ArrayList<>();
        days.forEach((d, v) -> daily.add(new DayRow(d.toString(), v[0], v[1])));

        List<QuestionStat> qs = new ArrayList<>(repo.questionStats());
        qs.sort(Comparator.comparingDouble(QuestionStat::avgDiff).reversed());

        // 문제별 공유: 많이 공유된 문제가 맨 앞
        Map<String, long[]> sh = new LinkedHashMap<>();
        for (QuizRepository.KindCount r : repo.shareCounts()) {
            long[] v = sh.computeIfAbsent(r.qid(), k -> new long[3]);
            switch (r.kind()) {
                case "qshare_click" -> v[0] += r.n();
                case "qshare_visit" -> v[1] += r.n();
                case "qshare_answer" -> v[2] += r.n();
                default -> { }
            }
        }
        List<ShareStat> shares = new ArrayList<>();
        sh.forEach((q, v) -> shares.add(new ShareStat(q, v[0], v[1], v[2])));
        shares.sort(Comparator.comparingLong(ShareStat::clicks).thenComparingLong(ShareStat::visits).reversed());
        return new Stats(totals, grades, daily, qs, shares);
    }

    private static void bump(Map<LocalDate, long[]> days, long epochMs, int idx) {
        long[] v = days.get(Instant.ofEpochMilli(epochMs).atZone(KST).toLocalDate());
        if (v != null) v[idx]++;
    }

    /** 최고점(0~100)을 등급으로. 프론트 GRADES와 같은 경계(90, 70, 50, 30). 기록이 없으면 null */
    public static String gradeOf(Integer best) {
        if (best == null) return null;
        if (best >= 90) return "ace";
        if (best >= 70) return "veteran";
        if (best >= 50) return "otaku";
        if (best >= 30) return "newbie";
        return "relicense";
    }

    private static boolean validRatio(int v) {
        return v >= 0 && v <= 100 && v % 10 == 0;
    }
}
