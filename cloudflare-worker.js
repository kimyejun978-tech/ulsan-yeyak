const BASE = 'https://crs.ubimc.or.kr';
const AJAX = BASE + '/yeyak/ajxAgent/ajxRsvExplodTime';
const DEFAULT_FACILITY = 'T0000037';

const FACILITIES = [
  ['T0000064', '효문운동장 인조잔디축구장', '효문운동장', '인조잔디축구장', '북구', 'B0001023'],
  ['T0000037', '달천운동장 인조잔디축구장', '달천운동장', '인조잔디축구장', '북구', 'B0001016'],
  ['T0000046', '염포운동장 인조잔디축구장', '염포운동장', '인조잔디축구장', '북구', 'B0001018'],
  ['T0000044', '양정생활체육공원 인조잔디축구장', '양정생활체육공원', '인조잔디축구장', '북구', 'B0001017'],
  ['T0000033', '농소운동장 인조잔디축구장(A)', '농소운동장', '인조잔디축구장(A)', '북구', 'B0001015'],
  ['T0000034', '농소운동장 인조잔디축구장(B)', '농소운동장', '인조잔디축구장(B)', '북구', 'B0001015'],
  ['T0000040', '상안다목적구장', '상안다목적구장', '다목적구장', '북구', 'B0001013'],
  ['T0000039', '명촌다목적구장', '명촌다목적구장', '다목적구장', '북구', 'B0001012'],
  ['T0000058', '화봉다목적구장', '화봉다목적구장', '다목적구장', '북구', 'B0001021'],
  ['T0000059', '효문다목적구장', '효문다목적구장', '다목적구장', '북구', 'B0001022'],
  ['T0000032', '가람다목적구장', '가람다목적구장', '다목적구장', '북구', 'B0001011'],
  ['T0000056', '중산다목적구장', '중산다목적구장', '다목적구장', '북구', 'B0001020'],
  ['T0000042', '송정다목적구장', '송정다목적구장', '다목적구장', '북구', 'B0001014']
].map(([id, name, place, itemName, area, memId]) => ({
  id,
  itemId: id,
  name,
  shortName: name,
  place,
  itemName,
  area,
  itemType: 'I',
  memId,
  sourceUrl: viewUrl(id, memId)
}));

addEventListener('fetch', (event) => {
  event.respondWith(route(event.request).catch((error) => {
    return json({ error: 'InternalServerError', message: error.message }, 500);
  }));
});

async function route(request) {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return json({ ok: true });
  }

  if (url.pathname === '/api/ulsan/facilities') {
    return json({
      facilities: FACILITIES,
      areas: [...new Set(FACILITIES.map((facility) => facility.area))],
      source: 'official-static',
      sourceUrl: BASE + '/yeyak/sports_facilities/facility_list?ITEM_TYPE=I&selItemKind=',
      filter: 'soccer-only',
      updatedAt: new Date().toISOString()
    });
  }

  if (url.pathname === '/api/ulsan/sports' || url.pathname === '/api/dalcheon/soccer') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) {
      return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    }
    const facilityId = url.pathname === '/api/dalcheon/soccer'
      ? DEFAULT_FACILITY
      : url.searchParams.get('facilityId');
    return json(await getSlots(date, facilityId));
  }

  if (url.pathname === '/api/ulsan/soccer/recommendations') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) {
      return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    }
    return json(await getRecommendations({
      area: url.searchParams.get('area') || '북구',
      date,
      start: url.searchParams.get('start') || '19:00',
      hours: Number(url.searchParams.get('hours') || 2)
    }));
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    return html(HTML);
  }

  return json({ error: 'NotFound' }, 404);
}

function viewUrl(id, memId) {
  return BASE + '/yeyak/sports_facilities/facility_view?ITEM_TYPE=I&selItemKind=&mem_id=' + memId + '&item_id=' + id;
}

function findFacility(id) {
  return FACILITIES.find((facility) => facility.id === (id || DEFAULT_FACILITY))
    || FACILITIES.find((facility) => facility.id === DEFAULT_FACILITY);
}

