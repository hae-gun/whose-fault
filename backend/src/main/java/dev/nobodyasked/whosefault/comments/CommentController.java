package dev.nobodyasked.whosefault.comments;

import dev.nobodyasked.whosefault.auth.Auth;
import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Ids;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CommentController {

    public record CommentRequest(String text) {}

    private final Auth auth;
    private final CommentService comments;

    public CommentController(Auth auth, CommentService comments) {
        this.auth = auth;
        this.comments = comments;
    }

    @PostMapping("/api/cases/{caseId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> add(@PathVariable String caseId, @RequestBody CommentRequest body, HttpServletRequest req) {
        check(caseId);
        String uid = auth.requireUid(req);
        return Map.of("id", comments.add(uid, caseId, body.text()));
    }

    @DeleteMapping("/api/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, HttpServletRequest req) {
        check(id);
        boolean admin = auth.isAdmin(req);
        String uid = admin ? auth.optionalUid(req) : auth.requireUid(req);
        comments.delete(uid, id, admin);
    }

    @PutMapping("/api/comments/{id}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void like(@PathVariable String id, HttpServletRequest req) {
        check(id);
        comments.like(auth.requireUid(req), id, true);
    }

    @DeleteMapping("/api/comments/{id}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlike(@PathVariable String id, HttpServletRequest req) {
        check(id);
        comments.like(auth.requireUid(req), id, false);
    }

    private static void check(String id) {
        if (!Ids.valid(id)) throw ApiException.notFound("대상");
    }
}
