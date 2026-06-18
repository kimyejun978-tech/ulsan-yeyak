import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const BASE_URL = 'https://crs.ubimc.or.kr';
const AJAX_URL = `${BASE_URL}/yeyak/ajxAgent/ajxRsvExplodTime`;
const DEFAULT_FACILITY_ID = 'T0000037';
const DEFAULT_ITEM_TYPE = 'I';
const DEFAULT_MEM_ID = 'B0001016';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);
const FACILITY_CACHE_TTL_MS = Number(process.env.FACILITY_CACHE_TTL_MS || 6 * 60 * 60 * 1000);

const ULSAN_AREAS = ['중구', '남구', '동구', '북구', '울주군'];
const NEARBY_AREAS = {
  중구: ['중구', '남구', '북구', '동구', '울주군'],
  남구: ['남구', '중구', '울주군', '동구', '북구'],
  동구: ['동구', '북구', '남구', '중구', '울주군'],
  북구: ['북구', '중구', '동구', '울주군', '남구'],
  울주군: ['울주군', '남구', '북구', '중구', '동구']
};

const SOCCER_KEYWORDS = ['축구', '풋살', '인조잔디'];
const NON_SOCCER_KEYWORDS = ['야구', '테니스', '배드민턴', '농구', '족구', '게이트볼', '수영', '탁구'];

const SEEDED_FACILITIES = [
  {
    id: DEFAULT_FACILITY_ID,
    itemId: DEFAULT_FACILITY_ID,
    name: '달천운동장 인조잔디축구장',
    shortName: '달천축구장',
    area: '북구',
    itemType: DEFAULT_ITEM_TYPE,
    memId: DEFAULT_MEM_ID
  }
];

const FACILITY_LIST_URLS = [
  `${BASE_URL}/yeyak/sports_facilities/facility_list?ITEM_TYPE=I&selItemKind=`,
  `${BASE_URL}/yeyak/sports_facilities/facility_list?ITEM_TYPE=I`,
  `${BASE_URL}/yeyak/sports_facilities?ITEM_TYPE=I`
];

const HOLIDAYS_2026 = {
  '2026-01-01': { name: '신정', type: 'public' },
  '2026-02-16': { name: '설날(연휴)', type: 'public' },
  '2026-02-17': { name: '설날', type: 'public' },
  '2026-02-18': { name: '설날(연휴)', type: 'public' },
  '2026-03-01': { name: '삼일절', type: 'public' },
  '2026-03-02': { name: '대체공휴일', type: 'substitute', of: '삼일절' },
  '2026-05-05': { name: '어린이날', type: 'public' },
  '2026-05-24': { name: '부처님오신날', type: 'public' },
  '2026-05-25': { name: '대체공휴일', type: 'substitute', of: '부처님오신날' },
  '2026-06-03': { name: '지방선거일', type: 'public' },
  '2026-06-06': { name: '현충일', type: 'public' },
  '2026-08-15': { name: '광복절', type: 'public' },
  '2026-08-17': { name: '대체공휴일', type: 'substitute', of: '광복절' },
  '2026-09-24': { name: '추석(연휴)', type: 'public' },
  '2026-09-25': { name: '추석', type: 'public' },
  '2026-09-26': { name: '추석(연휴)', type: 'public' },
  '2026-10-03': { name: '개천절', type: 'public' },
  '2026-10-05': { name: '대체공휴일', type: 'substitute', of: '개천절' },
  '2026-10-09': { name: '한글날', type: 'public' },
  '2026-12-25': { name: '성탄절', type: 'public' }
};

const responseCache = new Map();
let facilityCache = null;
let facilityCacheExpiresAt = 0;

function requestText(urlInput, { method = 'GET', body = null, headers = {} } = {}) {
  const url = new URL(urlInput);
  const requestHeaders = {
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ...headers
  };

  if (body != null && requestHeaders['Content-Length'] == null) {
    requestHeaders['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        headers: requestHeaders,
        rejectUnauthorized: process.env.UBIMC_REJECT_UNAUTHORIZED === '1'
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Upstream HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          resolve(data);
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(45000, () => req.destroy(new Error('Timeout')));
    if (body != null) req.write(body);
    req.end();
  });
}

