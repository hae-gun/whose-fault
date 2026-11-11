package dev.nobodyasked.whosefault.reports;

import dev.nobodyasked.whosefault.cases.CaseRepository;
import dev.nobodyasked.whosefault.comments.CommentRepository;
import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Ids;
import dev.nobodyasked.whosefault.common.RateLimiter;
import dev.nobodyasked.whosefault.reports.ReportRepository.ReportRow;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class ReportService {

    public static final Set<String> REASONS = Set.of("욕설, 비방", "개인정보 (차량 번호, 실명 등)", "도배, 광고", "기타");

    private final ReportRepository reports;
    private final CaseRepository cases;
    private final CommentRepository comments;
    private final RateLimiter limiter;

    public ReportService(ReportRepository reports, CaseRepository cases, CommentRepository comments, RateLimiter limiter) {
        this.reports = reports;
        this.cases = cases;
        this.comments = comments;
        this.limiter = limiter;
    }

    public void report(String uid, String kind, String targetId, String reason) {
        if (!REASONS.contains(reason)) throw ApiException.badRequest("invalid_reason", "신고 사유를 골라주세요.");
        if (!Ids.valid(targetId)) throw ApiException.notFound("신고 대상");
        String caseId;
        if ("case".equals(kind)) {
            if (!cases.exists(targetId)) throw ApiException.notFound("사고");
            caseId = targetId;
        } else if ("comment".equals(kind)) {
            caseId = comments.find(targetId).orElseThrow(() -> ApiException.notFound("댓글")).caseId();
        } else {
            throw ApiException.badRequest("invalid_kind", "알 수 없는 신고 대상이에요.");
        }
        if (!limiter.tryAcquire("report:" + uid, 30, 3_600_000)) throw ApiException.tooMany("신고가 너무 많아요. 잠시 후 다시 시도해주세요.");
        reports.upsert(new ReportRow(kind, targetId, caseId, uid, reason, System.currentTimeMillis()));
    }
}
