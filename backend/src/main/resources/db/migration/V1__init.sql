-- 몇 대 몇? 초기 스키마. PostgreSQL과 테스트용 H2(PostgreSQL 모드) 양쪽에서 돈다.
-- 시간은 모두 epoch millis(BIGINT). 식별자는 서버가 만든 base62 문자열.

CREATE TABLE cases (
    id          VARCHAR(24)  PRIMARY KEY,
    title       VARCHAR(40)  NOT NULL,
    descr       VARCHAR(120) NOT NULL DEFAULT '',
    spec        TEXT         NOT NULL,
    author_uid  VARCHAR(40)  NOT NULL,
    created_at  BIGINT       NOT NULL
);
CREATE INDEX idx_cases_created ON cases (created_at);
CREATE INDEX idx_cases_author ON cases (author_uid, created_at);

CREATE TABLE votes (
    case_id     VARCHAR(24) NOT NULL,
    uid         VARCHAR(40) NOT NULL,
    choice      VARCHAR(8)  NOT NULL,
    fault_a     INTEGER     NOT NULL,
    disagree    BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at  BIGINT      NOT NULL,
    PRIMARY KEY (case_id, uid)
);

CREATE TABLE comments (
    id          VARCHAR(24)  PRIMARY KEY,
    case_id     VARCHAR(24)  NOT NULL,
    uid         VARCHAR(40)  NOT NULL,
    body        VARCHAR(300) NOT NULL,
    choice      VARCHAR(8)   NOT NULL,
    fault_a     INTEGER      NOT NULL,
    created_at  BIGINT       NOT NULL
);
CREATE INDEX idx_comments_case ON comments (case_id, created_at);
CREATE INDEX idx_comments_created ON comments (created_at);

CREATE TABLE likes (
    comment_id  VARCHAR(24) NOT NULL,
    uid         VARCHAR(40) NOT NULL,
    case_id     VARCHAR(24) NOT NULL,
    created_at  BIGINT      NOT NULL,
    PRIMARY KEY (comment_id, uid)
);
CREATE INDEX idx_likes_case ON likes (case_id);

CREATE TABLE reports (
    kind        VARCHAR(10) NOT NULL,
    target_id   VARCHAR(24) NOT NULL,
    case_id     VARCHAR(24) NOT NULL,
    uid         VARCHAR(40) NOT NULL,
    reason      VARCHAR(40) NOT NULL,
    created_at  BIGINT      NOT NULL,
    PRIMARY KEY (kind, target_id, uid)
);
CREATE INDEX idx_reports_case ON reports (case_id);
CREATE INDEX idx_reports_created ON reports (created_at);

CREATE TABLE players (
    uid         VARCHAR(40) PRIMARY KEY,
    best        INTEGER     NOT NULL,
    updated_at  BIGINT      NOT NULL
);
