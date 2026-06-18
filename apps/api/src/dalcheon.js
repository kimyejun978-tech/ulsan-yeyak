import https from 'node:https';
import Holidays from 'date-holidays';

const BASE_URL = 'https://crs.ubimc.or.kr';
const AJAX_URL = `${BASE_URL}/yeyak/ajxAgent/ajxRsvExplodTime`;
const DEFAULT_FACILITY_ID = 'T0000037';
const DEFAULT_ITEM_TYPE = 'I';
const DEFAULT_MEM_ID = 'B0001016';
const FACILITY_CACHE_TTL_MS = Number(process.env.FACILITY_CACHE_TTL_MS || 6 * 60 * 60 * 1000);

const hd = new Holidays('KR');

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

  /** @type {https.RequestOptions} */
  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    method,
    headers: requestHeaders,
    // The upstream TLS chain has been inconsistent in some Node runtimes.
    rejectUnauthorized: process.env.UBIMC_REJECT_UNAUTHORIZED === '1'
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
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
    });

    req.on('error', reject);
    req.setTimeout(45000, () => {
      req.destroy(new Error('Timeout'));
    });

    if (body != null) req.write(body);
    req.end();
  });
}

/**
 * Fetch booked hours for a date and facility.
 * @param {string} selDate - YYYYMMDD
 * @param {{ itemId:string, itemType?:string, memId?:string }} facility
 * @returns {Promise<{ chk_result: string, hhhlist: string, msg: string }>}
 */
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

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse JSON: ${text.slice(0, 200)}`);
  }
}

function isoToSelDate(dateISO) {
  return String(dateISO).replaceAll('-', '');
}

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

function holidayInfo(dateISO) {
  if (String(dateISO).startsWith('2026-')) {
    const h = HOLIDAYS_2026[dateISO];
    if (h) return { isHoliday: true, ...h };
    return { isHoliday: false, name: null, type: null };
  }

  const d = new Date(dateISO + 'T00:00:00');
  const hit = hd.isHoliday(d);
  if (!hit) return { isHoliday: false, name: null, type: null };
  const arr = Array.isArray(hit) ? hit : [hit];
  const name = arr[0]?.name || arr[0]?.localName || '공휴일';
  return { isHoliday: true, name, type: 'public' };
}

function pad2(n) {
  return String(n).padStart(2, '0');
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
  return clean
    .replace(/\s*예약\s*/g, ' ')
    .replace(/\s*상세보기\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  for (const match of html.matchAll(anchorRe)) {
    push(facilityFromUrl(match[1], match[2]));
  }

  const hrefRe = /(?:href|data-url)=["']([^"']*facility_view\?[^"']*)["']/gi;
  for (const match of html.matchAll(hrefRe)) {
    push(facilityFromUrl(match[1]));
  }

  const bareRe = /sports_facilities\/facility_view\?[^"'<>\\\s)]+/gi;
  for (const match of html.matchAll(bareRe)) {
    push(facilityFromUrl(match[0]));
  }

  return facilities;
}

function extractFacilityListUrls(html) {
  const urls = [];
  const hrefRe = /(?:href|data-url)=["']([^"']*sports_facilities\/facility_list[^"']*)["']/gi;
  for (const match of html.matchAll(hrefRe)) {
    try {
      const url = new URL(htmlDecode(match[1]), BASE_URL);
      if ((url.searchParams.get('ITEM_TYPE') || DEFAULT_ITEM_TYPE) === DEFAULT_ITEM_TYPE) {
        urls.push(url.toString());
      }
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

  const facilities = mergeFacilities([...SEEDED_FACILITIES, ...discovered]);
  facilityCache = {
    facilities,
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

function normalizeArea(area) {
  const value = String(area || '').trim();
  return ULSAN_AREAS.includes(value) ? value : '북구';
}

function normalizeTime(time, hours = 1) {
  const value = String(time || '19:00').trim();
  const match = /^(\d{1,2}):?(\d{2})?$/.exec(value);
  if (!match) return '19:00';
  const maxStart = Math.max(5, 24 - hours);
  const hour = Math.max(5, Math.min(maxStart, Number(match[1])));
  return `${pad2(hour)}:00`;
}

function normalizeHours(hours) {
  const value = Number(hours || 2);
  if (!Number.isFinite(value)) return 2;
  return Math.max(1, Math.min(4, Math.trunc(value)));
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

export async function fetchUlsanFacilities() {
  return loadFacilityCatalog();
}

/**
 * @param {string} dateISO - YYYY-MM-DD
 * @param {string} facilityId
 */
export async function fetchUlsanFacilitySlots(dateISO, facilityId = DEFAULT_FACILITY_ID) {
  const selDate = isoToSelDate(dateISO);
  const facility = await resolveFacility(facilityId);
  const holiday = holidayInfo(dateISO);

  const res = await postExplodeTime(selDate, facility);

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
      msg: res?.msg || ''
    };
  }

  const bookedHours = new Set(
    String(res.hhhlist || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n))
  );

  const slots = makeSlots(bookedHours);
  const allBooked = slots.length > 0 && slots.every((s) => s.status === 'BOOKED');

  return {
    facility: facility.id,
    facilityName: facility.name,
    facilityInfo: facility,
    date: dateISO,
    sourceUrl: facilitySourceUrl(facility),
    slots,
    rawRowCount: slots.length,
    holiday,
    allBooked,
    bookedHoursCount: bookedHours.size,
    availableHoursCount: slots.filter((slot) => slot.status === 'AVAILABLE').length,
    msg: res?.msg || ''
  };
}

/**
 * @param {{ area?:string, dateISO:string, startTime?:string, hours?:number, limit?:number }} options
 */
export async function recommendSoccerFacilities(options) {
  const area = normalizeArea(options.area);
  const hours = normalizeHours(options.hours);
  const startTime = normalizeTime(options.startTime, hours);
  const targetHours = requestedHours(startTime, hours);
  const limit = Math.max(1, Math.min(30, Number(options.limit || 12)));
  const catalog = await loadFacilityCatalog();
  const rankedAreas = NEARBY_AREAS[area] || NEARBY_AREAS.북구;
  const candidates = catalog.facilities
    .filter((facility) => !facility.area || rankedAreas.includes(facility.area))
    .sort((a, b) => areaRank(area, a.area) - areaRank(area, b.area));

  const results = [];
  for (const facility of candidates.slice(0, limit)) {
    try {
      const data = await fetchUlsanFacilitySlots(options.dateISO, facility.id);
      const score = recommendationScore(data.slots, targetHours);
      results.push({
        facility,
        date: options.dateISO,
        startTime,
        hours,
        areaRank: areaRank(area, facility.area),
        sourceUrl: data.sourceUrl,
        error: data.error || null,
        ...score
      });
    } catch (error) {
      results.push({
        facility,
        date: options.dateISO,
        startTime,
        hours,
        areaRank: areaRank(area, facility.area),
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
    area,
    date: options.dateISO,
    startTime,
    hours,
    requestedHours: targetHours,
    facilitiesChecked: results.length,
    results,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchDalcheonSoccerSlots(dateISO) {
  return fetchUlsanFacilitySlots(dateISO, DEFAULT_FACILITY_ID);
}
