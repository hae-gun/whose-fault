package dev.nobodyasked.whosefault.quiz;

import dev.nobodyasked.whosefault.auth.Auth;
import dev.nobodyasked.whosefault.quiz.QuizRepository.Answer;
import dev.nobodyasked.whosefault.quiz.QuizService.Stats;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class QuizController {

    public record ResultRequest(Integer score, String grade, List<Answer> answers) {}
    public record EventRequest(String kind, String grade, String qid) {}

    private final Auth auth;
    private final QuizService quiz;

    public QuizController(Auth auth, QuizService quiz) {
        this.auth = auth;
        this.quiz = quiz;
    }

    /** 퀴즈 하나를 끝까지 풀었을 때. 최고점(베테랑 배지)도 함께 갱신한다. */
    @PostMapping("/api/quiz/results")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void result(@RequestBody ResultRequest body, HttpServletRequest req) {
        quiz.saveResult(auth.requireUid(req), body.score(), body.grade(), body.answers());
    }

    /** quiz_start, share_click, share_visit, 그리고 문제 하나 공유(qshare_click, qshare_visit, qshare_answer, qid 필수) */
    @PostMapping("/api/events")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void event(@RequestBody EventRequest body, HttpServletRequest req) {
        quiz.event(auth.requireUid(req), body.kind(), body.grade(), body.qid());
    }

    @GetMapping("/api/admin/quiz-stats")
    public Stats stats(HttpServletRequest req) {
        auth.requireAdmin(req);
        return quiz.stats();
    }
}