function normalizeDate(value) {
  if (!value) {
    const today = new Date();
    return today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

async function fetchReservationTime(date, facility) {
  const body = new URLSearchParams({
    selDate: date.replaceAll('-', ''),
    item_id: facility.id
  }).toString();

  const response = await fetch(AJAX, {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      referer: facility.sourceUrl,
      accept: 'application/json,text/html,*/*'
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error('Upstream HTTP ' + response.status);
  }

  return JSON.parse(text);
}

function buildSlots(bookedHours) {
  const slots = [];
  for (let hour = 5; hour <= 23; hour += 1) {
    const booked = bookedHours.has(hour);
    slots.push({
      hour,
      start: pad(hour) + ':00',
      end: pad(hour + 1) + ':00',
      status: booked ? 'BOOKED' : 'AVAILABLE',
      label: booked ? '예약 불가' : '예약 가능'
    });
  }
  return slots;
}

async function getSlots(date, id) {
  const facility = findFacility(id);
  const raw = await fetchReservationTime(date, facility);

  if (raw.chk_result !== 'OK' && raw.chk_result !== 'NODATA') {
    return {
      facility: facility.id,
      facilityName: facility.name,
      facilityInfo: facility,
      date,
      sourceUrl: facility.sourceUrl,
      slots: [],
      rawRowCount: 0,
      holiday: { isHoliday: false, name: null, type: null },
      error: raw.msg || '공식 예약 시스템에서 조회를 제한했습니다.',
      updatedAt: new Date().toISOString()
    };
  }

  const bookedHours = new Set(String(raw.hhhlist || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite));
  const slots = buildSlots(bookedHours);

  return {
    facility: facility.id,
    facilityName: facility.name,
    facilityInfo: facility,
    date,
    sourceUrl: facility.sourceUrl,
    slots,
    rawRowCount: slots.length,
    holiday: { isHoliday: false, name: null, type: null },
    bookedHoursCount: bookedHours.size,
    availableHoursCount: slots.filter((slot) => slot.status === 'AVAILABLE').length,
    updatedAt: new Date().toISOString()
  };
}

function requestedHours(start, count) {
  const firstHour = Math.max(5, Math.min(23, Number(String(start).slice(0, 2)) || 19));
  const length = Math.max(1, Math.min(4, Number(count) || 2));
  return Array.from({ length }, (_, index) => firstHour + index).filter((hour) => hour <= 23);
}

async function getRecommendations({ area, date, start, hours }) {
  const targetHours = requestedHours(start, hours);
  const candidates = FACILITIES.filter((facility) => !area || facility.area === area);
  const results = [];

  for (const facility of candidates) {
    try {
      const data = await getSlots(date, facility.id);
      const targetSlots = data.slots.filter((slot) => targetHours.includes(slot.hour));
      const bookedSlots = targetSlots.filter((slot) => slot.status === 'BOOKED');

      results.push({
        facility,
        date,
        startTime: pad(targetHours[0]) + ':00',
        hours: targetHours.length,
        requestedHours: targetHours,
        requestedSlots: targetSlots.length,
        availableSlots: targetSlots.length - bookedSlots.length,
        bookedSlots: bookedSlots.length,
        isFullyAvailable: targetSlots.length > 0 && bookedSlots.length === 0,
        unavailableSlots: bookedSlots.map((slot) => slot.start + '-' + slot.end),
        sourceUrl: facility.sourceUrl,
        error: data.error || null
      });
    } catch (error) {
      results.push({
        facility,
        date,
        startTime: pad(targetHours[0]) + ':00',
        hours: targetHours.length,
        requestedHours: targetHours,
        requestedSlots: targetHours.length,
        availableSlots: 0,
        bookedSlots: targetHours.length,
        isFullyAvailable: false,
        unavailableSlots: [],
        sourceUrl: facility.sourceUrl,
        error: error.message
      });
    }
  }

  results.sort((a, b) => {
    return (a.error ? 1 : 0) - (b.error ? 1 : 0)
      || a.bookedSlots - b.bookedSlots
      || Number(b.isFullyAvailable) - Number(a.isFullyAvailable)
      || b.availableSlots - a.availableSlots
      || a.facility.name.localeCompare(b.facility.name, 'ko-KR');
  });

  return {
    area,
    date,
    startTime: pad(targetHours[0]) + ':00',
    hours: targetHours.length,
    requestedHours: targetHours,
    facilitiesChecked: results.length,
    results,
    updatedAt: new Date().toISOString()
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function html(value) {
  return new Response(value, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

const HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>울산 축구장 예약 현황</title>
<style>
:root {
  --bg: #f4f7fb;
  --panel: #ffffff;
  --panel-soft: #f9fbff;
  --text: #172033;
  --muted: #66758a;
  --line: #d8e1ee;
  --blue: #2563eb;
  --blue-soft: #eaf1ff;
  --green: #12805c;
  --green-soft: #e9f8f1;
  --red: #b4232b;
  --red-soft: #fff0f0;
  --amber: #8a5a00;
  --amber-soft: #fff6dc;
  --shadow: 0 14px 36px rgba(31, 45, 68, .08);
}
* { box-sizing: border-box; }
html { color-scheme: light; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button, input, select { font: inherit; }
button { cursor: pointer; }
a { color: inherit; }
.shell {
  width: min(1180px, calc(100% - 28px));
  margin: 0 auto;
  padding: 22px 0 38px;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
}
.eyebrow {
  margin: 0 0 4px;
  color: var(--blue);
  font-size: 13px;
  font-weight: 800;
}
h1, h2, h3, p { margin: 0; }
h1 { font-size: 28px; line-height: 1.18; letter-spacing: 0; }
h2 { font-size: 18px; line-height: 1.35; letter-spacing: 0; }
h3 { font-size: 16px; line-height: 1.35; letter-spacing: 0; }
.top-actions, .datebar, .quickbar, .chipbar, .row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.workspace {
  display: grid;
  gap: 14px;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
}
.panel.pad { padding: 16px; }
.panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.muted { color: var(--muted); font-size: 13px; font-weight: 700; }
.control, .button, .icon-button {
  min-height: 42px;
  border: 1px solid #b8c4d6;
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  font-weight: 800;
  padding: 0 12px;
}
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-decoration: none;
}
.button.primary {
  color: #fff;
  background: var(--blue);
  border-color: var(--blue);
}
.button.ghost { background: var(--panel-soft); }
.icon-button {
  width: 44px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
}
.icon-button.active, .chip.active, .button.active {
  border-color: #e3bd52;
  background: var(--amber-soft);
  color: var(--amber);
}
.searchbox {
  width: 100%;
  margin-bottom: 10px;
}
.chipbar {
  min-height: 38px;
  margin-bottom: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.chip {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--text);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}
.empty-chip {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.facility-list {
  display: grid;
  gap: 8px;
  max-height: 622px;
  overflow: auto;
  padding-right: 2px;
}
.facility-row, .recommend-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 70px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 11px 12px;
  color: inherit;
  text-align: left;
}
.facility-row.is-selected {
  border-color: var(--blue);
  background: var(--blue-soft);
}
.facility-row strong, .recommend-row strong, .slot-row strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.facility-row small, .recommend-row small, .slot-row small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}
.favorite-mark { color: var(--amber); font-weight: 900; }
.hero-panel {
  padding: 18px;
}
.current-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
}
.datebar { justify-content: flex-end; }
.datebar .control { width: 156px; }
.quickbar {
  margin-top: 14px;
}
.quickbar .button {
  flex: 1 1 112px;
}
.notice {
  margin-top: 12px;
  border-radius: 8px;
  padding: 11px 12px;
  background: var(--amber-soft);
  color: #6f4a05;
  font-weight: 800;
}
.notice:empty { display: none; }
.status-grid {
  display: grid;
  grid-template-columns: 1.5fr repeat(3, minmax(120px, .55fr));
  gap: 10px;
}
.status-tile {
  min-height: 96px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 14px;
}
.status-tile b {
  display: block;
  margin-top: 7px;
  font-size: 26px;
  line-height: 1.1;
}
.status-tile strong {
  display: block;
  margin-top: 7px;
  font-size: 18px;
  line-height: 1.35;
}
.slot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.slot-panel {
  padding: 16px;
}
.slot-panel.available { background: var(--green-soft); border-color: #b7e4cf; }
.slot-panel.booked { background: var(--red-soft); border-color: #f0c2c6; }
.slot-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.slot-row {
  min-height: 58px;
  border: 1px solid rgba(23, 32, 51, .12);
  border-radius: 8px;
  background: rgba(255, 255, 255, .76);
  padding: 10px 12px;
}
.empty-state {
  border: 1px dashed #b9c6d8;
  border-radius: 8px;
  padding: 18px 14px;
  color: var(--muted);
  font-weight: 800;
  background: rgba(255, 255, 255, .62);
}
.recommend-panel {
  padding: 16px;
}
.recommend-controls {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr .8fr auto;
  gap: 8px;
}
.recommend-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.recommend-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
}
.rank {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--blue);
  font-weight: 900;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border-radius: 999px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}
.badge.good { background: var(--green-soft); color: var(--green); }
.badge.warn { background: var(--amber-soft); color: var(--amber); }
.badge.bad { background: var(--red-soft); color: var(--red); }
.footer {
  margin-top: 20px;
  color: var(--muted);
  text-align: center;
  font-size: 13px;
  font-weight: 700;
}
@media (max-width: 900px) {
  .layout, .slot-grid, .current-line, .status-grid, .recommend-controls {
    grid-template-columns: 1fr;
  }
  .datebar { justify-content: stretch; }
  .datebar .control, .datebar .button { flex: 1 1 auto; width: auto; }
  .facility-list { max-height: 430px; }
  .recommend-card { grid-template-columns: 38px minmax(0, 1fr); }
  .recommend-card .badge { grid-column: 2; justify-self: start; }
}
@media (max-width: 560px) {
  .shell { width: min(100% - 20px, 1180px); padding-top: 14px; }
  .topbar { align-items: stretch; flex-direction: column; }
  .top-actions .button { flex: 1; }
  h1 { font-size: 24px; }
  .hero-panel, .panel.pad, .recommend-panel, .slot-panel { padding: 13px; }
}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">울산 공공체육시설</p>
      <h1>축구장 예약 현황</h1>
    </div>
    <div class="top-actions">
      <button id="refresh" class="button ghost" type="button">새로고침</button>
      <a id="officialLink" class="button" href="https://crs.ubimc.or.kr/yeyak" target="_blank" rel="noreferrer">공식 사이트</a>
    </div>
  </header>

  <main class="layout">
    <section class="panel pad">
      <div class="panel-title">
        <div>
          <h2>운동장</h2>
          <p id="facilityCount" class="muted">불러오는 중</p>
        </div>
        <button id="favoriteToggle" class="icon-button" type="button" aria-label="즐겨찾기">☆</button>
      </div>
      <input id="facilitySearch" class="control searchbox" type="search" placeholder="운동장 이름 검색">
      <div id="favoriteStrip" class="chipbar"></div>
      <div id="facilityList" class="facility-list" role="listbox"></div>
    </section>

    <div class="workspace">
      <section class="panel hero-panel">
        <div class="current-line">
          <div>
            <p class="muted">선택한 운동장</p>
            <h2 id="currentName">달천운동장 인조잔디축구장</h2>
            <p id="currentMeta" class="muted">북구 · 인조잔디축구장</p>
          </div>
          <div class="datebar">
            <button id="prevDate" class="icon-button" type="button" aria-label="이전 날짜">‹</button>
            <input id="dateInput" class="control" type="date">
            <button id="nextDate" class="icon-button" type="button" aria-label="다음 날짜">›</button>
          </div>
        </div>
        <div class="quickbar">
          <button class="button ghost" type="button" data-offset="0">오늘</button>
          <button class="button ghost" type="button" data-offset="1">내일</button>
          <button class="button ghost" type="button" data-weekday="6">이번 토요일</button>
          <button class="button ghost" type="button" data-weekday="0">이번 일요일</button>
        </div>
        <div id="notice" class="notice"></div>
      </section>

      <section id="statusGrid" class="status-grid"></section>

      <section class="slot-grid">
        <section class="panel slot-panel available">
          <h3>예약 가능한 시간</h3>
          <div id="availableSlots" class="slot-list"></div>
        </section>
        <section class="panel slot-panel booked">
          <h3>예약된 시간</h3>
          <div id="bookedSlots" class="slot-list"></div>
        </section>
      </section>

      <section class="panel recommend-panel">
        <div class="panel-title">
          <div>
            <h2>주변 추천</h2>
            <p class="muted">예약이 적은 운동장부터 정렬</p>
          </div>
        </div>
        <div class="recommend-controls">
          <select id="areaSelect" class="control" aria-label="지역"></select>
          <input id="recommendDate" class="control" type="date" aria-label="추천 날짜">
          <select id="startTime" class="control" aria-label="시작 시간"></select>
          <select id="duration" class="control" aria-label="이용 시간">
            <option value="1">1시간</option>
            <option value="2" selected>2시간</option>
            <option value="3">3시간</option>
            <option value="4">4시간</option>
          </select>
          <button id="recommendButton" class="button primary" type="button">추천 보기</button>
        </div>
        <div id="recommendResults" class="recommend-list"></div>
      </section>
    </div>
  </main>

  <footer class="footer">공식 예약 시스템 기준 · 축구장만 표시</footer>
</div>

<script>
var $ = function (id) { return document.getElementById(id); };
var FAVORITE_KEY = 'ulsan-soccer-favorites';
var facilities = [];
var selectedId = 'T0000037';
var lastData = null;
var favorites = readFavorites();

function readFavorites() {
  try {
    var saved = JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites));
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function todayIso() {
  var today = new Date();
  return toIso(today);
}

function toIso(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function shiftDate(value, days) {
  var date = new Date(value + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function nextWeekday(day) {
  var date = new Date();
  var diff = (day - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return toIso(date);
}

function facilityName(facility) {
  return facility ? facility.name : '달천운동장 인조잔디축구장';
}

function facilityMeta(facility) {
  if (!facility) return '북구 · 인조잔디축구장';
  return facility.area + ' · ' + facility.itemName + ' · ' + facility.id;
}

function selectedFacility() {
  return facilities.find(function (facility) { return facility.id === selectedId; }) || facilities[0] || null;
}

function isFavorite(id) {
  return favorites.indexOf(id) !== -1;
}

function setNotice(message) {
  $('notice').textContent = message || '';
}

function formatTime(time) {
  var hour = Number(String(time).slice(0, 2));
  var minute = String(time).slice(3, 5);
  var period = hour >= 12 ? '오후' : '오전';
  hour = hour % 12;
  if (!hour) hour = 12;
  return period + ' ' + hour + ':' + minute;
}

function groupSlots(slots, status) {
  var groups = [];
  var current = null;
  (slots || []).forEach(function (slot) {
    if (slot.status === status) {
      if (!current) {
        current = { start: slot.start, end: slot.end, count: 1 };
      } else if (current.end === slot.start) {
        current.end = slot.end;
        current.count += 1;
      } else {
        groups.push(current);
        current = { start: slot.start, end: slot.end, count: 1 };
      }
    } else if (current) {
      groups.push(current);
      current = null;
    }
  });
  if (current) groups.push(current);
  return groups;
}

function renderFacilityList() {
  var query = $('facilitySearch').value.trim().toLowerCase();
  var current = selectedFacility();
  var sorted = facilities.slice().sort(function (a, b) {
    return (isFavorite(b.id) - isFavorite(a.id))
      || facilityName(a).localeCompare(facilityName(b), 'ko-KR');
  });
  var visible = sorted.filter(function (facility) {
    return (facilityName(facility) + ' ' + facilityMeta(facility)).toLowerCase().indexOf(query) !== -1;
  });

  $('facilityCount').textContent = visible.length + '개 운동장';
  $('currentName').textContent = facilityName(current);
  $('currentMeta').textContent = facilityMeta(current);
  $('favoriteToggle').textContent = isFavorite(selectedId) ? '★' : '☆';
  $('favoriteToggle').className = 'icon-button' + (isFavorite(selectedId) ? ' active' : '');
  $('officialLink').href = current && current.sourceUrl ? current.sourceUrl : 'https://crs.ubimc.or.kr/yeyak';

  var favoriteItems = favorites.map(function (id) {
    return facilities.find(function (facility) { return facility.id === id; });
  }).filter(Boolean);

  $('favoriteStrip').innerHTML = favoriteItems.length
    ? favoriteItems.map(function (facility) {
      return '<button class="chip active" type="button" data-favorite-pick="' + facility.id + '">' + escapeHtml(facilityName(facility)) + '</button>';
    }).join('')
    : '<span class="empty-chip">즐겨찾기한 운동장이 없습니다</span>';

  $('facilityList').innerHTML = visible.length
    ? visible.map(function (facility) {
      return '<button class="facility-row ' + (facility.id === selectedId ? 'is-selected' : '') + '" type="button" data-facility-id="' + facility.id + '">'
        + '<span><strong>' + escapeHtml(facilityName(facility)) + '</strong><small>' + escapeHtml(facilityMeta(facility)) + '</small></span>'
        + '<span class="favorite-mark">' + (isFavorite(facility.id) ? '★' : '') + '</span>'
        + '</button>';
    }).join('')
    : '<div class="empty-state">검색 결과가 없습니다</div>';
}

function renderStatus(data) {
  if (!data || data.error) {
    var message = data && data.error ? data.error : '예약 정보를 불러오지 못했습니다.';
    $('statusGrid').innerHTML = '<div class="status-tile"><span class="muted">조회 상태</span><strong>조회 불가</strong><p class="muted">' + escapeHtml(message) + '</p></div>';
    $('availableSlots').innerHTML = '<div class="empty-state">표시할 시간이 없습니다</div>';
    $('bookedSlots').innerHTML = '<div class="empty-state">표시할 시간이 없습니다</div>';
    return;
  }

  var available = groupSlots(data.slots, 'AVAILABLE');
  var booked = groupSlots(data.slots, 'BOOKED');
  var firstAvailable = available.length ? formatTime(available[0].start) + '부터' : '없음';

  $('statusGrid').innerHTML =
    '<div class="status-tile"><span class="muted">오늘 볼 운동장</span><strong>' + escapeHtml(facilityName(data.facilityInfo)) + '</strong><p class="muted">' + escapeHtml(data.date) + '</p></div>'
    + '<div class="status-tile"><span class="muted">빈 시간</span><b>' + data.availableHoursCount + '</b></div>'
    + '<div class="status-tile"><span class="muted">예약됨</span><b>' + data.bookedHoursCount + '</b></div>'
    + '<div class="status-tile"><span class="muted">가장 빠른 빈 시간</span><strong>' + escapeHtml(firstAvailable) + '</strong></div>';

  $('availableSlots').innerHTML = renderSlotRows(available, '예약 가능');
  $('bookedSlots').innerHTML = renderSlotRows(booked, '예약됨');
}

function renderSlotRows(groups, label) {
  if (!groups.length) {
    return '<div class="empty-state">표시할 시간이 없습니다</div>';
  }
  return groups.map(function (group) {
    return '<div class="slot-row"><strong>' + formatTime(group.start) + ' ~ ' + formatTime(group.end) + '</strong><small>' + group.count + '시간 · ' + label + '</small></div>';
  }).join('');
}

function fillAreaOptions() {
  var areas = facilities.reduce(function (list, facility) {
    if (list.indexOf(facility.area) === -1) list.push(facility.area);
    return list;
  }, []);
  $('areaSelect').innerHTML = areas.map(function (area) {
    return '<option value="' + escapeHtml(area) + '">' + escapeHtml(area) + '</option>';
  }).join('');
}

function fillStartOptions() {
  var duration = Number($('duration').value || 2);
  var max = 24 - duration;
  var selected = $('startTime').value || '19:00';
  var html = '';
  for (var hour = 5; hour <= max; hour += 1) {
    var value = String(hour).padStart(2, '0') + ':00';
    html += '<option value="' + value + '">' + formatTime(value) + '</option>';
  }
  $('startTime').innerHTML = html;
  $('startTime').value = selected <= String(max).padStart(2, '0') + ':00' ? selected : '19:00';
}

async function loadFacilities() {
  var response = await fetch('/api/ulsan/facilities');
  var payload = await response.json();
  facilities = payload.facilities || [];
  fillAreaOptions();
  renderFacilityList();
}

async function loadSlots() {
  var date = $('dateInput').value;
  $('recommendDate').value = date;
  setNotice('예약 정보를 불러오는 중입니다.');
  try {
    var query = new URLSearchParams({ date: date, facilityId: selectedId });
    var response = await fetch('/api/ulsan/sports?' + query.toString());
    lastData = await response.json();
    setNotice('');
    renderFacilityList();
    renderStatus(lastData);
  } catch (error) {
    setNotice('');
    renderStatus({ error: error.message });
  }
}

async function loadRecommendations() {
  var params = new URLSearchParams({
    area: $('areaSelect').value,
    date: $('recommendDate').value,
    start: $('startTime').value,
    hours: $('duration').value
  });

  $('recommendResults').innerHTML = '<div class="empty-state">추천을 조회하는 중입니다</div>';
  try {
    var response = await fetch('/api/ulsan/soccer/recommendations?' + params.toString());
    var payload = await response.json();
    renderRecommendations(payload.results || []);
  } catch (error) {
    $('recommendResults').innerHTML = '<div class="empty-state">추천을 불러오지 못했습니다</div>';
  }
}

function renderRecommendations(results) {
  if (!results.length) {
    $('recommendResults').innerHTML = '<div class="empty-state">추천할 운동장이 없습니다</div>';
    return;
  }

  $('recommendResults').innerHTML = results.map(function (result, index) {
    var stateClass = result.error ? 'bad' : result.isFullyAvailable ? 'good' : 'warn';
    var stateText = result.error ? '조회 불가' : result.isFullyAvailable ? '전부 가능' : result.bookedSlots + '시간 예약됨';
    return '<article class="recommend-card">'
      + '<span class="rank">' + (index + 1) + '</span>'
      + '<button class="recommend-row" type="button" data-recommend-pick="' + result.facility.id + '">'
      + '<span><strong>' + escapeHtml(facilityName(result.facility)) + '</strong><small>' + escapeHtml(facilityMeta(result.facility)) + ' · ' + result.availableSlots + '/' + result.requestedSlots + '시간 가능</small></span>'
      + '<span class="favorite-mark">' + (isFavorite(result.facility.id) ? '★' : '') + '</span>'
      + '</button>'
      + '<span class="badge ' + stateClass + '">' + escapeHtml(stateText) + '</span>'
      + '</article>';
  }).join('');
}

function toggleFavorite(id) {
  if (isFavorite(id)) {
    favorites = favorites.filter(function (favoriteId) { return favoriteId !== id; });
  } else {
    favorites = [id].concat(favorites.filter(function (favoriteId) { return favoriteId !== id; }));
  }
  saveFavorites();
  renderFacilityList();
  if (lastData) renderStatus(lastData);
}

function bindEvents() {
  $('facilitySearch').addEventListener('input', renderFacilityList);
  $('favoriteToggle').addEventListener('click', function () { toggleFavorite(selectedId); });
  $('facilityList').addEventListener('click', function (event) {
    var button = event.target.closest('[data-facility-id]');
    if (!button) return;
    selectedId = button.dataset.facilityId;
    $('facilitySearch').value = '';
    loadSlots();
  });
  $('favoriteStrip').addEventListener('click', function (event) {
    var button = event.target.closest('[data-favorite-pick]');
    if (!button) return;
    selectedId = button.dataset.favoritePick;
    loadSlots();
  });
  $('dateInput').addEventListener('change', loadSlots);
  $('prevDate').addEventListener('click', function () {
    $('dateInput').value = shiftDate($('dateInput').value, -1);
    loadSlots();
  });
  $('nextDate').addEventListener('click', function () {
    $('dateInput').value = shiftDate($('dateInput').value, 1);
    loadSlots();
  });
  $('refresh').addEventListener('click', loadSlots);
  document.querySelectorAll('[data-offset]').forEach(function (button) {
    button.addEventListener('click', function () {
      var date = new Date();
      date.setDate(date.getDate() + Number(button.dataset.offset));
      $('dateInput').value = toIso(date);
      loadSlots();
    });
  });
  document.querySelectorAll('[data-weekday]').forEach(function (button) {
    button.addEventListener('click', function () {
      $('dateInput').value = nextWeekday(Number(button.dataset.weekday));
      loadSlots();
    });
  });
  $('duration').addEventListener('change', fillStartOptions);
  $('recommendButton').addEventListener('click', loadRecommendations);
  $('recommendResults').addEventListener('click', function (event) {
    var pick = event.target.closest('[data-recommend-pick]');
    if (!pick) return;
    selectedId = pick.dataset.recommendPick;
    $('dateInput').value = $('recommendDate').value;
    loadSlots();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

$('dateInput').value = todayIso();
$('recommendDate').value = $('dateInput').value;
fillStartOptions();
bindEvents();
loadFacilities().then(loadSlots);
</script>
</body>
</html>`;
