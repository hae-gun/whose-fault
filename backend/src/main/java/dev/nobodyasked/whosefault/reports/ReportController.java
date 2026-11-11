package dev.nobodyasked.whosefault.reports;

import dev.nobodyasked.whosefault.auth.Auth;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReportController {

    public record ReportRequest(String type, String targetId, String reason) {}

    private final Auth auth;
    private final ReportService reports;

    public ReportController(Auth auth, ReportService reports) {
        this.auth = auth;
        this.reports = reports;
    }

    @PostMapping("/api/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(@RequestBody ReportRequest body, HttpServletRequest req) {
        reports.report(auth.requireUid(req), body.type(), body.targetId(), body.reason());
    }
}
