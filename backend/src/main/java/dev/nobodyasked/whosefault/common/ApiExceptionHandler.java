package dev.nobodyasked.whosefault.common;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> api(ApiException e) {
        return ResponseEntity.status(e.status()).body(Map.of("error", e.code(), "message", e.getMessage()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, String>> badBody(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", "bad_request", "message", "요청 형식이 올바르지 않아요."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> unknown(Exception e) {
        if (e instanceof ErrorResponse er) {
            // 404(없는 경로), 405(메서드 불일치) 같은 스프링 표준 오류는 상태 코드를 그대로 돌려준다
            return ResponseEntity.status(er.getStatusCode()).body(Map.of("error", "http_" + er.getStatusCode().value(), "message", "요청을 처리할 수 없어요."));
        }
        log.error("unhandled", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "internal", "message", "서버에서 문제가 생겼어요. 잠시 후 다시 시도해주세요."));
    }
}
