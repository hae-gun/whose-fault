# whose-fault (몇 대 몇?)

자동차 사고 과실비율을 맞히고, 직접 사고를 그려 보고, 사람들과 판결을 두고 토론하는 웹 게임입니다.

배포 주소(예정): https://nobody-asked.dev/whose-fault/

## 기능

- **맞히기**: 사고 애니메이션을 보고 과실비율을 맞히는 퀴즈 (26문제 중 10문제 랜덤). 끝나면 등급별 공유 페이지로 공유
- **직접 그리기**: 도로 11종 위에 두 차의 경로를 손가락으로 그리고 신호, 속력, 수정요소를 정해 사고를 재생
- **판결 투표**: 사용자가 올린 사고에 5지선다로 투표하고, 기준표 결과와 비교하며 댓글로 토론. 신고와 관리자 삭제 포함

## 구조

```
index.html          게임 본체
css/style.css
js/config.js        백엔드 주소
js/app.js           렌더러, 룰 엔진, 퀴즈, 그리기, 투표/댓글/관리자 (API 클라이언트)
r/<등급>.html        등급별 공유 페이지 (카톡 미리보기용 og 태그)
og/*.png            미리보기 이미지 1200x630
tools/og/           미리보기 이미지와 공유 페이지 생성 스크립트
backend/            Spring Boot API (투표, 댓글, 신고, 관리자). backend/README.md 참고
```

## 로컬 실행

빌드 과정 없는 정적 사이트입니다.

```
python3 -m http.server 8080
# http://localhost:8080
```

## 공유 이미지와 공유 페이지 다시 만들기

```
pip install playwright && python3 -m playwright install chromium
python3 tools/og/render_og.py        # og/*.png
python3 tools/og/gen_share_pages.py  # r/*.html
```

등급 문구는 `tools/og/grades.json`과 `js/app.js`의 `GRADES`를 같이 바꿔야 합니다.
카톡은 미리보기를 캐시하므로 이미지를 바꾼 뒤에는 카카오 개발자 사이트의 공유 디버거에서 캐시를 지워야 합니다.

## 알려진 제약

- 판결 투표, 댓글, 신고는 `backend/` 서버가 있어야 동작합니다. `js/config.js`의 `apiBase`를 서버 주소로 맞추세요. 서버에 연결되지 않으면 투표 탭에 안내 문구가 뜨고 퀴즈와 그리기는 그대로 됩니다.
- 과실 수치는 손해보험협회 "자동차사고 과실비율 인정기준"의 대표 유형을 단순화한 근사치입니다. 공식 판정이 아닙니다.
