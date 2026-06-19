const BASE_URL = 'https://crs.ubimc.or.kr';
const AJAX_URL = `${BASE_URL}/yeyak/ajxAgent/ajxRsvExplodTime`;
const DEFAULT_FACILITY_ID = 'T0000037';
const DEFAULT_ITEM_TYPE = 'I';
const DEFAULT_MEM_ID = 'B0001016';
const CACHE_TTL_MS = 5 * 60 * 1000;
const FACILITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ULSAN_AREAS = ['중구', '남구', '동구', '북구', '울주군'];
const NEARBY_AREAS = {
  중구: ['중구', '남구', '북구', '동구', '울주군'],
  남구: ['남구', '중구', '울주군', '동구', '북구'],
  동구: ['동구', '북구', '남구', '중구', '울주군'],
  북구: ['북구', '중구', '동구', '울주군', '남구'],
  울주군: ['울주군', '남구', '북구', '중구', '동구']
};
const SOCCER_KEYWORDS = ['축구', '풋살', '인조잔디', '다목적구장'];
const NON_SOCCER_KEYWORDS = ['야구', '테니스', '배드민턴', '농구', '족구', '게이트볼', '수영', '탁구'];
const OFFICIAL_FACILITIES = {
  T0000064: { place: '효문운동장', itemName: '인조잔디축구장', area: '북구', memId: 'B0001023' },
  T0000037: { place: '달천운동장', itemName: '인조잔디축구장', area: '북구', memId: 'B0001016' },
  T0000046: { place: '염포운동장', itemName: '인조잔디축구장', area: '북구', memId: 'B0001018' },
  T0000044: { place: '양정생활체육공원', itemName: '인조잔디축구장', area: '북구', memId: 'B0001017' },
  T0000033: { place: '농소운동장', itemName: '인조잔디축구장(A)', area: '북구', memId: 'B0001015' },
  T0000034: { place: '농소운동장', itemName: '인조잔디축구장(B)', area: '북구', memId: 'B0001015' },
  T0000040: { place: '상안다목적구장', itemName: '다목적구장', area: '북구', memId: 'B0001013' },
  T0000039: { place: '명촌다목적구장', itemName: '다목적구장', area: '북구', memId: 'B0001012' },
  T0000058: { place: '화봉다목적구장', itemName: '다목적구장', area: '북구', memId: 'B0001021' },
  T0000059: { place: '효문다목적구장', itemName: '다목적구장', area: '북구', memId: 'B0001022' },
  T0000032: { place: '가람다목적구장', itemName: '다목적구장', area: '북구', memId: 'B0001011' },
  T0000056: { place: '중산다목적구장', itemName: '다목적구장', area: '북구', memId: 'B0001020' },
  T0000042: { place: '송정다목적구장', itemName: '다목적구장', area: '북구', memId: 'B0001014' }
};
const NON_SOCCER_ITEM_IDS = new Set(['T0000047', 'T0000048', 'T0000049', 'T0000050', 'T0000051', 'T0000053']);
const SEEDED_FACILITIES = [facilityFromOfficial(DEFAULT_FACILITY_ID)];
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

export default {
  async fetch(request) {
    try {
      return await route(request);
    } catch (error) {
      return json({ error: 'InternalServerError', message: error.message || String(error) }, 500);
    }
  }
};

async function route(request) {
  const url = new URL(request.url);
  if (url.pathname === '/health') return json({ ok: true });
  if (url.pathname === '/api/ulsan/facilities') return json(await loadFacilityCatalog());
  if (url.pathname === '/api/ulsan/sports' || url.pathname === '/api/dalcheon/soccer') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    const facilityId = url.pathname === '/api/dalcheon/soccer' ? DEFAULT_FACILITY_ID : url.searchParams.get('facilityId');
    return json(await cached(`slots:${facilityId || DEFAULT_FACILITY_ID}:${date}`, () => fetchFacilitySlots(date, facilityId)));
  }
  if (url.pathname === '/api/ulsan/soccer/recommendations') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    const area = url.searchParams.get('area') || '북구';
    const startTime = url.searchParams.get('start') || url.searchParams.get('startTime') || '19:00';
    const hours = Number(url.searchParams.get('hours') || 2);
    return json(await cached(`recommend:${area}:${date}:${startTime}:${hours}`, () => recommendSoccerFacilities({ area, dateISO: date, startTime, hours })));
  }
  if (url.pathname === '/' || url.pathname === '/index.html') return html(APP_HTML);
  return json({ error: 'NotFound' }, 404);
}

