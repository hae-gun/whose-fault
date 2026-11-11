package dev.nobodyasked.whosefault.players;

import dev.nobodyasked.whosefault.auth.Auth;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 퀴즈 최고점. 댓글의 "베테랑" 배지에만 쓰인다.
 * 점수는 브라우저가 계산해서 보내므로 조작이 가능하다. 배지 이상의 의미를 두지 말 것.
 */
@RestController
public class PlayerController {

    public record BestRequest(Integer best) {}

    private final Auth auth;
    private final PlayerRepository players;

    public PlayerController(Auth auth, PlayerRepository players) {
        this.auth = auth;
        this.players = players;
    }

    @PutMapping("/api/players/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveBest(@RequestBody BestRequest body, HttpServletRequest req) {
        String uid = auth.requireUid(req);
        int best = body.best() == null ? 0 : Math.max(0, Math.min(100, body.best()));
        players.saveBest(uid, best, System.currentTimeMillis());
    }
}
