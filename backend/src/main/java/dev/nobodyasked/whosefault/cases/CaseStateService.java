package dev.nobodyasked.whosefault.cases;

import dev.nobodyasked.whosefault.cases.CaseDtos.CaseState;
import dev.nobodyasked.whosefault.cases.CaseDtos.CommentItem;
import dev.nobodyasked.whosefault.cases.CaseDtos.MyVote;
import dev.nobodyasked.whosefault.cases.CaseDtos.VoteSummary;
import dev.nobodyasked.whosefault.cases.VoteRepository.VoteRow;
import dev.nobodyasked.whosefault.comments.CommentRepository;
import dev.nobodyasked.whosefault.comments.CommentRepository.CommentRow;
import dev.nobodyasked.whosefault.comments.CommentRepository.LikeRow;
import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Nick;
import dev.nobodyasked.whosefault.config.AppProperties;
import dev.nobodyasked.whosefault.players.PlayerRepository;
import dev.nobodyasked.whosefault.reports.ReportRepository;
import dev.nobodyasked.whosefault.reports.ReportRepository.ReportRow;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/** 프론트가 5초마다 가져가는 사고 상태를 한 번에 조립한다. */
@Service
public class CaseStateService {

    static final int VETERAN_SCORE = 70;

    private final CaseRepository cases;
    private final VoteRepository votes;
    private final CommentRepository comments;
    private final ReportRepository reports;
    private final PlayerRepository players;
    private final AppProperties props;

    public CaseStateService(CaseRepository cases, VoteRepository votes, CommentRepository comments,
                            ReportRepository reports, PlayerRepository players, AppProperties props) {
        this.cases = cases;
        this.votes = votes;
        this.comments = comments;
        this.reports = reports;
        this.players = players;
        this.props = props;
    }

    public CaseState state(String caseId, String uid, boolean admin) {
        if (!cases.exists(caseId)) throw ApiException.notFound("사고");
        List<VoteRow> rows = votes.byCase(caseId);
        List<ReportRow> rs = reports.byCase(caseId);
        Map<String, Integer> reportCount = new HashMap<>();
        for (ReportRow r : rs) reportCount.merge(r.kind() + ":" + r.targetId(), 1, Integer::sum);
        int caseReports = reportCount.getOrDefault("case:" + caseId, 0);
        boolean caseHidden = caseReports >= props.hideAtReports();
        if (caseHidden && !admin) {
            return new CaseState(caseId, 0, 0, true, 0, null, null, null, false);
        }

        MyVote mine = null;
        for (VoteRow v : rows) if (v.uid().equals(uid)) mine = new MyVote(v.choice(), v.faultA(), v.disagree());
        int commentCount = comments.countByCase(caseId);
        if (mine == null && !admin) {
            return new CaseState(caseId, rows.size(), commentCount, false, 0, null, null, null, false);
        }

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String k : Choices.A_FAULT.keySet()) counts.put(k, 0);
        int disagree = 0;
        List<Integer> faults = new ArrayList<>();
        for (VoteRow v : rows) {
            counts.merge(v.choice(), 1, Integer::sum);
            if (v.disagree()) disagree++;
            faults.add(v.faultA());
        }
        faults.sort(Integer::compare);
        Integer median = faults.isEmpty() ? null : faults.get((faults.size() - 1) / 2);
        VoteSummary summary = new VoteSummary(rows.size(), counts, disagree, median);

        List<CommentRow> cs = comments.byCase(caseId, 400);
        Map<String, Integer> likeCount = new HashMap<>();
        Set<String> likedByMe = new HashSet<>();
        for (LikeRow l : comments.likesByCase(caseId)) {
            likeCount.merge(l.commentId(), 1, Integer::sum);
            if (l.uid().equals(uid)) likedByMe.add(l.commentId());
        }
        Set<String> authors = new HashSet<>();
        for (CommentRow c : cs) authors.add(c.uid());
        Map<String, Integer> best = players.bestOf(authors);

        List<CommentItem> items = new ArrayList<>();
        for (CommentRow c : cs) {
            int rc = reportCount.getOrDefault("comment:" + c.id(), 0);
            boolean hidden = rc >= props.hideAtReports();
            items.add(new CommentItem(c.id(), Nick.of(c.uid()), c.choice(), c.faultA(),
                    hidden && !admin ? null : c.body(), c.createdAt(),
                    likeCount.getOrDefault(c.id(), 0), likedByMe.contains(c.id()), c.uid().equals(uid),
                    best.getOrDefault(c.uid(), 0) >= VETERAN_SCORE, hidden, admin ? rc : 0));
        }
        return new CaseState(caseId, rows.size(), commentCount, caseHidden, admin ? caseReports : 0, mine, summary, items, admin);
    }
}
