# 삼국무쌍 서바이벌

삼국지 풍 뱀서라이크 생존 게임.

- `public/index.html` — 게임 전체 (코드·그래픽·사운드 포함)
- `worker.js` — 클라우드 저장(저장 코드) + 천하 순위표 API. Durable Object 사용, 로그인 없음
- `wrangler.jsonc` — Cloudflare Workers 설정

Cloudflare Workers에 이 저장소를 연결하면 push 때마다 자동 배포됩니다.
