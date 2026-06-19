# 울산 축구장 빈 시간 찾기

울산 공공 축구장/다목적구장을 한 화면에서 확인하는 Cloudflare Workers 앱입니다. 북구 공공체육시설은 실시간 빈 시간을 조회하고, 중구·남구·동구·울주군 시설은 공식 예약 페이지로 바로 연결합니다.

- 실서비스: https://ulsan-soccer-reservation-checker.kimyejun978.workers.dev
- 북구 공식 예약: https://crs.ubimc.or.kr/yeyak
- 현재 범위: 울산 전체 구군
- 실시간 조회: 울산 북구 공공체육시설 13곳
- 공식 확인 연결: 중구, 남구, 동구, 울주군 주요 공공 축구장

최종 예약 가능 여부와 예약 확정은 공식 예약 시스템에서 확인해야 합니다.

## 주요 기능

- 축구장만 표시: 야구장, 테니스장 같은 다른 종목은 제외하고 축구장/다목적구장만 보여줍니다.
- 울산 전체 지역 필터: 울산 전체, 중구, 남구, 동구, 북구, 울주군을 전환할 수 있습니다.
- 운동장 이름 우선 UI: `달천운동장 인조잔디축구장`처럼 실제 운동장 이름이 카드와 상세 화면에 바로 나옵니다.
- 결론 먼저 보기: 실시간 예약 가능 운동장 수, 가장 빠른 시간, 공식 확인 필요 시설 수를 첫 화면에서 확인할 수 있습니다.
- 추천 결과: 날짜와 이용 시간을 고르면 예약 가능한 시간이 많은 곳과 빠른 곳을 먼저 정렬합니다.
- 즐겨찾기: 자주 확인하는 운동장을 브라우저에 저장합니다.
- 시간표: 북구 실시간 연동 시설은 05:00부터 24:00까지 시간대별 가능/예약 상태를 한눈에 봅니다.
- 공식 예약 연결: 각 운동장 카드와 상세 화면에서 공식 예약 페이지로 바로 이동합니다.

## 배포

이 저장소는 Cloudflare Workers 무료 플랜에 바로 올릴 수 있는 단일 파일 `cloudflare-worker.js`를 포함합니다. 웹 화면과 API가 같은 Worker에서 동작하므로 별도 서버를 켜둘 필요가 없습니다.

```bash
npx wrangler deploy
```

현재 Worker 이름은 `ulsan-soccer-reservation-checker`입니다.

## 로컬 실행

Cloudflare Worker와 비슷한 단일 서버로 확인하려면:

```bash
node deploy-server.mjs
```

- Web/API: http://localhost:8787

개발 서버를 따로 띄우려면:

```bash
npm i
```

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

## API

### 상태 확인

```http
GET /health
```

### 축구장 목록

```http
GET /api/ulsan/facilities
```

울산 전체 축구장/다목적구장 목록을 반환합니다. 각 시설은 `availabilityMode` 값으로 실시간 조회(`realtime`) 또는 공식 확인(`official-check`) 여부를 구분합니다.

### 선택 운동장 시간 조회

```http
GET /api/ulsan/sports?facilityId=T0000037&date=YYYY-MM-DD
```

- `facilityId`: 북구 실시간 시설은 울산공공시설예약의 `item_id`, 공식 확인 시설은 앱 내부 ID
- `date`: 생략 시 오늘

### 추천용 전체 현황

```http
GET /api/ulsan/soccer/overview?area=울산%20전체&date=YYYY-MM-DD&hours=2
```

선택한 지역, 날짜, 이용 시간 기준으로 운동장을 조회한 뒤, 예약 가능한 시간 묶음과 추천 순서를 반환합니다. `area`는 `울산 전체`, `중구`, `남구`, `동구`, `북구`, `울주군`을 사용할 수 있습니다.

### 특정 시간대 추천

```http
GET /api/ulsan/soccer/recommendations?area=울산%20전체&date=YYYY-MM-DD&start=19:00&hours=2
```

설정한 시작 시간과 이용 시간에 예약이 비어 있는 운동장을 먼저 보여줍니다.

### 달천운동장 호환 엔드포인트

```http
GET /api/dalcheon/soccer?date=YYYY-MM-DD
```

기존 앱/북마크 호환을 위해 유지합니다.

## 구성

- `cloudflare-worker.js`: 실서비스용 Worker. 화면과 API를 함께 제공합니다.
- `deploy-server.mjs`: 로컬 단일 서버 실행용 파일입니다.
- `apps/api`: 기존 Node API 구현입니다.
- `apps/web`: 기존 React PWA 구현입니다.

## 참고

현재 공식 예약 데이터에서 안정적으로 실시간 확인 가능한 범위는 울산 북구 공공체육시설입니다. 다른 구군은 공식 확인 링크로 제공하며, 각 공식 사이트의 예약 구조가 확인되면 실시간 파싱을 추가할 수 있습니다.
