# 울산 축구장 예약 확인

울산 5개 구·군의 공식 공공시설 예약 시스템에 등록된 축구장만 모아 날짜별 빈 시간을 확인하고 추천받는 웹 앱입니다.

## 지원 범위

2026년 6월 공식 예약 목록 기준 총 34개 축구장을 지원합니다.

| 지역 | 축구장 수 | 공식 데이터 제공처 |
| --- | ---: | --- |
| 중구 | 4 | 울산중구도시관리공단 |
| 남구 | 1 | 울산남구도시관리공단 |
| 동구 | 1 | 울산동구 공공시설예약서비스 |
| 북구 | 13 | 울산북구시설관리공단 |
| 울주군 | 15 | 울주군시설관리공단 |

풋살장, 야구장, 족구장, 테니스장 등은 제외합니다. 공식 사이트의 축구장 분류에 포함된 다목적구장은 축구장으로 표시합니다.

## 주요 기능

- 울산 전체/구·군별 축구장 필터와 운동장명 검색
- 브라우저 `localStorage` 기반 즐겨찾기
- 날짜별 예약 가능/예약 완료 시간 묶음 표시
- 울산 안의 장소·주소 검색, 지도 선택 또는 브라우저 현위치를 기준으로 가까운 12곳 추천
- 추천 요청 시간과 실제 가능한 시간 구간을 `요청 14:00~18:00 · 가능 14:00~16:00`처럼 구분해 표시
- 각 운동장의 구·군 공식 예약 페이지 연결
- 기존 `/api/dalcheon/soccer` 주소 호환

## 데이터 처리

구·군마다 시설 번호와 API 응답 형태가 다르므로 제공처별 어댑터를 사용합니다.

- 북구·울주군: 객체 형태 예약 응답
- 중구·남구·동구: 배열 형태 예약 응답
- 시설 ID: `지역키:item_id` 형식. 예: `donggu:T0000003`
- 같은 `item_id`가 다른 구·군에 있어도 별도 시설로 처리
- 공식 운영시간 밖의 시간은 추천 가능한 시간으로 계산하지 않음
- Cloudflare IP를 차단하는 남구 공식 서버는 자동 조회 결과를 추정하지 않고 `공식 사이트에서 확인`으로 표시

최종 예약 가능 여부와 이용 조건은 연결된 공식 페이지에서 다시 확인해야 합니다.

## 구성

- `cloudflare-worker.js`: 웹 화면과 API를 함께 제공하는 실제 배포 파일
- `apps/api`: Fastify 기반 로컬/대체 서버
- `apps/web`: React 기반 PWA 소스

## 로컬 실행

### Cloudflare Worker 확인

```bash
npx wrangler dev
```

기본 주소는 `http://localhost:8787`입니다.

### React + Fastify 개발

```bash
npm install
npm run dev -w @ulsan/api
npm run dev -w @ulsan/web
```

- Web: `http://localhost:5173`
- API: `http://localhost:8787/health`

## Cloudflare 배포

```bash
npx wrangler deploy --dry-run
npx wrangler deploy
```

Worker 이름은 `ulsan-soccer-reservation-checker`이며 `wrangler.toml`의 `main`은 `cloudflare-worker.js`입니다. 사용자 PC를 서버로 사용하지 않고 Cloudflare Workers 무료 플랜에서 실행됩니다.

## API

### 축구장 목록

```http
GET /api/ulsan/facilities
```

`facilities`, `areas`, `countsByArea`, 데이터 제공 범위를 반환합니다.

### 선택 축구장 시간 조회

```http
GET /api/ulsan/sports?facilityId=ulju:T0000001&date=YYYY-MM-DD
```

- `facilityId`: 목록 API가 반환한 지역별 고유 ID
- `date`: 생략 시 오늘
- 북구의 예전 `T0000037` 형식은 호환을 위해 계속 허용

### 주변 축구장 추천

```http
GET /api/ulsan/soccer/recommendations?lat=35.5396&lng=129.3114&date=YYYY-MM-DD&start=19:00&hours=2
```

`lat`, `lng` 기준으로 가까운 12곳을 먼저 고른 뒤 요청 시간에 모두 비어 있는 곳, 예약된 시간이 적은 곳, 거리가 가까운 곳 순으로 반환합니다. 각 결과의 `availableWindows`, `bookedWindows`에는 이어진 가능/예약 시간 구간이 담깁니다. 좌표를 생략하면 기존 `area` 기준 추천을 사용합니다.

### 울산 장소 검색

```http
GET /api/ulsan/location-search?q=태화강역
```

울산광역시 범위 안에서 최대 6개의 장소·주소 검색 결과와 좌표를 반환합니다. 검색 결과는 OpenStreetMap Nominatim을 사용하며 서버에서 캐시합니다.

### 기존 달천 전용 주소

```http
GET /api/dalcheon/soccer?date=YYYY-MM-DD
```

## 환경변수

- `PORT` 기본값 `8787`
- `HOST` 기본값 `0.0.0.0`
- `CACHE_TTL_MS` 기본값 `300000`
- `FACILITY_CACHE_TTL_MS` 기본값 `21600000`
- `CORS=1`: Vite와 API를 별도로 실행할 때 사용
- Node 서버의 TLS 인증서 검증은 기본으로 활성화됩니다. 별도 신뢰 인증서가 필요한 환경에서는 검증을 끄지 말고 `NODE_EXTRA_CA_CERTS`로 관리합니다.

## 유지보수 검증

`npm test`로 외부 의존성 없이 예약 파싱, 날짜 검증, 캐시 갱신, 오래된 정보 경고, 추천 순위와 Node/Worker 호환을 검사합니다.
`deploy-server.mjs`는 Worker와 같은 화면/API를 사용하므로 `npm start`와 Cloudflare 배포의 기능이 일치합니다.

일반 예약 조회와 추천의 하위 조회는 동일한 60초 캐시를 사용합니다. 화면의 새로고침은 `refresh=1`로 최신 조회를 요청합니다.
공식 서버 응답 지연으로 이전 결과를 보여줄 때는 추천 전체와 개별 구장에 경고와 원본 확인 시각을 표시합니다.

