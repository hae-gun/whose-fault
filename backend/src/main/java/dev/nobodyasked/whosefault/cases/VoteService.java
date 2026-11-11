package dev.nobodyasked.whosefault.cases;

import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.RateLimiter;
import org.springframework.stereotype.Service;

@Service
public class VoteService {

    private final CaseRepository cases;
    private final VoteRepository votes;
    private final RateLimiter limiter;

    public VoteService(CaseRepository cases, VoteRepository votes, RateLimiter limiter) {
        this.cases = cases;
        this.votes = votes;
        this.limiter = limiter;
    }

    public void cast(String uid, String caseId, String choice, boolean disagree) {
        Integer faultA = Choices.A_FAULT.get(choice);
        if (faultA == null) throw ApiException.badRequest("invalid_choice", "알 수 없는 선택이에요.");
        if (!cases.exists(caseId)) throw ApiException.notFound("사고");
        if (!limiter.tryAcquire("vote:" + uid, 60, 60_000)) throw ApiException.tooMany("너무 빨라요. 잠시 후 다시 시도해주세요.");
        votes.upsert(caseId, uid, choice, faultA, disagree, System.currentTimeMillis());
    }
}
