const BASE = 'https://crs.ubimc.or.kr';
const AJAX = BASE + '/yeyak/ajxAgent/ajxRsvExplodTime';
const DEFAULT_FACILITY = 'T0000037';
const DEFAULT_AREA = '북구';

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
      scope: '울산 북구',
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

  if (url.pathname === '/api/ulsan/soccer/overview') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) {
      return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    }
    return json(await getOverview({
      area: url.searchParams.get('area') || DEFAULT_AREA,
      date,
      duration: Number(url.searchParams.get('hours') || 2)
    }));
  }

  if (url.pathname === '/api/ulsan/soccer/recommendations') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) {
      return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    }
    return json(await getRecommendations({
      area: url.searchParams.get('area') || DEFAULT_AREA,
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
      label: booked ? '예약됨' : '예약 가능'
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

function availableWindows(slots, duration) {
  const windows = [];
  const count = Math.max(1, Math.min(4, Number(duration) || 2));
  for (let index = 0; index <= slots.length - count; index += 1) {
    const candidate = slots.slice(index, index + count);
    const allAvailable = candidate.length === count
      && candidate.every((slot) => slot.status === 'AVAILABLE')
      && candidate.every((slot, slotIndex) => slotIndex === 0 || slot.start === candidate[slotIndex - 1].end);
    if (allAvailable) {
      windows.push({
        start: candidate[0].start,
        end: candidate[candidate.length - 1].end,
        hours: count,
        label: candidate[0].start + '~' + candidate[candidate.length - 1].end
      });
    }
  }
  return windows;
}

function analyzeSlots(data, duration) {
  const windows = availableWindows(data.slots, duration);
  const firstAvailable = data.slots.find((slot) => slot.status === 'AVAILABLE') || null;
  const bookedRate = data.rawRowCount ? Math.round((data.bookedHoursCount / data.rawRowCount) * 100) : 0;
  const reasons = [];

  if (windows.length) {
    reasons.push(duration + '시간 연속 이용이 가능해요.');
    reasons.push('예약 가능한 시간 묶음이 ' + windows.length + '개 있어요.');
  } else if (firstAvailable) {
    reasons.push('짧은 빈 시간은 있지만 ' + duration + '시간 연속은 없어요.');
  } else {
    reasons.push('선택한 날짜에는 빈 시간이 없어요.');
  }

  return {
    facility: data.facilityInfo,
    date: data.date,
    sourceUrl: data.sourceUrl,
    slots: data.slots,
    timeline: data.slots.map((slot) => ({
      hour: slot.hour,
      start: slot.start,
      end: slot.end,
      status: slot.status,
      label: slot.label
    })),
    windows,
    firstAvailable,
    availableHoursCount: data.availableHoursCount || 0,
    bookedHoursCount: data.bookedHoursCount || 0,
    bookedRate,
    isAvailableForDuration: windows.length > 0,
    reasons,
    error: data.error || null,
    updatedAt: data.updatedAt
  };
}

function compareAnalyzed(a, b) {
  return (a.error ? 1 : 0) - (b.error ? 1 : 0)
    || Number(b.isAvailableForDuration) - Number(a.isAvailableForDuration)
    || (a.windows[0]?.start || '99:99').localeCompare(b.windows[0]?.start || '99:99')
    || b.windows.length - a.windows.length
    || b.availableHoursCount - a.availableHoursCount
    || a.facility.name.localeCompare(b.facility.name, 'ko-KR');
}

async function getOverview({ area, date, duration }) {
  const safeDuration = Math.max(1, Math.min(4, Number(duration) || 2));
  const candidates = FACILITIES.filter((facility) => !area || facility.area === area);
  const results = [];

  for (const facility of candidates) {
    try {
      const data = await getSlots(date, facility.id);
      results.push(analyzeSlots(data, safeDuration));
    } catch (error) {
      results.push({
        facility,
        date,
        sourceUrl: facility.sourceUrl,
        slots: [],
        timeline: [],
        windows: [],
        firstAvailable: null,
        availableHoursCount: 0,
        bookedHoursCount: 0,
        bookedRate: 0,
        isAvailableForDuration: false,
        reasons: ['공식 사이트 응답이 지연됐어요.'],
        error: error.message,
        updatedAt: new Date().toISOString()
      });
    }
  }

  results.sort(compareAnalyzed);
  const availableResults = results.filter((result) => result.isAvailableForDuration);
  const earliest = results
    .filter((result) => result.firstAvailable)
    .sort((a, b) => a.firstAvailable.start.localeCompare(b.firstAvailable.start))[0] || null;

  return {
    scope: '울산 북구',
    area,
    date,
    duration: safeDuration,
    facilitiesChecked: results.length,
    availableFacilitiesCount: availableResults.length,
    earliest: earliest ? {
      facility: earliest.facility,
      start: earliest.firstAvailable.start,
      end: earliest.firstAvailable.end,
      sourceUrl: earliest.sourceUrl
    } : null,
    recommended: availableResults[0] || null,
    results,
    updatedAt: new Date().toISOString()
  };
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
      || Number(b.isFullyAvailable) - Number(a.isFullyAvailable)
      || a.bookedSlots - b.bookedSlots
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
<title>울산 북구 축구장 빈 시간 찾기</title>
<style>
:root {
  --bg: #f5f7fb;
  --ink: #172033;
  --muted: #64748b;
  --panel: #ffffff;
  --soft: #f9fbff;
  --line: #d8e1ee;
  --blue: #2563eb;
  --blue-soft: #eaf1ff;
  --green: #11845b;
  --green-soft: #e7f7ef;
  --red: #b4232b;
  --red-soft: #fff0f0;
  --amber: #8a5a00;
  --amber-soft: #fff6dc;
  --shadow: 0 14px 34px rgba(20, 32, 54, .08);
}
* { box-sizing: border-box; }
html { overflow-x: hidden; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow-x: hidden;
}
button, input, select { font: inherit; min-width: 0; }
button { cursor: pointer; }
a { color: inherit; text-decoration: none; }
h1, h2, h3, p { margin: 0; }
.shell {
  width: min(1180px, calc(100% - 28px));
  margin: 0 auto;
  padding: 22px 0 96px;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
  margin-bottom: 12px;
}
.eyebrow {
  color: var(--blue);
  font-size: 13px;
  font-weight: 850;
  margin-bottom: 5px;
}
h1 {
  font-size: 30px;
  line-height: 1.18;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.subtitle {
  margin-top: 8px;
  color: var(--muted);
  font-size: 15px;
  font-weight: 720;
  line-height: 1.5;
  max-width: 760px;
}
.actions, .segmented, .date-pills, .card-actions, .favorite-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.actions {
  justify-content: flex-end;
}
.last-check {
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  width: 100%;
  text-align: right;
}
.button, .chip, .control, .icon-button {
  min-width: 0;
  min-height: 44px;
  border: 1px solid #b7c3d6;
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  font-weight: 850;
  padding: 0 13px;
}
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.button.primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
.button.success {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}
.button.ghost, .chip {
  background: var(--soft);
}
.chip.is-active, .button.is-active {
  border-color: var(--blue);
  background: var(--blue-soft);
  color: #1746a2;
}
.icon-button {
  min-width: 44px;
  padding: 0 10px;
}
.notice {
  border: 1px solid #ead28b;
  border-radius: 8px;
  background: var(--amber-soft);
  color: #6f4a05;
  padding: 11px 12px;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.45;
  margin-bottom: 12px;
}
.filters {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, .9fr);
  gap: 12px;
  align-items: stretch;
  margin-bottom: 12px;
}
.filter-block, .summary-card, .result-card, .detail, .empty-state {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}
.filter-block {
  padding: 14px;
}
.filter-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  min-width: 0;
}
.filter-title h2 {
  font-size: 17px;
  line-height: 1.35;
}
.muted {
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
}
.date-pills {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.date-pill {
  min-height: 58px;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 11px;
}
.date-pill span {
  display: block;
  font-size: 12px;
  color: var(--muted);
}
.segmented {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 8px;
}
.segmented .chip {
  width: 100%;
  padding: 0 8px;
}
.search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 10px;
}
.control {
  width: 100%;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.summary-card {
  padding: 15px;
  min-height: 112px;
}
.summary-card strong {
  display: block;
  margin-top: 8px;
  font-size: 26px;
  line-height: 1.1;
}
.summary-card p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.35;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 14px 0 10px;
}
.section-head h2 {
  font-size: 19px;
}
.results {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.result-card {
  display: grid;
  gap: 12px;
  padding: 14px;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}
.result-card h3, .detail h2 {
  font-size: 18px;
  line-height: 1.35;
  letter-spacing: 0;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border-radius: 999px;
  padding: 0 11px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}
.badge.good { background: var(--green-soft); color: var(--green); }
.badge.warn { background: var(--amber-soft); color: var(--amber); }
.badge.bad { background: var(--red-soft); color: var(--red); }
.favorite-button {
  min-height: 38px;
  border: 1px solid #e3bd52;
  border-radius: 999px;
  background: #fff;
  color: var(--amber);
  font-size: 13px;
  font-weight: 900;
  padding: 0 12px;
}
.window-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.time-button {
  min-height: 38px;
  border: 1px solid #a9dac2;
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 13px;
  font-weight: 900;
  padding: 0 12px;
}
.reason {
  border-left: 3px solid var(--blue);
  padding-left: 10px;
  color: #38506f;
  font-size: 13px;
  font-weight: 760;
  line-height: 1.45;
}
.timeline {
  display: grid;
  grid-template-columns: repeat(19, minmax(18px, 1fr));
  gap: 3px;
}
.tick {
  min-height: 42px;
  border-radius: 6px;
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
  color: #475569;
  font-size: 11px;
  font-weight: 850;
}
.tick.available {
  border-color: #a9dac2;
  background: var(--green-soft);
  color: var(--green);
}
.tick.booked {
  background: #edf1f6;
  color: #64748b;
}
.legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}
.legend span::before {
  content: "";
  width: 10px;
  height: 10px;
  display: inline-block;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: -1px;
  background: #edf1f6;
}
.legend .ok::before { background: var(--green-soft); border: 1px solid #a9dac2; }
.legend .no::before { background: #edf1f6; border: 1px solid var(--line); }
.detail {
  margin-top: 14px;
  padding: 16px;
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 14px;
  align-items: start;
}
.detail-side {
  display: grid;
  gap: 8px;
}
.info-row {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 11px;
  background: var(--soft);
}
.info-row strong {
  display: block;
  margin-top: 3px;
}
details {
  border-top: 1px solid var(--line);
  margin-top: 12px;
  padding-top: 12px;
}
summary {
  cursor: pointer;
  font-weight: 900;
}
.empty-state {
  padding: 24px 18px;
  color: var(--muted);
  font-weight: 800;
  line-height: 1.5;
}
.favorite-strip {
  margin-bottom: 10px;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  background: #172033;
  color: #fff;
  border-radius: 999px;
  padding: 11px 16px;
  font-size: 13px;
  font-weight: 850;
  box-shadow: var(--shadow);
  display: none;
  z-index: 30;
}
.toast.show { display: block; }
.mobile-cta {
  display: none;
}
@media (max-width: 960px) {
  .hero, .filters, .summary-grid, .detail-grid, .results {
    grid-template-columns: 1fr;
  }
  .actions, .last-check { justify-content: flex-start; text-align: left; }
}
@media (max-width: 620px) {
  .shell {
    width: 100%;
    padding: 14px 10px 108px;
  }
  .hero { gap: 10px; }
  h1 { font-size: 24px; }
  .subtitle { font-size: 14px; }
  .actions { width: 100%; }
  .actions .button {
    flex: 1 1 calc(50% - 4px);
    padding: 0 10px;
  }
  .filter-block {
    padding: 12px;
  }
  .filter-title {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
  .filter-title .muted {
    text-align: left;
  }
  .date-pills {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .segmented {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .segmented .chip {
    padding: 0 4px;
  }
  .search-row {
    grid-template-columns: 1fr;
  }
  .summary-card {
    min-height: auto;
  }
  .section-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .section-head .control {
    max-width: none !important;
  }
  .card-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .card-actions .button {
    width: 100%;
  }
  .timeline {
    grid-template-columns: repeat(10, minmax(0, 1fr));
  }
  .mobile-cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: block;
    padding: 10px;
    background: rgba(255, 255, 255, .96);
    border-top: 1px solid var(--line);
    z-index: 20;
  }
  .mobile-cta .button {
    width: 100%;
  }
}
</style>
</head>
<body>
<div class="shell">
  <header class="hero">
    <div>
      <p class="eyebrow">울산 북구 공공체육시설</p>
      <h1>울산 북구 축구장 빈 시간 찾기</h1>
      <p class="subtitle">공식 예약 시스템 기준으로 빈 시간을 빠르게 확인하고, 실제 예약은 공식 사이트에서 진행하세요.</p>
    </div>
    <div class="actions">
      <div id="lastChecked" class="last-check">마지막 확인: 아직 없음</div>
      <button id="refreshButton" class="button ghost" type="button">새로고침</button>
      <a class="button" href="https://crs.ubimc.or.kr/yeyak" target="_blank" rel="noreferrer">공식 사이트</a>
    </div>
  </header>

  <div class="notice">이 페이지에서는 예약 현황만 확인할 수 있어요. 최종 예약 가능 여부와 예약 확정은 공식 예약 시스템에서 확인됩니다.</div>

  <section class="filters" aria-label="검색 조건">
    <div class="filter-block">
      <div class="filter-title">
        <h2>날짜</h2>
        <div class="muted" id="selectedDateLabel"></div>
      </div>
      <div id="datePills" class="date-pills"></div>
    </div>
    <div class="filter-block">
      <div class="filter-title">
        <h2>이용 시간</h2>
        <div class="muted">기본 2시간</div>
      </div>
      <div id="durationPills" class="segmented"></div>
      <div class="search-row">
        <input id="searchInput" class="control" type="search" placeholder="운동장 검색: 달천, 농소, 화봉">
        <button id="availableOnlyButton" class="button is-active" type="button">예약 가능만 보기</button>
      </div>
    </div>
  </section>

  <section id="summaryGrid" class="summary-grid" aria-live="polite"></section>

  <section id="favoritesSection"></section>

  <div class="section-head">
    <div>
      <h2>추천 결과</h2>
      <p class="muted">빈 시간이 많은 곳과 빠른 시간을 먼저 보여줘요.</p>
    </div>
    <select id="sortSelect" class="control" style="max-width:180px" aria-label="정렬 기준">
      <option value="best">추천순</option>
      <option value="early">가장 빠른 시간순</option>
      <option value="many">빈 시간 많은 순</option>
      <option value="name">이름순</option>
    </select>
  </div>
  <section id="results" class="results" aria-live="polite"></section>

  <section id="detail" class="detail"></section>
</div>

<div class="mobile-cta">
  <a id="mobileOfficialLink" class="button success" href="https://crs.ubimc.or.kr/yeyak" target="_blank" rel="noreferrer">공식 사이트에서 예약하기</a>
</div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>

<script>
var $ = function (id) { return document.getElementById(id); };
var STATE_KEY = 'ulsan-soccer-state-v3';
var FAVORITE_KEY = 'ulsan-soccer-favorites';
var DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
var overview = null;
var favorites = readJson(FAVORITE_KEY, []);
var state = Object.assign({
  date: todayIso(),
  duration: 2,
  selectedId: 'T0000037',
  availableOnly: true,
  query: '',
  sort: 'best'
}, readJson(STATE_KEY, {}));

function readJson(key, fallback) {
  try {
    var value = JSON.parse(localStorage.getItem(key) || 'null');
    return value == null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function saveFavorites() {
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites));
}

function todayIso() {
  return toIso(new Date());
}

function toIso(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function addDays(date, days) {
  var next = new Date(date + 'T00:00:00');
  next.setDate(next.getDate() + days);
  return toIso(next);
}

function nextWeekday(day) {
  var date = new Date();
  var diff = (day - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return toIso(date);
}

function relativeDateLabel(offset, date) {
  if (offset === 0) return '오늘';
  if (offset === 1) return '내일';
  if (offset === 2) return '모레';
  var value = new Date(date + 'T00:00:00');
  return DAY_NAMES[value.getDay()] + '요일';
}

function dateLabel(date) {
  var value = new Date(date + 'T00:00:00');
  return value.getFullYear() + '년 ' + (value.getMonth() + 1) + '월 ' + value.getDate() + '일 ' + DAY_NAMES[value.getDay()] + '요일';
}

function shortDateLabel(date) {
  var value = new Date(date + 'T00:00:00');
  return (value.getMonth() + 1) + '/' + value.getDate() + ' ' + DAY_NAMES[value.getDay()];
}

function localTime(value) {
  if (!value) return '아직 없음';
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function time(value) {
  return String(value || '').slice(0, 5);
}

function rangeLabel(start, end) {
  return time(start) + '~' + time(end);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function isFavorite(id) {
  return favorites.indexOf(id) !== -1;
}

function showToast(message) {
  var toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 1800);
}

function setLoading(isLoading) {
  $('refreshButton').textContent = isLoading ? '확인 중...' : '새로고침';
  $('refreshButton').disabled = isLoading;
}

function renderControls() {
  $('selectedDateLabel').textContent = dateLabel(state.date);
  $('searchInput').value = state.query;
  $('availableOnlyButton').className = 'button' + (state.availableOnly ? ' is-active' : '');
  $('sortSelect').value = state.sort;

  var dateOptions = [0, 1, 2, 3].map(function (offset) {
    var date = addDays(todayIso(), offset);
    return [relativeDateLabel(offset, date), date];
  });
  $('datePills').innerHTML = dateOptions.map(function (option) {
    var active = option[1] === state.date ? ' is-active' : '';
    return '<button class="button date-pill' + active + '" type="button" data-date="' + option[1] + '"><strong>' + option[0] + '</strong><span>' + shortDateLabel(option[1]) + '</span></button>';
  }).join('');

  $('durationPills').innerHTML = [1, 2, 3, 4].map(function (duration) {
    return '<button class="chip' + (duration === Number(state.duration) ? ' is-active' : '') + '" type="button" data-duration="' + duration + '">' + duration + '시간</button>';
  }).join('');
}

function renderLoading() {
  $('summaryGrid').innerHTML = [1, 2, 3].map(function () {
    return '<div class="summary-card"><span class="muted">확인 중</span><strong>...</strong><p>울산 북구 공공체육시설 예약 현황을 불러오는 중이에요.</p></div>';
  }).join('');
  $('results').innerHTML = '<div class="empty-state">운동장 카드와 시간표를 불러오는 중이에요.</div>';
  $('detail').innerHTML = '';
}

async function loadOverview() {
  renderControls();
  renderLoading();
  setLoading(true);
  saveState();
  try {
    var params = new URLSearchParams({ date: state.date, hours: state.duration, area: '북구' });
    var response = await fetch('/api/ulsan/soccer/overview?' + params.toString());
    overview = await response.json();
    if (!overview.results || overview.error) throw new Error(overview.message || '조회 실패');
    if (!overview.results.some(function (result) { return result.facility.id === state.selectedId; })) {
      state.selectedId = overview.recommended?.facility?.id || overview.results[0]?.facility?.id || state.selectedId;
    }
    $('lastChecked').textContent = '마지막 확인: ' + localTime(overview.updatedAt);
    renderAll();
  } catch (error) {
    $('summaryGrid').innerHTML = '<div class="summary-card"><span class="muted">조회 실패</span><strong>연결 불안정</strong><p>공식 사이트 접속이 지연 중일 수 있어요. 1분 뒤 다시 시도해 주세요.</p></div>';
    $('results').innerHTML = '<div class="empty-state">예약 정보를 불러오지 못했어요.<br><button class="button primary" type="button" onclick="loadOverview()">다시 시도</button> <a class="button" href="https://crs.ubimc.or.kr/yeyak" target="_blank" rel="noreferrer">공식 사이트 열기</a></div>';
  } finally {
    setLoading(false);
  }
}

function renderAll() {
  renderControls();
  renderSummary();
  renderFavorites();
  renderResults();
  renderDetail();
  saveState();
}

function renderSummary() {
  var earliest = overview.earliest;
  var recommended = overview.recommended;
  $('summaryGrid').innerHTML =
    '<article class="summary-card"><span class="muted">' + shortDateLabel(overview.date) + ' 예약 가능</span><strong>' + overview.availableFacilitiesCount + '곳</strong><p>' + overview.facilitiesChecked + '개 운동장을 확인했어요.</p></article>'
    + '<article class="summary-card"><span class="muted">가장 빠른 시간</span><strong>' + (earliest ? time(earliest.start) : '없음') + '</strong><p>' + (earliest ? escapeHtml(earliest.facility.name) : '선택한 날짜에는 빈 시간이 없어요.') + '</p></article>'
    + '<article class="summary-card"><span class="muted">' + overview.duration + '시간 연속 가능</span><strong>' + (recommended ? '가능' : '없음') + '</strong><p>' + (recommended ? escapeHtml(recommended.facility.name + ' ' + rangeLabel(recommended.windows[0].start, recommended.windows[0].end)) : '이용 시간을 줄이거나 날짜를 바꿔보세요.') + '</p></article>';
}

function renderFavorites() {
  var items = (overview?.results || []).filter(function (result) { return isFavorite(result.facility.id); });
  if (!items.length) {
    $('favoritesSection').innerHTML = '<div class="favorite-strip"><span class="muted">자주 보는 운동장을 즐겨찾기해두면 더 빨리 확인할 수 있어요.</span></div>';
    return;
  }
  $('favoritesSection').innerHTML = '<div class="favorite-strip"><span class="muted">내 즐겨찾기 운동장</span>' + items.map(function (item) {
    return '<button class="chip" type="button" data-pick="' + item.facility.id + '">' + escapeHtml(item.facility.place) + '</button>';
  }).join('') + '</div>';
}

function sortedResults() {
  var query = state.query.trim().toLowerCase();
  var items = (overview?.results || []).filter(function (result) {
    var haystack = (result.facility.name + ' ' + result.facility.place + ' ' + result.facility.itemName).toLowerCase();
    if (query && haystack.indexOf(query) === -1) return false;
    if (state.availableOnly && !result.isAvailableForDuration) return false;
    return true;
  });

  items.sort(function (a, b) {
    if (state.sort === 'name') return a.facility.name.localeCompare(b.facility.name, 'ko-KR');
    if (state.sort === 'many') return b.windows.length - a.windows.length || b.availableHoursCount - a.availableHoursCount;
    if (state.sort === 'early') return (a.windows[0]?.start || '99:99').localeCompare(b.windows[0]?.start || '99:99');
    return Number(b.isAvailableForDuration) - Number(a.isAvailableForDuration)
      || Number(isFavorite(b.facility.id)) - Number(isFavorite(a.facility.id))
      || (a.windows[0]?.start || '99:99').localeCompare(b.windows[0]?.start || '99:99')
      || b.windows.length - a.windows.length;
  });
  return items;
}

function renderResults() {
  var items = sortedResults();
  if (!items.length) {
    $('results').innerHTML = '<div class="empty-state">조건에 맞는 빈 시간이 없어요.<br><button class="button" type="button" data-easy-duration>1시간으로 보기</button> <button class="button" type="button" data-tomorrow>내일 보기</button> <button class="button" type="button" data-show-all>예약 없는 곳도 보기</button></div>';
    return;
  }

  $('results').innerHTML = items.map(renderResultCard).join('');
}

function renderResultCard(result) {
  var windows = result.windows.slice(0, 4);
  var badgeClass = result.error ? 'bad' : result.isAvailableForDuration ? 'good' : 'warn';
  var badgeText = result.error ? '조회 불가' : result.isAvailableForDuration ? state.duration + '시간 연속 가능' : '연속 시간 없음';
  var windowHtml = windows.length
    ? windows.map(function (window) {
      return '<button class="time-button" type="button" data-pick-window="' + result.facility.id + '" data-window="' + window.label + '">' + rangeLabel(window.start, window.end) + '</button>';
    }).join('')
    : '<span class="muted">선택한 조건에서는 가능한 시간이 없어요.</span>';

  return '<article class="result-card" data-card="' + result.facility.id + '">'
    + '<div class="card-top"><button class="favorite-button" type="button" aria-label="' + (isFavorite(result.facility.id) ? '즐겨찾기 해제' : '즐겨찾기 추가') + '" data-favorite="' + result.facility.id + '">' + (isFavorite(result.facility.id) ? '★ 즐겨찾기됨' : '☆ 즐겨찾기') + '</button><span class="badge ' + badgeClass + '">' + badgeText + '</span></div>'
    + '<div><h3>' + escapeHtml(result.facility.name) + '</h3><p class="muted">' + escapeHtml(result.facility.area + ' · ' + result.facility.itemName) + '</p></div>'
    + '<div class="window-list">' + windowHtml + '</div>'
    + '<div class="reason">추천 이유: ' + escapeHtml(result.reasons.join(' ')) + '</div>'
    + renderTimeline(result.timeline)
    + '<div class="card-actions"><button class="button ghost" type="button" data-detail="' + result.facility.id + '">상세 보기</button><a class="button success" href="' + escapeHtml(result.sourceUrl) + '" target="_blank" rel="noreferrer">공식 예약</a><button class="button" type="button" data-share="' + result.facility.id + '">링크 복사</button></div>'
    + '</article>';
}

function renderTimeline(timeline) {
  if (!timeline.length) return '<div class="empty-state">시간표를 불러오지 못했어요.</div>';
  return '<div><div class="timeline" aria-label="시간대별 예약 가능 여부">' + timeline.map(function (slot) {
    var cls = slot.status === 'AVAILABLE' ? 'available' : 'booked';
    var label = slot.status === 'AVAILABLE' ? '가능' : '예약';
    return '<span class="tick ' + cls + '" title="' + time(slot.start) + ' ' + label + '">' + slot.hour + '</span>';
  }).join('') + '</div><div class="legend"><span class="ok">예약 가능</span><span class="no">이미 예약됨</span></div></div>';
}

function selectedResult() {
  return (overview?.results || []).find(function (result) { return result.facility.id === state.selectedId; })
    || overview?.recommended
    || overview?.results?.[0]
    || null;
}

function renderDetail() {
  var result = selectedResult();
  if (!result) {
    $('detail').innerHTML = '';
    return;
  }
  state.selectedId = result.facility.id;
  $('mobileOfficialLink').href = result.sourceUrl;

  var windows = result.windows.length
    ? result.windows.map(function (window) {
      return '<button class="time-button" type="button" data-pick-window="' + result.facility.id + '" data-window="' + window.label + '">' + rangeLabel(window.start, window.end) + ' 예약 가능</button>';
    }).join('')
    : '<div class="empty-state">이 날짜에는 ' + state.duration + '시간 연속 가능한 시간이 없어요.</div>';
  var booked = result.slots.filter(function (slot) { return slot.status === 'BOOKED'; });

  $('detail').innerHTML = '<div class="detail-grid">'
    + '<div><p class="muted">현재 보고 있는 운동장</p><h2>' + escapeHtml(result.facility.name) + '</h2><p class="subtitle">' + escapeHtml(result.facility.area + ' · ' + result.facility.itemName) + '</p><div class="window-list" style="margin-top:12px">' + windows + '</div><div style="margin-top:12px">' + renderTimeline(result.timeline) + '</div><details><summary>이미 예약된 시간 보기</summary><div class="window-list" style="margin-top:10px">' + (booked.length ? booked.map(function (slot) { return '<span class="chip">' + rangeLabel(slot.start, slot.end) + '</span>'; }).join('') : '<span class="muted">예약된 시간이 없어요.</span>') + '</div></details></div>'
    + '<aside class="detail-side"><div class="info-row"><span class="muted">운영 시간</span><strong>05:00~24:00</strong></div><div class="info-row"><span class="muted">예약 단위</span><strong>1시간 단위 조회</strong></div><div class="info-row"><span class="muted">조명 여부</span><strong>공식 페이지에서 확인</strong></div><a class="button success" href="' + escapeHtml(result.sourceUrl) + '" target="_blank" rel="noreferrer">공식 사이트에서 예약하기</a><p class="muted">최종 예약 가능 여부는 공식 사이트에서 확인됩니다.</p></aside>'
    + '</div>';
}

function toggleFavorite(id) {
  if (isFavorite(id)) {
    favorites = favorites.filter(function (favoriteId) { return favoriteId !== id; });
    showToast('즐겨찾기에서 제거했어요.');
  } else {
    favorites = [id].concat(favorites.filter(function (favoriteId) { return favoriteId !== id; }));
    showToast('즐겨찾기에 추가했어요.');
  }
  saveFavorites();
  renderAll();
}

function copyShare(id, windowLabel) {
  var result = (overview?.results || []).find(function (item) { return item.facility.id === id; });
  if (!result) return;
  var text = result.facility.name + ' ' + shortDateLabel(state.date) + ' ' + (windowLabel || (result.windows[0] ? result.windows[0].label : '예약 현황')) + ' 확인: ' + location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function () { showToast('링크를 복사했어요.'); });
  } else {
    showToast('복사 기능을 사용할 수 없어요.');
  }
}

document.addEventListener('click', function (event) {
  var dateButton = event.target.closest('[data-date]');
  var durationButton = event.target.closest('[data-duration]');
  var favoriteButton = event.target.closest('[data-favorite]');
  var detailButton = event.target.closest('[data-detail]');
  var pickButton = event.target.closest('[data-pick]');
  var windowButton = event.target.closest('[data-pick-window]');
  var shareButton = event.target.closest('[data-share]');

  if (dateButton) {
    state.date = dateButton.dataset.date;
    loadOverview();
  } else if (durationButton) {
    state.duration = Number(durationButton.dataset.duration);
    loadOverview();
  } else if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.favorite);
  } else if (detailButton) {
    state.selectedId = detailButton.dataset.detail;
    renderAll();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (pickButton) {
    state.selectedId = pickButton.dataset.pick;
    renderAll();
  } else if (windowButton) {
    state.selectedId = windowButton.dataset.pickWindow;
    renderAll();
    copyShare(windowButton.dataset.pickWindow, windowButton.dataset.window);
  } else if (shareButton) {
    copyShare(shareButton.dataset.share);
  } else if (event.target.closest('[data-easy-duration]')) {
    state.duration = 1;
    loadOverview();
  } else if (event.target.closest('[data-tomorrow]')) {
    state.date = addDays(state.date, 1);
    loadOverview();
  } else if (event.target.closest('[data-show-all]')) {
    state.availableOnly = false;
    renderAll();
  }
});

$('refreshButton').addEventListener('click', loadOverview);
$('availableOnlyButton').addEventListener('click', function () {
  state.availableOnly = !state.availableOnly;
  renderAll();
});
$('searchInput').addEventListener('input', function (event) {
  state.query = event.target.value;
  renderAll();
});
$('sortSelect').addEventListener('change', function (event) {
  state.sort = event.target.value;
  renderAll();
});

renderControls();
loadOverview();
</script>
</body>
</html>`;
