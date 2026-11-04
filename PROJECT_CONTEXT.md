# 프로젝트 맥락

울산 5개 구·군의 공공 축구장 34곳 예약 확인 및 주변 추천.

실제 운영: https://ulsan-soccer-reservation-checker.kimyejun978.workers.dev/

cloudflare-worker.js가 운영 화면과 API를 제공한다. deploy-server.mjs는 같은 Worker를 Node HTTP 서버에 연결하며 Docker/Render도 이 경로를 사용한다. apps/web과 apps/api는 별도 React/Fastify 개발 경로다.

검증: npm test (외부 의존성 없는 Node 테스트). 기본 예약/추천 캐시 60초, refresh=1 강제 확인, stale 경고 전달을 유지한다.
