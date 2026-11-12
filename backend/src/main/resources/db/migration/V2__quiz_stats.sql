-- 퀴즈 통계. IP는 남기지 않는다. uid는 익명 토큰의 id라 사람을 특정할 수 없다.

CREATE TABLE quiz_results (
    id          VARCHAR(24) PRIMARY KEY,
    uid         VARCHAR(40) NOT NULL,
    score       INTEGER     NOT NULL,
    grade       VARCHAR(12) NOT NULL,
    created_at  BIGINT      NOT NULL
);
CREATE INDEX idx_quiz_results_created ON quiz_results (created_at);

-- 문제별 답. 정답률과 "직감과 기준이 가장 어긋나는 사고"를 찾는 용도
CREATE TABLE quiz_answers (
    result_id   VARCHAR(24) NOT NULL,
    qid         VARCHAR(16) NOT NULL,
    guess       INTEGER     NOT NULL,
    answer      INTEGER     NOT NULL,
    created_at  BIGINT      NOT NULL
);
CREATE INDEX idx_quiz_answers_qid ON quiz_answers (qid);

-- 가벼운 사용 이벤트: quiz_start, share_click, share_visit
CREATE TABLE events (
    kind        VARCHAR(16) NOT NULL,
    grade       VARCHAR(12),
    uid         VARCHAR(40) NOT NULL,
    created_at  BIGINT      NOT NULL
);
CREATE INDEX idx_events_kind_created ON events (kind, created_at);
