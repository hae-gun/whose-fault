package dev.nobodyasked.whosefault.admin;

import dev.nobodyasked.whosefault.auth.Auth;
import dev.nobodyasked.whosefault.cases.CaseRepository;
import dev.nobodyasked.whosefault.cases.CaseService;
import dev.nobodyasked.whosefault.comments.CommentRepository;
import dev.nobodyasked.whosefault.comments.CommentRepository.CommentRow;
import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Ids;
import dev.nobodyasked.whosefault.common.Nick;
import dev.nobodyasked.whosefault.reports.ReportRepository;
import dev.nobodyasked.whosefault.reports.ReportRepository.ReportRow;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 전용. 모든 요청에 X-Admin-Token 헤더가 필요하다. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    public record ReportGroup(String type, String targetId, String caseId, int count, List<String> reasons, String preview, long lastAt) {}
    public record AdminComment(String id, String caseId, String caseTitle, String nick, String text, long at) {}
    public record DismissRequest(String type, String targetId) {}

    private final Auth auth;
    private final ReportRepository reports;
    private final CommentRepository comments;
    private final CaseRepository cases;
    private final CaseService caseService;

    public AdminController(Auth auth, ReportRepository reports, CommentRepository comments, CaseRepository cases, CaseService caseService) {
        this.auth = auth;
        this.reports = reports;
        this.comments = comments;
        this.cases = cases;
        this.caseService = caseService;
    }

    @GetMapping("/me")
    public Map<String, Boolean> me(HttpServletRequest req) {
        auth.requireAdmin(req);
        return Map.of("admin", true);
    }

    @GetMapping("/reports")
    public List<ReportGroup> reports(HttpServletRequest req) {
        auth.requireAdmin(req);
        Map<String, List<ReportRow>> groups = new LinkedHashMap<>();
        for (ReportRow r : reports.recent(2000)) groups.computeIfAbsent(r.kind() + ":" + r.targetId(), k -> new ArrayList<>()).add(r);
        Map<String, String> titles = new HashMap<>();
        List<ReportGroup> out = new ArrayList<>();
        for (List<ReportRow> g : groups.values()) {
            ReportRow first = g.get(0);
            Set<String> reasons = new LinkedHashSet<>();
            long last = 0;
            for (ReportRow r : g) { reasons.add(r.reason()); last = Math.max(last, r.createdAt()); }
            String preview = "case".equals(first.kind())
                    ? titles.computeIfAbsent(first.targetId(), id -> cases.title(id).orElse(null))
                    : comments.find(first.targetId()).map(CommentRow::body).orElse(null);
            out.add(new ReportGroup(first.kind(), first.targetId(), first.caseId(), g.size(), List.copyOf(reasons), preview, last));
        }
        out.sort(Comparator.comparingInt(ReportGroup::count).reversed().thenComparing(Comparator.comparingLong(ReportGroup::lastAt).reversed()));
        return out;
    }

    @PostMapping("/reports/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@RequestBody DismissRequest body, HttpServletRequest req) {
        auth.requireAdmin(req);
        if (!Ids.valid(body.targetId()) || !("case".equals(body.type()) || "comment".equals(body.type()))) {
            throw ApiException.badRequest("invalid_target", "신고 대상이 올바르지 않아요.");
        }
        reports.dismiss(body.type(), body.targetId());
    }

    @GetMapping("/comments")
    public List<AdminComment> recentComments(@RequestParam(defaultValue = "100") int limit, HttpServletRequest req) {
        auth.requireAdmin(req);
        Map<String, String> titles = new HashMap<>();
        return comments.recent(Math.max(1, Math.min(limit, 300))).stream()
                .map(c -> new AdminComment(c.id(), c.caseId(),
                        titles.computeIfAbsent(c.caseId(), id -> cases.title(id).orElse("삭제된 사고")),
                        Nick.of(c.uid()), c.body(), c.createdAt()))
                .toList();
    }

    @DeleteMapping("/cases/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCase(@PathVariable String id, HttpServletRequest req) {
        auth.requireAdmin(req);
        if (!Ids.valid(id)) throw ApiException.notFound("사고");
        caseService.delete(id);
    }
}
