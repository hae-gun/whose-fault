# whose-fault-api

몇 대 몇? 판결 투표, 댓글, 신고, 관리자 기능을 맡는 백엔드입니다.
과실비율 계산은 하지 않습니다. 계산은 프론트(js/app.js) 룰 엔진이 합니다.

- Spring Boot 3.3.5, Java 21, Gradle
- PostgreSQL 16 + Flyway (테스트는 H2 PostgreSQL 모드)
- Spring JDBC `JdbcClient` (JPA 없이 SQL 직접)
- 패키지 `dev.nobodyasked.whosefault`

## 실행

```
cp .env.example .env              # 값 채우기
docker compose up -d db           # 로컬 DB (127.0.0.1:5433)

# 다른 터미널에서
export $(grep -v '^#' .env | xargs)
./gradlew bootRun                 # http://localhost:8080

./gradlew test                    # 단위 테스트 + API 전체 흐름 테스트 (DB 없이 H2로 돈다)
```

프론트는 레포 루트에서 `python3 -m http.server 8000` 후 http://localhost:8000 으로 열면 `js/config.js`가 자동으로 localhost:8080을 봅니다.
관리 탭은 주소에 `?admin=1`을 붙이면 나타나고, `.env`의 `ADMIN_TOKEN`을 입력하면 열립니다.

서버 배포는 `docker compose up -d --build` 하나로 DB와 API가 같이 뜹니다(프로젝트 이름 `whose-fault`). API는 `127.0.0.1:8090`에만 열리고, 밖에서는 고해야지 서버의 앞단 Nginx가 `whose-fault-edge` 네트워크로 받아 `api.whose-fault.nobody-asked.dev`로 내보냅니다. 연결 순서는 online_gohaeyaji 저장소 `infra/README.md`의 2-1-2. Nginx가 클라이언트 IP 헤더를 덮어쓰므로 `TRUST_PROXY_HEADERS=true`로 둡니다.

## 인증

- 로그인 없음. `POST /api/session`이 익명 토큰(`uid.HMAC서명`)을 주고, 브라우저는 localStorage에 두고 `Authorization: Bearer <token>`으로 보냅니다.
- 서명 덕분에 남의 uid로 투표하거나 댓글을 지울 수 없습니다. uid는 응답에 절대 내려가지 않고, 댓글 작성자는 uid에서 만든 익명 닉네임으로만 보입니다.
- 관리자는 `X-Admin-Token` 헤더. 비교는 상수 시간.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/session | 익명 토큰 발급 (IP당 시간당 30회) |
| GET | /api/cases?limit=60 | 사고 목록. 신고 3건 이상은 일반 사용자에게 안 보임 |
| POST | /api/cases | 사고 올리기 `{title, desc, spec}`. 스펙은 검증 후 알려진 필드만 저장. 1분에 1개, 하루 30개 |
| GET | /api/cases/{id}/state | 투표 집계, 내 투표, 댓글. **투표 전에는 집계와 댓글이 빠진다** |
| PUT | /api/cases/{id}/vote | `{choice: A100\|Amore\|half\|Bmore\|B100, disagree}` 한 사람 한 표, 바꾸기 가능 |
| POST | /api/cases/{id}/comments | `{text}` 투표한 사람만. 15초에 1개. 진영 태그는 서버가 투표에서 붙임 |
| DELETE | /api/comments/{id} | 내 댓글 또는 관리자 |
| PUT, DELETE | /api/comments/{id}/like | 공감, 공감 취소 |
| POST | /api/reports | `{type: case\|comment, targetId, reason}` 같은 사람 중복 신고는 사유만 갱신 |
| PUT | /api/players/me | `{best}` 퀴즈 최고점 (베테랑 배지용, 조작 가능하니 배지 이상 의미 없음) |
| GET | /api/admin/me | 관리자 토큰 확인 |
| GET | /api/admin/reports | 신고를 대상별로 묶어서, 미리보기 포함 |
| POST | /api/admin/reports/dismiss | `{type, targetId}` 신고 기각 |
| GET | /api/admin/comments | 최근 댓글 |
| DELETE | /api/admin/cases/{id} | 사고와 딸린 투표, 댓글, 공감, 신고 모두 삭제 |

오류는 `{"error": "고정 코드", "message": "사용자에게 보여줄 문장"}` 형태입니다.

## 보호 장치

- IP당 분당 240요청 (`IpRateLimitFilter`), 기능별 사용자 단위 제한 (`RateLimiter`)
- 차량 번호, 전화번호, 욕설 필터 (`TextFilter`, 프론트와 같은 규칙)
- 스펙 크기 30KB, 경로 점 400개, 좌표 범위 검사 (`SpecValidator`)

## 확장할 때

- `RateLimiter`는 메모리 구현이라 서버 한 대 기준입니다. 서버를 늘리면 Redis INCR + EXPIRE로 바꿔야 합니다.
- 상태 조회는 프론트가 5초마다 폴링합니다. 인기 사고 하나에 사람이 몰리면 `/state` 결과를 사고 단위로 1~2초 캐시하거나 SSE로 바꾸는 게 다음 단계입니다.
