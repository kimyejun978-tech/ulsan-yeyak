# 인계 — 2026-11-04

예약 조회 실패/빈 결과 구분, 응답 순서 보호, 달력 유효성 검증, 접근성 레이블과 모바일 날짜 배치를 수정했다. 캐시 정책 통일, stale 경고/원본 확인 시각 보존, 추천 순위와 시작 시각 보존, 추천 조건 변경 시 결과 무효화, Node 배포 경로 통일도 반영했다.

서버 회귀 테스트 10개 통과. 두 프로젝트 화면을 합쳐 DOM 동작 테스트 4개 통과. React 기본 정적 검사 오류 0개.
Windows 브라우저 드라이버 실패는 GitHub Linux Chromium 검사로 대체했다. 6개 브라우저 테스트와 320/390/768/1280px 가로 넘침 검사, 지도 클릭, 두 실제 배포 사이트의 release 및 잘못된 날짜 400 응답을 확인했다. Linux에서 달천 정식 Vite/PWA 빌드도 성공했다. 물리 iPhone/Safari 및 원본 예약표 전수 대조는 미검증이다. 검사: https://github.com/kimyejun978-tech/ulsan-yeyak/actions/runs/41768061957

배포 확인: /health release가 2026-11-04-maintenance인지 확인한다. GitHub 자동 배포 연결은 확인되지 않았다. 인증된 일반 Windows 환경에서 npm test 후 npx wrangler@4.157.0 deploy 로 테스트/검증 후 기존 Worker를 배포한다. CLI는 기존 Wrangler 인증을 사용하며 토큰을 소스나 로그에 직접 적지 않는다.

운영 배포 확인 완료: /health release=2026-11-04-maintenance. 예약 상태 테스트는 합성 응답을 사용하며, 실서버 release/날짜 검증은 실제 운영 API를 사용했다.