async function postExplodeTime(selDate, facility) {
  const body = new URLSearchParams({ selDate, item_id: facility.itemId }).toString();
  const text = await requestText(AJAX_URL, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: facilitySourceUrl(facility)
    }
  });
  return JSON.parse(text);
}

function htmlDecode(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function cleanText(value) {
  return htmlDecode(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferArea(name) {
  for (const area of ULSAN_AREAS) {
    if (String(name).includes(area)) return area;
  }
  return '';
}

function isSoccerFacility(facility) {
  const text = `${facility.name || ''} ${facility.shortName || ''}`.replace(/\s+/g, '');
  if (!text) return false;
  if (NON_SOCCER_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
  return SOCCER_KEYWORDS.some((keyword) => text.includes(keyword));
}

function shortFacilityName(name, itemId) {
  const clean = cleanText(name);
  if (!clean) return `울산 축구장 ${itemId}`;
  return clean.replace(/\s*예약\s*/g, ' ').replace(/\s*상세보기\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function facilitySourceUrl(facility) {
  if (facility.sourceUrl) return facility.sourceUrl;
  const params = new URLSearchParams({
    ITEM_TYPE: facility.itemType || DEFAULT_ITEM_TYPE,
    selItemKind: '',
    mem_id: facility.memId || DEFAULT_MEM_ID,
    item_id: facility.itemId
  });
  return `${BASE_URL}/yeyak/sports_facilities/facility_view?${params.toString()}`;
}

function facilityFromUrl(rawUrl, label = '') {
  try {
    const url = new URL(htmlDecode(rawUrl), BASE_URL);
    const itemId = url.searchParams.get('item_id');
    if (!itemId || !/^T\d+$/i.test(itemId)) return null;
    const name = shortFacilityName(label, itemId);
    return {
      id: itemId,
      itemId,
      name,
      shortName: name,
      area: inferArea(name),
      itemType: url.searchParams.get('ITEM_TYPE') || DEFAULT_ITEM_TYPE,
      memId: url.searchParams.get('mem_id') || DEFAULT_MEM_ID,
      sourceUrl: url.toString()
    };
  } catch {
    return null;
  }
}

function extractFacilities(html) {
  const facilities = [];
  const push = (facility) => {
    if (facility) facilities.push(facility);
  };

  const anchorRe = /<a\b[^>]*href=["']([^"']*facility_view\?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) push(facilityFromUrl(match[1], match[2]));

  const hrefRe = /(?:href|data-url)=["']([^"']*facility_view\?[^"']*)["']/gi;
  for (const match of html.matchAll(hrefRe)) push(facilityFromUrl(match[1]));

  const bareRe = /sports_facilities\/facility_view\?[^"'<>\\\s)]+/gi;
  for (const match of html.matchAll(bareRe)) push(facilityFromUrl(match[0]));

  return facilities;
}

function extractFacilityListUrls(html) {
  const urls = [];
  const hrefRe = /(?:href|data-url)=["']([^"']*sports_facilities\/facility_list[^"']*)["']/gi;
  for (const match of html.matchAll(hrefRe)) {
    try {
      const url = new URL(htmlDecode(match[1]), BASE_URL);
      if ((url.searchParams.get('ITEM_TYPE') || DEFAULT_ITEM_TYPE) === DEFAULT_ITEM_TYPE) urls.push(url.toString());
    } catch {
      // ignore malformed links
    }
  }
  return urls;
}

function mergeFacilities(facilities) {
  const byId = new Map();
  for (const facility of facilities) {
    if (!facility?.itemId) continue;
    const previous = byId.get(facility.itemId);
    const name = facility.name || previous?.name || `울산 축구장 ${facility.itemId}`;
    byId.set(facility.itemId, {
      ...(previous || {}),
      ...facility,
      id: facility.itemId,
      name,
      shortName: facility.shortName || previous?.shortName || name,
      area: facility.area || previous?.area || inferArea(name)
    });
  }

  return [...byId.values()]
    .filter(isSoccerFacility)
    .sort((a, b) => {
      const area = String(a.area || '').localeCompare(String(b.area || ''), 'ko-KR');
      if (area !== 0) return area;
      return String(a.shortName || a.name).localeCompare(String(b.shortName || b.name), 'ko-KR');
    });
}

async function loadFacilityCatalog() {
  const now = Date.now();
  if (facilityCache && facilityCacheExpiresAt > now) return facilityCache;

  const discovered = [];
  const errors = [];
  const visited = new Set();
  const queue = [...FACILITY_LIST_URLS];

  while (queue.length && visited.size < 25) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    try {
      const html = await requestText(url);
      discovered.push(...extractFacilities(html));
      for (const nextUrl of extractFacilityListUrls(html)) {
        if (!visited.has(nextUrl) && !queue.includes(nextUrl)) queue.push(nextUrl);
      }
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  facilityCache = {
    facilities: mergeFacilities([...SEEDED_FACILITIES, ...discovered]),
    areas: ULSAN_AREAS,
    sourceUrl: FACILITY_LIST_URLS[0],
    source: discovered.length ? 'official-list' : 'seeded-fallback',
    filter: 'soccer-only',
    errors,
    updatedAt: new Date().toISOString()
  };
  facilityCacheExpiresAt = now + FACILITY_CACHE_TTL_MS;
  return facilityCache;
}

function normalizeDate(dateParam) {
  if (dateParam == null || dateParam === '') {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const s = String(dateParam);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : s;
}

function normalizeFacilityId(facilityId) {
  const id = String(facilityId || DEFAULT_FACILITY_ID).trim();
  if (id === 'dalcheon-soccer') return DEFAULT_FACILITY_ID;
  return id || DEFAULT_FACILITY_ID;
}

async function resolveFacility(facilityId) {
  const id = normalizeFacilityId(facilityId);
  const catalog = await loadFacilityCatalog();
  const known = catalog.facilities.find((facility) => facility.id === id || facility.itemId === id);
  if (known) return known;
  if (/^T\d+$/i.test(id)) {
    return {
      id,
      itemId: id,
      name: `울산 축구장 ${id}`,
      shortName: `울산 축구장 ${id}`,
      area: '',
      itemType: DEFAULT_ITEM_TYPE,
      memId: DEFAULT_MEM_ID
    };
  }
  throw new Error(`Unknown facilityId: ${facilityId}`);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function holidayInfo(dateISO) {
  if (String(dateISO).startsWith('2026-')) {
    const h = HOLIDAYS_2026[dateISO];
    if (h) return { isHoliday: true, ...h };
  }
  return { isHoliday: false, name: null, type: null };
}

function makeSlots(bookedHours) {
  const slots = [];
  for (let h = 5; h <= 23; h++) {
    const start = `${pad2(h)}:00`;
    const end = `${pad2(h + 1)}:00`;
    const isBooked = bookedHours.has(h);
    slots.push({
      hour: h,
      start,
      end,
      status: isBooked ? 'BOOKED' : 'AVAILABLE',
      label: isBooked ? '예약불가' : '예약가능',
      raw: `${start} ~ ${end} (${isBooked ? '예약불가' : '예약가능'})`
    });
  }
  return slots;
}

async function fetchFacilitySlots(dateISO, facilityId = DEFAULT_FACILITY_ID) {
  const facility = await resolveFacility(facilityId);
  const res = await postExplodeTime(dateISO.replaceAll('-', ''), facility);
  const holiday = holidayInfo(dateISO);

  if (res?.chk_result !== 'OK' && res?.chk_result !== 'NODATA') {
    return {
      facility: facility.id,
      facilityName: facility.name,
      facilityInfo: facility,
      date: dateISO,
      sourceUrl: facilitySourceUrl(facility),
      slots: [],
      rawRowCount: 0,
      holiday,
      error: res?.msg || '공휴일/휴무일 등으로 조회가 제한되었어요.',
      note: 'OFFICIAL_BLOCK',
      msg: res?.msg || '',
      updatedAt: new Date().toISOString()
    };
  }

  const bookedHours = new Set(
    String(res.hhhlist || '')
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isFinite(n))
  );
  const slots = makeSlots(bookedHours);

  return {
    facility: facility.id,
    facilityName: facility.name,
    facilityInfo: facility,
    date: dateISO,
    sourceUrl: facilitySourceUrl(facility),
    slots,
    rawRowCount: slots.length,
    holiday,
    allBooked: slots.length > 0 && slots.every((slot) => slot.status === 'BOOKED'),
    bookedHoursCount: bookedHours.size,
    availableHoursCount: slots.filter((slot) => slot.status === 'AVAILABLE').length,
    msg: res?.msg || '',
    updatedAt: new Date().toISOString()
  };
}

function normalizeArea(area) {
  const value = String(area || '').trim();
  return ULSAN_AREAS.includes(value) ? value : '북구';
}

function normalizeHours(hours) {
  const value = Number(hours || 2);
  return Number.isFinite(value) ? Math.max(1, Math.min(4, Math.trunc(value))) : 2;
}

function normalizeTime(time, hours = 1) {
  const value = String(time || '19:00').trim();
  const match = /^(\d{1,2}):?(\d{2})?$/.exec(value);
  if (!match) return '19:00';
  const maxStart = Math.max(5, 24 - hours);
  return `${pad2(Math.max(5, Math.min(maxStart, Number(match[1]))))}:00`;
}

function requestedHours(startTime, hours) {
  const startHour = Number(startTime.slice(0, 2));
  return Array.from({ length: hours }, (_, index) => startHour + index).filter((hour) => hour >= 5 && hour <= 23);
}

function recommendationScore(slots, hours) {
  const targetSlots = slots.filter((slot) => hours.includes(slot.hour));
  const availableSlots = targetSlots.filter((slot) => slot.status === 'AVAILABLE');
  const bookedSlots = targetSlots.filter((slot) => slot.status === 'BOOKED');
  return {
    requestedHours: hours,
    requestedSlots: targetSlots.length,
    availableSlots: availableSlots.length,
    bookedSlots: bookedSlots.length,
    isFullyAvailable: targetSlots.length > 0 && bookedSlots.length === 0,
    unavailableSlots: bookedSlots.map((slot) => `${slot.start}-${slot.end}`)
  };
}

function areaRank(selectedArea, facilityArea) {
  const rank = NEARBY_AREAS[selectedArea] || NEARBY_AREAS.북구;
  const index = rank.indexOf(facilityArea);
  return index === -1 ? rank.length : index;
}

async function recommendSoccerFacilities({ area, dateISO, startTime, hours }) {
  const normalizedArea = normalizeArea(area);
  const normalizedHours = normalizeHours(hours);
  const normalizedStart = normalizeTime(startTime, normalizedHours);
  const targetHours = requestedHours(normalizedStart, normalizedHours);
  const catalog = await loadFacilityCatalog();
  const rankedAreas = NEARBY_AREAS[normalizedArea] || NEARBY_AREAS.북구;
  const candidates = catalog.facilities
    .filter((facility) => !facility.area || rankedAreas.includes(facility.area))
    .sort((a, b) => areaRank(normalizedArea, a.area) - areaRank(normalizedArea, b.area))
    .slice(0, 12);

  const results = [];
  for (const facility of candidates) {
    try {
      const data = await fetchFacilitySlots(dateISO, facility.id);
      results.push({
        facility,
        date: dateISO,
        startTime: normalizedStart,
        hours: normalizedHours,
        areaRank: areaRank(normalizedArea, facility.area),
        sourceUrl: data.sourceUrl,
        error: data.error || null,
        ...recommendationScore(data.slots, targetHours)
      });
    } catch (error) {
      results.push({
        facility,
        date: dateISO,
        startTime: normalizedStart,
        hours: normalizedHours,
        areaRank: areaRank(normalizedArea, facility.area),
        error: error.message || '조회 실패',
        requestedHours: targetHours,
        requestedSlots: targetHours.length,
        availableSlots: 0,
        bookedSlots: targetHours.length,
        isFullyAvailable: false,
        unavailableSlots: []
      });
    }
  }

  results.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    if (a.isFullyAvailable !== b.isFullyAvailable) return a.isFullyAvailable ? -1 : 1;
    if (a.bookedSlots !== b.bookedSlots) return a.bookedSlots - b.bookedSlots;
    if (a.availableSlots !== b.availableSlots) return b.availableSlots - a.availableSlots;
    if (a.areaRank !== b.areaRank) return a.areaRank - b.areaRank;
    return String(a.facility.shortName || a.facility.name).localeCompare(
      String(b.facility.shortName || b.facility.name),
      'ko-KR'
    );
  });

  return {
    area: normalizedArea,
    date: dateISO,
    startTime: normalizedStart,
    hours: normalizedHours,
    requestedHours: targetHours,
    facilitiesChecked: results.length,
    results,
    updatedAt: new Date().toISOString()
  };
}

function cached(key, ttl, loader) {
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.value);
  return Promise.resolve(loader()).then((value) => {
    responseCache.set(key, { expiresAt: now + ttl, value });
    return value;
  });
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

async function route(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') return sendJson(res, 200, { ok: true });

  if (url.pathname === '/api/ulsan/facilities') {
    return sendJson(res, 200, await loadFacilityCatalog());
  }

  if (url.pathname === '/api/ulsan/sports' || url.pathname === '/api/dalcheon/soccer') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) return sendJson(res, 400, { error: 'BadRequest', message: 'date must be YYYY-MM-DD' });
    const facilityId = url.pathname === '/api/dalcheon/soccer' ? DEFAULT_FACILITY_ID : url.searchParams.get('facilityId');
    const key = `slots:${facilityId || DEFAULT_FACILITY_ID}:${date}`;
    return sendJson(res, 200, await cached(key, CACHE_TTL_MS, () => fetchFacilitySlots(date, facilityId)));
  }

  if (url.pathname === '/api/ulsan/soccer/recommendations') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) return sendJson(res, 400, { error: 'BadRequest', message: 'date must be YYYY-MM-DD' });
    const area = url.searchParams.get('area') || '북구';
    const startTime = url.searchParams.get('start') || url.searchParams.get('startTime') || '19:00';
    const hours = Number(url.searchParams.get('hours') || 2);
    const key = `recommend:${area}:${date}:${startTime}:${hours}`;
    return sendJson(res, 200, await cached(key, CACHE_TTL_MS, () => recommendSoccerFacilities({ area, dateISO: date, startTime, hours })));
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    return send(res, 200, APP_HTML, 'text/html; charset=utf-8');
  }

  sendJson(res, 404, { error: 'NotFound' });
}

const APP_HTML = String.raw`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b1220">
  <title>울산 축구장 예약 확인</title>
  <style>
    :root{color-scheme:dark;--bg:#0b1220;--panel:#0f1b2d;--line:#20314f;--text:#e7eefc;--muted:#a8b3c7;--ok:#22c55e;--no:#ef4444;--blue:#3b82f6}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    button,select,input{font:inherit}.wrap{max-width:780px;margin:0 auto;padding:16px 14px 28px}.header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    h1{font-size:24px;margin:0}.sub{color:var(--muted);font-weight:800;margin-top:2px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:12px}
    .row{display:flex;gap:10px;align-items:end}.grow{flex:1}.field{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}.label{font-size:13px;font-weight:900;color:var(--muted)}
    select,input,.btn{background:#0a1426;border:1px solid var(--line);color:var(--text);border-radius:12px;padding:12px 14px;font-weight:900;min-width:0}.btn{cursor:pointer}.btn.primary{border-color:rgba(59,130,246,.65);background:rgba(59,130,246,.16)}
    .star{width:48px;height:48px;font-size:23px;padding:0}.active{border-color:#f59e0b;color:#fde68a}.chips{display:flex;gap:8px;overflow:auto;margin-bottom:12px}.chip{white-space:nowrap}
    .dateNav{display:flex;gap:10px}.dateNav input{flex:1}.quick{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.grid{display:grid;grid-template-columns:1.1fr 1.3fr 1fr .8fr;gap:10px}
    .blocks{display:flex;flex-wrap:wrap;gap:10px}.block{border:1px solid var(--line);background:#0a1426;border-radius:14px;padding:12px 14px;min-width:160px;flex:1 1 180px}.ok{border-color:rgba(34,197,94,.42);background:rgba(34,197,94,.10)}.bad{border-color:rgba(239,68,68,.42);background:rgba(239,68,68,.10)}
    .sectionTitle{font-size:15px;color:var(--muted);font-weight:900;margin-bottom:10px}.hero{border:1px solid var(--line);border-radius:16px;padding:18px;text-align:center}.hero b{font-size:22px}.notice{color:#fde68a;background:rgba(245,158,11,.13);border:1px solid rgba(245,158,11,.35);padding:12px;border-radius:14px;font-weight:900}.error{color:#fecaca;background:#3a1111;border:1px solid #7f1d1d;padding:12px;border-radius:14px}
    .recList{display:flex;flex-direction:column;gap:10px;margin-top:12px}.rec{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;border:1px solid var(--line);background:#0a1426;border-radius:14px;padding:10px}.rec.best{border-color:rgba(34,197,94,.55);background:rgba(34,197,94,.10)}.recMain{background:transparent;border:0;color:var(--text);text-align:left;padding:0}.meta{display:block;color:var(--muted);font-size:14px;font-weight:900;margin-top:4px}.pill{border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.10);color:#fde68a;padding:7px 10px;border-radius:999px;font-size:13px;font-weight:950;white-space:nowrap}.pill.good{border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.12);color:#bbf7d0}
    .made{margin:34px 0 8px;text-align:center;font-weight:950}.footer{text-align:center;color:var(--muted);font-size:14px}.footer a{color:#93c5fd;text-decoration:none}
    @media(max-width:680px){.grid{grid-template-columns:1fr 1fr}.rec{grid-template-columns:42px 1fr}.pill{grid-column:2;justify-self:start}}@media(max-width:520px){.header,.row{align-items:stretch;flex-direction:column}.grid{grid-template-columns:1fr}.block{min-width:100%}}
  </style>
</head>
<body>
<div class="wrap">
  <header class="header"><div><h1>울산 축구장 예약 확인</h1><div class="sub" id="subtitle">불러오는 중</div></div><button class="btn" id="refresh">새로고침</button></header>
  <section class="panel">
    <div class="row"><label class="field grow"><span class="label">축구장</span><select id="facility"></select></label><button class="btn star" id="favorite" title="즐겨찾기">☆</button></div>
    <div class="chips" id="favorites"></div>
    <div class="dateNav"><button class="btn" id="prev">← 이전</button><input id="date" type="date"><button class="btn" id="next">다음 →</button></div>
    <div class="quick"><button class="btn" data-quick="0">오늘</button><button class="btn" data-quick="1">내일</button><button class="btn" data-weekday="6">토요일</button><button class="btn" data-weekday="0">일요일</button></div>
    <div id="topMessage"></div>
  </section>
  <main id="timeline"></main>
  <section class="panel">
    <div class="header"><div><h1 style="font-size:20px">주변 축구장 추천</h1><div class="sub">예약 없는 순</div></div><button class="btn primary" id="recommendBtn">추천 보기</button></div>
    <div class="grid">
      <label class="field"><span class="label">지역</span><select id="area"></select></label>
      <label class="field"><span class="label">날짜</span><input id="recDate" type="date"></label>
      <label class="field"><span class="label">시작</span><select id="start"></select></label>
      <label class="field"><span class="label">시간</span><select id="hours"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
    </div>
    <div id="recommendations"></div>
  </section>
  <div class="made">made by 김예준</div>
  <footer class="footer"><a id="source" href="https://crs.ubimc.or.kr/yeyak" target="_blank" rel="noreferrer">원본 사이트 열기</a></footer>
</div>
<script>
const $ = (id) => document.getElementById(id);
const FAVORITES_KEY = 'ulsan-soccer-favorites';
const AREAS = ['중구','남구','동구','북구','울주군'];
let facilities = [];
let selected = 'T0000037';
let currentData = null;
let favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
function iso(d){return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')}
function label(f){return !f ? '달천축구장' : ((f.area ? f.area + ' · ' : '') + (f.shortName || f.name || f.id))}
function ampm(t){const h=Number(String(t).slice(0,2)); const m=String(t).slice(3,5); const p=h>=12?'오후':'오전'; let h12=h%12; if(!h12) h12=12; return p + ' ' + h12 + ':' + m}
function group(slots,status){const out=[];let cur=null;(slots||[]).forEach(s=>{if(s.status===status){if(!cur)cur={start:s.start,end:s.end,hours:1};else if(cur.end===s.start){cur.end=s.end;cur.hours++}else{out.push(cur);cur={start:s.start,end:s.end,hours:1}}}else if(cur){out.push(cur);cur=null}});if(cur)out.push(cur);return out}
function saveFav(){localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))}
function renderFacilities(){const sorted=[...facilities].sort((a,b)=>{const af=favorites.includes(a.id), bf=favorites.includes(b.id); if(af!==bf) return af?-1:1; return label(a).localeCompare(label(b),'ko-KR')}); $('facility').innerHTML=sorted.map(f=>'<option value="'+f.id+'">'+(favorites.includes(f.id)?'★ ':'')+label(f)+'</option>').join(''); $('facility').value=selected; const sf=facilities.find(f=>f.id===selected); $('subtitle').textContent=label(sf); $('favorite').textContent=favorites.includes(selected)?'★':'☆'; $('favorite').className=favorites.includes(selected)?'btn star active':'btn star'; $('favorites').innerHTML=favorites.map(id=>facilities.find(f=>f.id===id)).filter(Boolean).map(f=>'<button class="btn chip" data-fav="'+f.id+'">'+(f.shortName||f.name)+'</button>').join('')}
function blockHtml(blocks, tone, emptyTitle, emptySub, meta){if(!blocks.length)return '<div class="hero '+tone+'"><b>'+emptyTitle+'</b><div class="sub">'+emptySub+'</div></div>';return '<div class="blocks">'+blocks.map(b=>'<div class="block '+tone+'"><b>'+ampm(b.start)+' ~ '+ampm(b.end)+'</b><div class="meta">'+b.hours+'시간 '+meta+'</div></div>').join('')+'</div>'}
function renderTimeline(){if(!currentData)return; $('source').href=currentData.sourceUrl||'https://crs.ubimc.or.kr/yeyak'; if(currentData.error){$('timeline').innerHTML='<div class="hero bad"><b>조회 불가</b><div class="sub">'+currentData.error+'</div></div>';return} const av=group(currentData.slots,'AVAILABLE'), bk=group(currentData.slots,'BOOKED'); $('timeline').innerHTML='<section class="panel ok"><div class="sectionTitle">가능한 시간</div>'+blockHtml(av,'ok','가능 시간 없음','이 날짜는 예약 가능한 시간이 보이지 않아요','가능')+'</section><section class="panel bad"><div class="sectionTitle">예약된 시간</div>'+blockHtml(bk,'bad','예약 없음','표시된 운영 시간은 모두 사용 가능','예약')+'</section>'}
async function loadFacilities(){try{const r=await fetch('/api/ulsan/facilities'); const j=await r.json(); facilities=j.facilities||[]; const preferred=favorites.find(id=>facilities.some(f=>f.id===id)); if(!facilities.some(f=>f.id===selected)) selected=preferred || (facilities[0]&&facilities[0].id) || selected; renderFacilities()}catch(e){$('topMessage').innerHTML='<p class="notice">축구장 목록은 기본값으로 표시 중입니다.</p>'; facilities=[{id:'T0000037',shortName:'달천축구장',name:'달천운동장 인조잔디축구장',area:'북구'}]; renderFacilities()}}
async function loadSlots(){try{$('topMessage').innerHTML='<p class="notice">불러오는 중…</p>'; const qs=new URLSearchParams({date:$('date').value,facilityId:selected}); const r=await fetch('/api/ulsan/sports?'+qs); currentData=await r.json(); $('topMessage').innerHTML=''; renderFacilities(); renderTimeline()}catch(e){$('topMessage').innerHTML='<p class="error">'+e.message+'</p>'}}
function updateStartOptions(){const h=Number($('hours').value||2); const max=24-h; $('start').innerHTML=''; for(let i=5;i<=max;i++){const t=String(i).padStart(2,'0')+':00'; const o=document.createElement('option'); o.value=t; o.textContent=ampm(t); $('start').appendChild(o)} if(!$('start').value)$('start').value='19:00'}
function resultLabel(r){if(r.error)return '조회 실패'; if(r.isFullyAvailable)return '예약 없음'; if(r.bookedSlots===r.requestedSlots)return '전부 예약'; return r.availableSlots+'/'+r.requestedSlots+'시간 가능'}
async function loadRecommendations(){try{$('recommendations').innerHTML='<p class="notice">추천 조회 중…</p>'; const qs=new URLSearchParams({area:$('area').value,date:$('recDate').value,start:$('start').value,hours:$('hours').value}); const r=await fetch('/api/ulsan/soccer/recommendations?'+qs); const j=await r.json(); $('recommendations').innerHTML='<div class="recList">'+(j.results||[]).map(x=>'<article class="rec '+(x.isFullyAvailable?'best':'')+'"><button class="btn star '+(favorites.includes(x.facility.id)?'active':'')+'" data-star="'+x.facility.id+'">'+(favorites.includes(x.facility.id)?'★':'☆')+'</button><button class="recMain" data-pick="'+x.facility.id+'"><b>'+label(x.facility)+'</b><span class="meta">'+ampm(j.startTime)+'부터 '+j.hours+'시간 · '+resultLabel(x)+'</span></button><span class="pill '+(x.isFullyAvailable?'good':'')+'">'+(x.isFullyAvailable?'추천':resultLabel(x))+'</span></article>').join('')+'</div>'}catch(e){$('recommendations').innerHTML='<p class="error">'+e.message+'</p>'}}
$('date').value=iso(new Date()); $('recDate').value=$('date').value; AREAS.forEach(a=>{$('area').append(new Option(a,a))}); $('area').value='북구'; updateStartOptions(); $('start').value='19:00';
$('facility').onchange=()=>{selected=$('facility').value; loadSlots()}; $('favorite').onclick=()=>{favorites=favorites.includes(selected)?favorites.filter(x=>x!==selected):[selected,...favorites]; saveFav(); renderFacilities()};
$('favorites').onclick=(e)=>{const id=e.target.dataset.fav; if(id){selected=id; loadSlots()}}; $('prev').onclick=()=>{const d=new Date($('date').value+'T00:00:00'); d.setDate(d.getDate()-1); $('date').value=iso(d); loadSlots()}; $('next').onclick=()=>{const d=new Date($('date').value+'T00:00:00'); d.setDate(d.getDate()+1); $('date').value=iso(d); loadSlots()}; $('date').onchange=loadSlots; $('refresh').onclick=loadSlots;
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const d=new Date(); d.setDate(d.getDate()+Number(b.dataset.quick)); $('date').value=iso(d); loadSlots()}); document.querySelectorAll('[data-weekday]').forEach(b=>b.onclick=()=>{const d=new Date(); const dow=Number(b.dataset.weekday); const delta=(dow-d.getDay()+7)%7; d.setDate(d.getDate()+delta); $('date').value=iso(d); loadSlots()});
$('hours').onchange=updateStartOptions; $('recommendBtn').onclick=loadRecommendations; $('recommendations').onclick=(e)=>{const star=e.target.dataset.star; const pick=e.target.closest('[data-pick]')?.dataset.pick; if(star){favorites=favorites.includes(star)?favorites.filter(x=>x!==star):[star,...favorites]; saveFav(); renderFacilities(); loadRecommendations()} if(pick){selected=pick; $('date').value=$('recDate').value; loadSlots(); window.scrollTo({top:0,behavior:'smooth'})}};
loadFacilities().then(loadSlots);
</script>
</body>
</html>`;

http
  .createServer((req, res) => {
    route(req, res).catch((error) => {
      sendJson(res, 500, { error: 'InternalServerError', message: error.message || String(error) });
    });
  })
  .listen(PORT, HOST, () => {
    console.log(`Ulsan soccer reservation checker listening on http://${HOST}:${PORT}`);
  });