async function requestText(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'Content-Type': init.body ? 'application/x-www-form-urlencoded; charset=UTF-8' : undefined,
      Referer: init.referer,
      ...init.headers
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function postExplodeTime(selDate, facility) {
  const body = new URLSearchParams({ selDate, item_id: facility.itemId }).toString();
  return JSON.parse(await requestText(AJAX_URL, { method: 'POST', body, referer: facilitySourceUrl(facility) }));
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
  for (const area of ULSAN_AREAS) if (String(name).includes(area)) return area;
  return '';
}

function isSoccerFacility(facility) {
  if (NON_SOCCER_ITEM_IDS.has(facility.itemId || facility.id)) return false;
  const text = `${facility.name || ''} ${facility.shortName || ''} ${facility.place || ''} ${facility.itemName || ''}`.replace(/\s+/g, '');
  if (!text) return false;
  if (NON_SOCCER_KEYWORDS.some((keyword) => text.includes(keyword))) return false;
  return SOCCER_KEYWORDS.some((keyword) => text.includes(keyword));
}

function shortFacilityName(name, itemId) {
  const clean = cleanText(name);
  if (!clean) return `울산 축구장 ${itemId}`;
  const normalized = clean
    .replace(/\s*예약\s*하기\s*/g, ' ')
    .replace(/\s*예약\s*/g, ' ')
    .replace(/\s*상세\s*보기\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || `울산 축구장 ${itemId}`;
}

function isGenericFacilityName(name, itemId) {
  const clean = cleanText(name);
  return !clean || clean === `울산 축구장 ${itemId}` || /^울산\s*축구장\s*T\d+$/i.test(clean);
}

function composeFacilityName(place, itemName, itemId) {
  const placeName = cleanText(place);
  const cleanItem = shortFacilityName(itemName, itemId);
  if (!placeName) return cleanItem;
  if (isGenericFacilityName(cleanItem, itemId)) return placeName;
  if (placeName.includes(cleanItem)) return placeName;
  if (cleanItem.includes(placeName)) return cleanItem;
  return `${placeName} ${cleanItem}`;
}

function officialSourceUrl(itemId, itemType = DEFAULT_ITEM_TYPE, memId = DEFAULT_MEM_ID) {
  const params = new URLSearchParams({
    ITEM_TYPE: itemType,
    selItemKind: '',
    mem_id: memId,
    item_id: itemId
  });
  return `${BASE_URL}/yeyak/sports_facilities/facility_view?${params.toString()}`;
}

function facilityFromOfficial(itemId, overrides = {}) {
  const official = OFFICIAL_FACILITIES[itemId] || {};
  const itemType = overrides.itemType || DEFAULT_ITEM_TYPE;
  const memId = overrides.memId || official.memId || DEFAULT_MEM_ID;
  const itemName = overrides.itemName || official.itemName || shortFacilityName(overrides.label || '', itemId);
  const place = overrides.place || official.place || '';
  const name = composeFacilityName(place, itemName, itemId);
  return {
    id: itemId,
    itemId,
    name,
    shortName: name,
    place,
    itemName: isGenericFacilityName(itemName, itemId) ? '' : itemName,
    area: overrides.area || official.area || inferArea(name),
    itemType,
    memId,
    sourceUrl: overrides.sourceUrl || officialSourceUrl(itemId, itemType, memId)
  };
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

function facilityFromUrl(rawUrl, label = '', baseUrl = BASE_URL, place = '') {
  try {
    let href = htmlDecode(rawUrl).trim();
    if (/^sports_facilities\//i.test(href)) href = `/yeyak/${href}`;
    const url = new URL(href, baseUrl);
    const itemId = url.searchParams.get('item_id');
    if (!itemId || !/^T\d+$/i.test(itemId)) return null;
    const parsedItemName = shortFacilityName(label, itemId);
    const itemName = isGenericFacilityName(parsedItemName, itemId) ? '' : parsedItemName;
    return facilityFromOfficial(itemId, {
      itemType: url.searchParams.get('ITEM_TYPE') || DEFAULT_ITEM_TYPE,
      memId: url.searchParams.get('mem_id') || undefined,
      itemName,
      place: cleanText(place),
      sourceUrl: url.toString()
    });
  } catch {
    return null;
  }
}

function extractFacilities(source, baseUrl = BASE_URL) {
  const facilities = [];
  const push = (facility) => { if (facility) facilities.push(facility); };
  const rowRe = /<tr\b[\s\S]*?<\/tr>/gi;
  for (const rowMatch of source.matchAll(rowRe)) {
    const row = rowMatch[0];
    if (!row.includes('facility_view')) continue;
    const nameLinkRe = /<td[^>]*class=["'][^"']*name[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']*facility_view\?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i;
    const link = nameLinkRe.exec(row) || /<a\b[^>]*href=["']([^"']*facility_view\?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i.exec(row);
    const placeMatch = /<td[^>]*class=["'][^"']*place[^"']*["'][^>]*>([\s\S]*?)<\/td>/i.exec(row);
    if (link) push(facilityFromUrl(link[1], link[2], baseUrl, placeMatch?.[1] || ''));
  }
  const anchorRe = /<a\b[^>]*href=["']([^"']*facility_view\?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of source.matchAll(anchorRe)) push(facilityFromUrl(match[1], match[2], baseUrl));
  const hrefRe = /(?:href|data-url)=["']([^"']*facility_view\?[^"']*)["']/gi;
  for (const match of source.matchAll(hrefRe)) push(facilityFromUrl(match[1], '', baseUrl));
  const bareRe = /sports_facilities\/facility_view\?[^"'<>\\\s)]+/gi;
  for (const match of source.matchAll(bareRe)) push(facilityFromUrl(match[0], '', baseUrl));
  return facilities;
}

function extractFacilityListUrls(source, baseUrl = BASE_URL) {
  const urls = [];
  const hrefRe = /(?:href|data-url)=["']([^"']*sports_facilities\/facility_list[^"']*)["']/gi;
  for (const match of source.matchAll(hrefRe)) {
    try {
      const url = new URL(htmlDecode(match[1]), baseUrl);
      if ((url.searchParams.get('ITEM_TYPE') || DEFAULT_ITEM_TYPE) === DEFAULT_ITEM_TYPE) urls.push(url.toString());
    } catch {
      // ignore malformed links
    }
  }
  return urls;
}

function preferredText(next, previous, itemId) {
  const nextValue = cleanText(next || '');
  const previousValue = cleanText(previous || '');
  if (!nextValue) return previousValue;
  if (!previousValue) return nextValue;
  const nextGeneric = isGenericFacilityName(nextValue, itemId);
  const previousGeneric = isGenericFacilityName(previousValue, itemId);
  if (nextGeneric && !previousGeneric) return previousValue;
  if (!nextGeneric && previousGeneric) return nextValue;
  return nextValue.length >= previousValue.length ? nextValue : previousValue;
}

function mergeFacilities(facilities) {
  const byId = new Map();
  for (const facility of facilities) {
    if (!facility?.itemId) continue;
    const previous = byId.get(facility.itemId);
    const name = preferredText(facility.name, previous?.name, facility.itemId) || `울산 축구장 ${facility.itemId}`;
    const shortName = preferredText(facility.shortName, previous?.shortName, facility.itemId) || name;
    const place = preferredText(facility.place, previous?.place, facility.itemId);
    const itemName = preferredText(facility.itemName, previous?.itemName, facility.itemId);
    byId.set(facility.itemId, {
      ...(previous || {}),
      ...facility,
      id: facility.itemId,
      name,
      shortName,
      place,
      itemName,
      area: facility.area || previous?.area || OFFICIAL_FACILITIES[facility.itemId]?.area || inferArea(name)
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
      const source = await requestText(url);
      discovered.push(...extractFacilities(source, url));
      for (const nextUrl of extractFacilityListUrls(source, url)) {
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
  const d = new Date(`${s}T00:00:00`);
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
  const official = facilityFromOfficial(id);
  if (official && OFFICIAL_FACILITIES[id]) return official;
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
    return String(a.facility.shortName || a.facility.name).localeCompare(String(b.facility.shortName || b.facility.name), 'ko-KR');
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

function cached(key, loader) {
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.value);
  return Promise.resolve(loader()).then((value) => {
    responseCache.set(key, { expiresAt: now + CACHE_TTL_MS, value });
    return value;
  });
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function html(value) {
  return new Response(value, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

const APP_HTML = String.raw`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f5f7fb">
  <title>울산 축구장 예약 확인</title>
  <style>
    :root{color-scheme:light;--bg:#f5f7fb;--surface:#fff;--soft:#f1f5f9;--line:#d8e0eb;--lineStrong:#aebbd0;--text:#172033;--muted:#66758a;--blue:#1f66e5;--blueSoft:#e9f0ff;--green:#118252;--greenSoft:#e8f7ef;--red:#bd3c3c;--redSoft:#fff1f1;--amber:#98670f;--amberSoft:#fff7df}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:0}
    button,input,select{font:inherit} button{cursor:pointer}.app{max-width:980px;margin:0 auto;padding:18px 14px 34px}.top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
    h1{margin:0;font-size:28px;line-height:1.1}.eyebrow{margin:0 0 6px;color:var(--blue);font-size:12px;font-weight:950}.sub{margin:6px 0 0;color:var(--muted);font-size:14px;font-weight:800}.surface{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px;box-shadow:0 8px 24px rgba(18,31,54,.06)}
    .sectionHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.sectionTitle{font-size:16px;font-weight:950}.label{display:block;margin-bottom:7px;color:var(--muted);font-size:13px;font-weight:900}.selectRow,.dateLine{display:flex;gap:10px;align-items:end}.grow{flex:1}.input,select{width:100%;min-width:0;border:1px solid var(--lineStrong);background:#fff;color:var(--text);border-radius:8px;padding:12px 13px;font-weight:850}
    .tool,.btn{min-height:46px;border:1px solid var(--lineStrong);background:#fff;color:var(--text);border-radius:8px;padding:0 14px;font-weight:950}.tool{width:48px;padding:0;font-size:22px}.btn.primary{border-color:#1f66e5;background:var(--blue);color:#fff}.btn.subtle{background:var(--soft)}.favorite.active,.miniStar{border-color:#d49b16;color:#a16207;background:var(--amberSoft)}
    .favRail{display:flex;gap:8px;overflow:auto;margin:10px 0}.favRail:empty{display:none}.chip{white-space:nowrap;background:var(--amberSoft);border-color:#e9c86e;color:#73510d}
    .facilityList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:318px;overflow:auto;padding-right:2px}.facilityItem{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:70px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:10px 11px;text-align:left;color:var(--text)}.facilityItem.selected{border-color:#1f66e5;background:var(--blueSoft)}.facilityText{min-width:0}.facilityText b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.facilityText small{display:block;margin-top:4px;color:var(--muted);font-size:12px;font-weight:800}.miniStar{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;font-size:16px;flex:0 0 auto}.empty{border:1px dashed var(--lineStrong);border-radius:8px;padding:16px;text-align:center;color:var(--muted);font-weight:850}
    .quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.message{margin-top:10px;border-radius:8px;padding:11px 12px;font-weight:900}.message.wait{background:var(--amberSoft);border:1px solid #ead28b;color:var(--amber)}.message.error{background:var(--redSoft);border:1px solid #f0b9b9;color:var(--red)}
    .summary{display:grid;grid-template-columns:1.3fr repeat(2,minmax(110px,.5fr));gap:10px}.stat{border:1px solid var(--line);border-radius:8px;padding:12px;background:var(--soft)}.stat b{display:block;font-size:24px}.stat span{display:block;color:var(--muted);font-size:13px;font-weight:900}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.block{border:1px solid var(--line);border-radius:8px;padding:12px;background:#fff}.block b{display:block;font-size:16px}.block .meta{margin-top:5px}.okPanel{border-color:#93d7b6;background:var(--greenSoft)}.badPanel{border-color:#e8a1a1;background:var(--redSoft)}
    .meta{display:block;color:var(--muted);font-size:13px;font-weight:850}.grid{display:grid;grid-template-columns:1fr 1.2fr 1fr .8fr;gap:10px}.recList{display:flex;flex-direction:column;gap:8px;margin-top:12px}.rec{display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;border:1px solid var(--line);background:#fff;border-radius:8px;padding:9px}.rec.best{border-color:#74c79d;background:var(--greenSoft)}.recMain{background:transparent;border:0;color:var(--text);text-align:left;padding:0}.pill{border:1px solid #e6c161;background:var(--amberSoft);color:#76520a;padding:7px 10px;border-radius:8px;font-size:13px;font-weight:950;white-space:nowrap}.pill.good{border-color:#6fc99b;background:#dff5ea;color:#0d6840}.made{margin:26px 0 7px;text-align:center;font-weight:950}.footer{text-align:center;color:var(--muted);font-size:14px}.footer a{color:var(--blue);text-decoration:none;font-weight:850}
    @media(max-width:760px){.facilityList,.split,.summary{grid-template-columns:1fr}.grid{grid-template-columns:1fr 1fr}.quick{grid-template-columns:1fr 1fr}.rec{grid-template-columns:48px 1fr}.pill{grid-column:2;justify-self:start}}@media(max-width:520px){.top,.sectionHead,.selectRow,.dateLine{align-items:stretch;flex-direction:column}.tool{width:100%}h1{font-size:24px}.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
<div class="app">
  <header class="top">
    <div><p class="eyebrow">ULSAN FOOTBALL</p><h1>울산 축구장 예약</h1><p class="sub" id="subtitle">운동장 불러오는 중</p></div>
    <button class="tool" id="refresh" title="새로고침" aria-label="새로고침">↻</button>
  </header>
  <section class="surface">
    <div class="sectionHead"><div><div class="sectionTitle">운동장 선택</div><p class="sub">실제 울산 공공예약 시설명 기준</p></div><button class="tool favorite" id="favorite" title="즐겨찾기" aria-label="즐겨찾기">☆</button></div>
    <label class="grow"><span class="label">검색</span><input class="input" id="facilitySearch" type="search" placeholder="달천, 농소, 효문..." autocomplete="off"></label>
    <div class="favRail" id="favorites"></div>
    <div class="facilityList" id="facilityList"></div>
  </section>
  <section class="surface">
    <div class="dateLine"><button class="btn subtle" id="prev">‹ 이전</button><input class="input" id="date" type="date"><button class="btn subtle" id="next">다음 ›</button></div>
    <div class="quick"><button class="btn" data-quick="0">오늘</button><button class="btn" data-quick="1">내일</button><button class="btn" data-weekday="6">토요일</button><button class="btn" data-weekday="0">일요일</button></div>
    <div id="topMessage"></div>
  </section>
  <main id="timeline"></main>
  <section class="surface">
    <div class="sectionHead"><div><div class="sectionTitle">주변 추천</div><p class="sub">선택한 시간에 비어있는 운동장 우선</p></div><button class="btn primary" id="recommendBtn">추천 보기</button></div>
    <div class="grid">
      <label><span class="label">지역</span><select id="area"></select></label>
      <label><span class="label">날짜</span><input class="input" id="recDate" type="date"></label>
      <label><span class="label">시작</span><select id="start"></select></label>
      <label><span class="label">시간</span><select id="hours"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
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
function escapeHtml(value){return String(value ?? '').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function iso(d){return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')}
function displayName(f){return !f ? '달천운동장 인조잔디축구장' : (f.name || f.shortName || f.id)}
function detailName(f){if(!f)return '북구 · 인조잔디축구장'; const bits=[]; if(f.area)bits.push(f.area); if(f.itemName)bits.push(f.itemName); bits.push(f.id); return bits.join(' · ')}
function ampm(t){const h=Number(String(t).slice(0,2)); const m=String(t).slice(3,5); const p=h>=12?'오후':'오전'; let h12=h%12; if(!h12) h12=12; return p + ' ' + h12 + ':' + m}
function group(slots,status){const out=[];let cur=null;(slots||[]).forEach(s=>{if(s.status===status){if(!cur)cur={start:s.start,end:s.end,hours:1};else if(cur.end===s.start){cur.end=s.end;cur.hours++}else{out.push(cur);cur={start:s.start,end:s.end,hours:1}}}else if(cur){out.push(cur);cur=null}});if(cur)out.push(cur);return out}
function saveFav(){localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))}
function setMessage(kind,text){$('topMessage').innerHTML=text?'<div class="message '+kind+'">'+escapeHtml(text)+'</div>':''}
function renderFacilities(){const query=$('facilitySearch').value.trim().toLowerCase(); const sorted=[...facilities].sort((a,b)=>{const af=favorites.includes(a.id),bf=favorites.includes(b.id); if(af!==bf)return af?-1:1; return displayName(a).localeCompare(displayName(b),'ko-KR')}); const visible=sorted.filter(f=>(displayName(f)+' '+detailName(f)).toLowerCase().includes(query)); const sf=facilities.find(f=>f.id===selected); $('subtitle').textContent=displayName(sf); $('favorite').textContent=favorites.includes(selected)?'★':'☆'; $('favorite').className=favorites.includes(selected)?'tool favorite active':'tool favorite'; $('favorites').innerHTML=favorites.map(id=>facilities.find(f=>f.id===id)).filter(Boolean).map(f=>'<button class="btn chip" data-fav="'+escapeHtml(f.id)+'">'+escapeHtml(displayName(f))+'</button>').join(''); $('facilityList').innerHTML=visible.length?visible.map(f=>'<button type="button" class="facilityItem '+(f.id===selected?'selected':'')+'" data-facility="'+escapeHtml(f.id)+'"><span class="facilityText"><b>'+escapeHtml(displayName(f))+'</b><small>'+escapeHtml(detailName(f))+'</small></span><span class="miniStar">'+(favorites.includes(f.id)?'★':'')+'</span></button>').join(''):'<div class="empty">검색 결과가 없습니다</div>'}
function blockHtml(blocks,tone,emptyTitle,emptySub,meta){if(!blocks.length)return '<div class="empty"><b>'+escapeHtml(emptyTitle)+'</b><span class="meta">'+escapeHtml(emptySub)+'</span></div>';return '<div class="blocks">'+blocks.map(b=>'<div class="block '+tone+'"><b>'+ampm(b.start)+' ~ '+ampm(b.end)+'</b><span class="meta">'+b.hours+'시간 '+meta+'</span></div>').join('')+'</div>'}
function renderTimeline(){if(!currentData)return; $('source').href=currentData.sourceUrl||'https://crs.ubimc.or.kr/yeyak'; if(currentData.error){$('timeline').innerHTML='<section class="surface badPanel"><div class="sectionTitle">조회 불가</div><p class="sub">'+escapeHtml(currentData.error)+'</p></section>';return} const av=group(currentData.slots,'AVAILABLE'), bk=group(currentData.slots,'BOOKED'); const name=displayName(currentData.facilityInfo); $('timeline').innerHTML='<section class="surface"><div class="summary"><div class="stat"><span>선택 운동장</span><b>'+escapeHtml(name)+'</b><span>'+escapeHtml(currentData.date)+'</span></div><div class="stat"><span>가능</span><b>'+av.length+'</b><span>연속 시간대</span></div><div class="stat"><span>예약됨</span><b>'+bk.length+'</b><span>연속 시간대</span></div></div></section><div class="split"><section class="surface okPanel"><div class="sectionHead"><div class="sectionTitle">가능한 시간</div></div>'+blockHtml(av,'okPanel','가능 시간 없음','이 날짜는 예약 가능한 시간이 보이지 않아요','가능')+'</section><section class="surface badPanel"><div class="sectionHead"><div class="sectionTitle">예약된 시간</div></div>'+blockHtml(bk,'badPanel','예약 없음','표시된 운영 시간은 모두 사용 가능','예약')+'</section></div>'}
async function loadFacilities(){try{const r=await fetch('/api/ulsan/facilities'); const j=await r.json(); facilities=j.facilities||[]; const preferred=favorites.find(id=>facilities.some(f=>f.id===id)); if(!facilities.some(f=>f.id===selected))selected=preferred||(facilities[0]&&facilities[0].id)||selected; renderFacilities()}catch(e){setMessage('wait','축구장 목록은 기본값으로 표시 중입니다.'); facilities=[{id:'T0000037',name:'달천운동장 인조잔디축구장',shortName:'달천운동장 인조잔디축구장',area:'북구',itemName:'인조잔디축구장'}]; renderFacilities()}}
async function loadSlots(){try{setMessage('wait','예약 정보를 불러오는 중입니다.'); const qs=new URLSearchParams({date:$('date').value,facilityId:selected}); const r=await fetch('/api/ulsan/sports?'+qs); currentData=await r.json(); setMessage('',''); renderFacilities(); renderTimeline()}catch(e){setMessage('error',e.message)}}
function updateStartOptions(){const h=Number($('hours').value||2); const max=24-h; $('start').innerHTML=''; for(let i=5;i<=max;i++){const t=String(i).padStart(2,'0')+':00'; const o=document.createElement('option'); o.value=t; o.textContent=ampm(t); $('start').appendChild(o)} if(!$('start').value)$('start').value='19:00'}
function resultLabel(r){if(r.error)return '조회 실패'; if(r.isFullyAvailable)return '예약 없음'; if(r.bookedSlots===r.requestedSlots)return '전부 예약'; return r.availableSlots+'/'+r.requestedSlots+'시간 가능'}
async function loadRecommendations(){try{$('recommendations').innerHTML='<div class="message wait">추천 조회 중입니다.</div>'; const qs=new URLSearchParams({area:$('area').value,date:$('recDate').value,start:$('start').value,hours:$('hours').value}); const r=await fetch('/api/ulsan/soccer/recommendations?'+qs); const j=await r.json(); $('recommendations').innerHTML='<div class="recList">'+(j.results||[]).map(x=>'<article class="rec '+(x.isFullyAvailable?'best':'')+'"><button class="tool favorite '+(favorites.includes(x.facility.id)?'active':'')+'" data-star="'+escapeHtml(x.facility.id)+'">'+(favorites.includes(x.facility.id)?'★':'☆')+'</button><button class="recMain" data-pick="'+escapeHtml(x.facility.id)+'"><b>'+escapeHtml(displayName(x.facility))+'</b><span class="meta">'+escapeHtml(detailName(x.facility))+' · '+ampm(j.startTime)+'부터 '+j.hours+'시간 · '+resultLabel(x)+'</span></button><span class="pill '+(x.isFullyAvailable?'good':'')+'">'+(x.isFullyAvailable?'추천':resultLabel(x))+'</span></article>').join('')+'</div>'}catch(e){$('recommendations').innerHTML='<div class="message error">'+escapeHtml(e.message)+'</div>'}}
$('date').value=iso(new Date()); $('recDate').value=$('date').value; AREAS.forEach(a=>{$('area').append(new Option(a,a))}); $('area').value='북구'; updateStartOptions(); $('start').value='19:00';
$('facilitySearch').oninput=renderFacilities; $('facilityList').onclick=(e)=>{const btn=e.target.closest('[data-facility]'); if(btn){selected=btn.dataset.facility; $('facilitySearch').value=''; loadSlots()}}; $('favorite').onclick=()=>{favorites=favorites.includes(selected)?favorites.filter(x=>x!==selected):[selected,...favorites]; saveFav(); renderFacilities()};
$('favorites').onclick=(e)=>{const id=e.target.closest('[data-fav]')?.dataset.fav; if(id){selected=id; loadSlots()}}; $('prev').onclick=()=>{const d=new Date($('date').value+'T00:00:00'); d.setDate(d.getDate()-1); $('date').value=iso(d); loadSlots()}; $('next').onclick=()=>{const d=new Date($('date').value+'T00:00:00'); d.setDate(d.getDate()+1); $('date').value=iso(d); loadSlots()}; $('date').onchange=loadSlots; $('refresh').onclick=loadSlots;
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const d=new Date(); d.setDate(d.getDate()+Number(b.dataset.quick)); $('date').value=iso(d); loadSlots()}); document.querySelectorAll('[data-weekday]').forEach(b=>b.onclick=()=>{const d=new Date(); const dow=Number(b.dataset.weekday); const delta=(dow-d.getDay()+7)%7; d.setDate(d.getDate()+delta); $('date').value=iso(d); loadSlots()});
$('hours').onchange=updateStartOptions; $('recommendBtn').onclick=loadRecommendations; $('recommendations').onclick=(e)=>{const star=e.target.dataset.star; const pick=e.target.closest('[data-pick]')?.dataset.pick; if(star){favorites=favorites.includes(star)?favorites.filter(x=>x!==star):[star,...favorites]; saveFav(); renderFacilities(); loadRecommendations()} if(pick){selected=pick; $('date').value=$('recDate').value; loadSlots(); window.scrollTo({top:0,behavior:'smooth'})}};
loadFacilities().then(loadSlots);
</script>
</body>
</html>`;
