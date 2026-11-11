package dev.nobodyasked.whosefault.common;

import org.springframework.http.HttpStatus;

/** 클라이언트에 그대로 내려가는 오류. code는 프론트가 분기할 때 쓰는 고정 문자열. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }

    public static ApiException badRequest(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
    public static ApiException unauthorized() { return new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "세션이 없거나 만료됐어요."); }
    public static ApiException forbidden(String code, String message) { return new ApiException(HttpStatus.FORBIDDEN, code, message); }
    public static ApiException notFound(String what) { return new ApiException(HttpStatus.NOT_FOUND, "not_found", what + "을(를) 찾을 수 없어요."); }
    public static ApiException tooMany(String message) { return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited", message); }
}
