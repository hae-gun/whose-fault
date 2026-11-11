// 백엔드 주소. 서버를 띄운 주소로 바꾸세요.
// 로컬 개발: 프론트 python3 -m http.server 8000, 백엔드 ./gradlew bootRun (8080)
window.WF_CONFIG = {
  apiBase: (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://whose-fault-api.nobody-asked.dev'
};
