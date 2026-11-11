package dev.nobodyasked.whosefault.comments;

import dev.nobodyasked.whosefault.cases.CaseRepository;
import dev.nobodyasked.whosefault.cases.VoteRepository;
import dev.nobodyasked.whosefault.cases.VoteRepository.VoteRow;
import dev.nobodyasked.whosefault.comments.CommentRepository.CommentRow;
import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Ids;
import dev.nobodyasked.whosefault.common.RateLimiter;
import dev.nobodyasked.whosefault.common.TextFilter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {

    private final CommentRepository comments;
    private final CaseRepository cases;
    private final VoteRepository votes;
    private final RateLimiter limiter;

    public CommentService(CommentRepository comments, CaseRepository cases, VoteRepository votes, RateLimiter limiter) {
        this.comments = comments;
        this.cases = cases;
        this.votes = votes;
        this.limiter = limiter;
    }

    /** 댓글에는 쓴 사람의 투표가 진영 태그로 붙는다. 그래서 투표한 사람만 쓸 수 있다. */
    public String add(String uid, String caseId, String text) {
        String body = text == null ? "" : text.strip();
        if (body.isEmpty() || body.length() > 300) throw ApiException.badRequest("invalid_text", "댓글은 1자에서 300자 사이로 써주세요.");
        TextFilter.require(body);
        if (!cases.exists(caseId)) throw ApiException.notFound("사고");
        VoteRow vote = votes.find(caseId, uid)
                .orElseThrow(() -> ApiException.forbidden("vote_first", "투표한 뒤에 댓글을 쓸 수 있어요."));
        if (!limiter.tryAcquire("comment:" + uid, 1, 15_000)) throw ApiException.tooMany("댓글은 15초에 한 번씩 쓸 수 있어요.");
        String id = Ids.random(12);
        comments.insert(new CommentRow(id, caseId, uid, body, vote.choice(), vote.faultA(), System.currentTimeMillis()));
        return id;
    }

    @Transactional
    public void delete(String uid, String commentId, boolean admin) {
        CommentRow c = comments.find(commentId).orElseThrow(() -> ApiException.notFound("댓글"));
        if (!admin && !c.uid().equals(uid)) throw ApiException.forbidden("not_owner", "내 댓글만 지울 수 있어요.");
        comments.delete(commentId);
    }

    public void like(String uid, String commentId, boolean on) {
        CommentRow c = comments.find(commentId).orElseThrow(() -> ApiException.notFound("댓글"));
        if (!limiter.tryAcquire("like:" + uid, 60, 60_000)) throw ApiException.tooMany("너무 빨라요. 잠시 후 다시 시도해주세요.");
        if (on) comments.like(commentId, c.caseId(), uid, System.currentTimeMillis());
        else comments.unlike(commentId, uid);
    }
}
