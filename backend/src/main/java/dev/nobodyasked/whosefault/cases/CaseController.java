package dev.nobodyasked.whosefault.cases;

import dev.nobodyasked.whosefault.auth.Auth;
import dev.nobodyasked.whosefault.cases.CaseDtos.CaseItem;
import dev.nobodyasked.whosefault.cases.CaseDtos.CaseState;
import dev.nobodyasked.whosefault.cases.CaseDtos.CreateCaseRequest;
import dev.nobodyasked.whosefault.cases.CaseDtos.Created;
import dev.nobodyasked.whosefault.cases.CaseDtos.VoteRequest;
import dev.nobodyasked.whosefault.common.ApiException;
import dev.nobodyasked.whosefault.common.Ids;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cases")
public class CaseController {

    private final Auth auth;
    private final CaseService cases;
    private final VoteService votes;
    private final CaseStateService states;

    public CaseController(Auth auth, CaseService cases, VoteService votes, CaseStateService states) {
        this.auth = auth;
        this.cases = cases;
        this.votes = votes;
        this.states = states;
    }

    @GetMapping
    public List<CaseItem> list(@RequestParam(defaultValue = "60") int limit, HttpServletRequest req) {
        return cases.list(limit, auth.isAdmin(req));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Created create(@RequestBody CreateCaseRequest body, HttpServletRequest req) {
        String uid = auth.requireUid(req);
        return new Created(cases.create(uid, body.title(), body.desc(), body.spec()));
    }

    @GetMapping("/{id}/state")
    public CaseState state(@PathVariable String id, HttpServletRequest req) {
        checkId(id);
        return states.state(id, auth.optionalUid(req), auth.isAdmin(req));
    }

    @PutMapping("/{id}/vote")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void vote(@PathVariable String id, @RequestBody VoteRequest body, HttpServletRequest req) {
        checkId(id);
        String uid = auth.requireUid(req);
        votes.cast(uid, id, body.choice(), Boolean.TRUE.equals(body.disagree()));
    }

    static void checkId(String id) {
        if (!Ids.valid(id)) throw ApiException.notFound("사고");
    }
}
