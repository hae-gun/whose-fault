package dev.nobodyasked.whosefault.cases;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.nobodyasked.whosefault.cases.CaseDtos.CaseItem;
import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Ids;
import dev.nobodyasked.whosefault.common.RateLimiter;
import dev.nobodyasked.whosefault.common.TextFilter;
import dev.nobodyasked.whosefault.config.AppProperties;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CaseService {

    private final CaseRepository cases;
    private final SpecValidator validator;
    private final ObjectMapper mapper;
    private final RateLimiter limiter;
    private final AppProperties props;

    public CaseService(CaseRepository cases, SpecValidator validator, ObjectMapper mapper, RateLimiter limiter, AppProperties props) {
        this.cases = cases;
        this.validator = validator;
        this.mapper = mapper;
        this.limiter = limiter;
        this.props = props;
    }

    public String create(String uid, String title, String desc, JsonNode spec) {
        String t = title == null ? "" : title.strip();
        String d = desc == null ? "" : desc.strip();
        if (t.isEmpty() || t.length() > 40) throw ApiException.badRequest("invalid_title", "제목은 1자에서 40자 사이로 써주세요.");
        if (d.length() > 120) throw ApiException.badRequest("invalid_desc", "설명은 120자까지 쓸 수 있어요.");
        TextFilter.require(t + " " + d);
        ObjectNode normalized = validator.normalize(spec);
        if (!limiter.tryAcquire("case:" + uid, 1, 60_000)) throw ApiException.tooMany("사고는 1분에 하나씩 올릴 수 있어요.");
        if (!limiter.tryAcquire("case-day:" + uid, 30, 86_400_000)) throw ApiException.tooMany("오늘은 더 올릴 수 없어요.");
        String id = Ids.random(12);
        cases.insert(id, t, d, normalized.toString(), uid, System.currentTimeMillis());
        return id;
    }

    public List<CaseItem> list(int limit, boolean admin) {
        int n = Math.max(1, Math.min(limit, 100));
        return cases.recent(n).stream()
                .map(r -> new CaseItem(r.id(), r.title(), r.descr(), parse(r.spec()), r.createdAt(), admin ? r.reports() : 0,
                        r.reports() >= props.hideAtReports()))
                .filter(c -> admin || !c.hidden())
                .toList();
    }

    @Transactional
    public void delete(String id) {
        if (!cases.exists(id)) throw ApiException.notFound("사고");
        cases.deleteCascade(id);
    }

    private JsonNode parse(String json) {
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException e) {
            return mapper.createObjectNode();
        }
    }
}
