package dev.nobodyasked.whosefault.cases;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;

public final class CaseDtos {
    private CaseDtos() {}

    public record CreateCaseRequest(String title, String desc, JsonNode spec) {}

    public record VoteRequest(String choice, Boolean disagree) {}

    public record CaseItem(String id, String title, String desc, JsonNode spec, long createdAt, int reports, boolean hidden) {}

    public record Created(String id) {}

    public record MyVote(String choice, int a, boolean disagree) {}

    /** median은 A 과실(%) 기준 중앙값. 5표 미만이면 프론트가 판결 대기로 표시한다. */
    public record VoteSummary(int total, Map<String, Integer> counts, int disagree, Integer median) {}

    public record CommentItem(String id, String nick, String choice, int a, String text, long at,
                              int likes, boolean liked, boolean mine, boolean veteran, boolean hidden, int reports) {}

    /**
     * 사고 하나의 현재 상태. 투표하기 전에는 votes와 comments가 null이다
     * (다른 사람 선택에 휩쓸리지 않게 하려는 의도. 관리자는 예외).
     */
    public record CaseState(String caseId, int total, int commentCount, boolean caseHidden, int caseReports,
                            MyVote myVote, VoteSummary votes, List<CommentItem> comments, boolean admin) {}
}
