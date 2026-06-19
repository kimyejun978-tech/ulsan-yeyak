# 울산 축구장 예약/가능 시간 체크 (PWA + API)

울산공공시설예약 사이트에 등록된 축구장만 모아서 특정 날짜의 예약/가능 시간을 빠르게 확인하는 PWA입니다.

## 주요 기능

- 축구장 전용 목록: 공식 시설 목록의 운동장명/장소명을 파싱하고 축구/인조잔디/다목적구장만 표시
- 즐겨찾기: 자주 쓰는 운동장을 브라우저에 저장
- 검색형 선택 UI: 기본 드롭다운 대신 실제 운동장명을 빠르게 검색하고 선택
- 주변 추천: 지역, 날짜, 시작 시간, 이용 시간을 고르면 예약 없는 순으로 축구장 추천
- 달천운동장 호환: 기존 `/api/dalcheon/soccer` 엔드포인트 유지

## 구성

- `apps/api`: 울산공공시설예약 AJAX 응답을 JSON API로 정리
- `apps/web`: React PWA — 축구장 선택, 즐겨찾기, 날짜 이동, 주변 추천

## 로컬 실행

### 가장 쉬운 실행(배포용 단일 서버)

```bash
node deploy-server.mjs
```

- Web/API: http://localhost:8787

### 1) 의존성 설치

```bash
npm i
```

### 2) 실행

터미널 2개에서:

```bash
cd apps/api
npm run dev
```

```bash
cd apps/web
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:8787/health

## 배포

이 프로젝트는 Cloudflare Workers 무료 플랜에 올릴 수 있는 `cloudflare-worker.js`를 포함합니다. Workers는 웹 화면과 API를 같은 무료 서버리스 엔드포인트에서 처리하므로 이 앱에 가장 적합합니다.

### Cloudflare Workers

```bash
npx wrangler deploy
```

대시보드에서 직접 만들 때는 Worker 이름을 `ulsan-soccer-reservation-checker`로 만들고, `cloudflare-worker.js` 내용을 붙여넣어 배포하면 됩니다.

### Render

Node 서버 방식이 필요하면 Render도 사용할 수 있습니다.

1. 이 폴더를 GitHub 저장소에 push
2. Render에서 New → Blueprint 선택
3. 저장소를 연결하면 `render.yaml` 기준으로 자동 배포

직접 Web Service로 만들 때는 다음 값만 지정하면 됩니다.

- Build Command: 비워두기
- Start Command: `node deploy-server.mjs`
- Health Check Path: `/health`

### Docker 지원

```bash
docker build -t ulsan-soccer-reservation-checker .
docker run -p 8787:8787 ulsan-soccer-reservation-checker
```

## API

### 축구장 목록

```http
GET /api/ulsan/facilities
```

울산공공시설예약 체육시설 목록에서 축구장 후보만 필터링해 반환합니다. 원본 목록 조회가 실패하면 달천운동장 기본값으로 동작합니다.

### 선택 축구장 시간 조회

```http
GET /api/ulsan/sports?facilityId=T0000037&date=YYYY-MM-DD
```

- `facilityId`: 울산공공시설예약의 `item_id`
- `date`: 생략 시 오늘

### 주변 축구장 추천

```http
GET /api/ulsan/soccer/recommendations?area=북구&date=YYYY-MM-DD&start=19:00&hours=2
```

선택 지역과 인접 지역의 축구장을 조회한 뒤, 설정한 시간대에 예약이 없는 곳을 먼저 보여줍니다.

### 기존 달천 전용 엔드포인트

```http
GET /api/dalcheon/soccer?date=YYYY-MM-DD
```

기존 앱/북마크 호환을 위해 유지합니다.

## 환경변수

- `PORT` (default `8787`)
- `HOST` (default `0.0.0.0`)
- `CACHE_TTL_MS` (default `300000`)
- `FACILITY_CACHE_TTL_MS` (default `21600000`)
- `CORS=1` 로컬에서 Vite와 API를 따로 띄울 때 사용
- `UBIMC_REJECT_UNAUTHORIZED=1` 원본 사이트 TLS 인증서를 엄격하게 검증

## 참고

원본 예약 사이트의 시설 목록 HTML 구조가 바뀌면 자동 탐색이 제한될 수 있습니다. 이 경우 `apps/api/src/dalcheon.js`의 `SEEDED_FACILITIES`에 자주 쓰는 축구장의 `item_id`를 추가하면 선택 목록과 추천 목록에 노출됩니다.
