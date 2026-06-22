import https from 'node:https';
import Holidays from 'date-holidays';

const DEFAULT_FACILITY_ID = 'junggu:T0000010';
const DALCHEON_FACILITY_ID = 'bukgu:T0000037';
const FACILITY_CACHE_TTL_MS = Number(process.env.FACILITY_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 3000);
const MAX_RECOMMENDATION_CANDIDATES = 12;
const ULSAN_AREAS = ['중구', '남구', '동구', '북구', '울주군'];
const NEARBY_AREAS = {
  중구: ['중구', '남구', '북구', '동구', '울주군'],
  남구: ['남구', '중구', '울주군', '동구', '북구'],
  동구: ['동구', '북구', '남구', '중구', '울주군'],
  북구: ['북구', '중구', '동구', '울주군', '남구'],
  울주군: ['울주군', '남구', '북구', '중구', '동구']
};

const PROVIDERS = {
  bukgu: {
    label: '북구시설관리공단',
    baseUrl: 'https://crs.ubimc.or.kr',
    ajaxPath: '/yeyak/ajxAgent/ajxRsvExplodTime',
    viewPath: '/yeyak/sports_facilities/facility_view',
    itemType: 'I',
    defaultOpen: 5,
    defaultClose: 24
  },
  junggu: {
    label: '중구도시관리공단',
    baseUrl: 'https://crs.ujcmc.or.kr',
    ajaxPath: '/ajxAgent/ajxRsvExplodTime.jsp',
    viewPath: '/sports_facilities/facility_view.jsp',
    defaultOpen: 7,
    defaultClose: 18
  },
  namgu: {
    label: '남구도시관리공단',
    baseUrl: 'https://crs.uncmc.or.kr',
    ajaxPath: '/ajxAgent/ajxRsvExplodTime.jsp',
    viewPath: '/sports_facilities/facility_view.jsp',
    defaultOpen: 6,
    defaultClose: 22
  },
  donggu: {
    label: '동구공공시설예약',
    baseUrl: 'https://crs.donggu.ulsan.kr',
    ajaxPath: '/ajxAgent/ajxRsvExplodTime.jsp',
    viewPath: '/sports_facilities/facility_view.jsp',
    defaultOpen: 6,
    defaultClose: 22
  },
  ulju: {
    label: '울주군시설관리공단',
    baseUrl: 'https://crs.uljusiseol.or.kr',
    ajaxPath: '/ajxAgent/ajxRsvExplodTime',
    viewPath: '/sports_facilities/facility_view',
    itemType: 'I',
    defaultOpen: 5,
    defaultClose: 24
  }
};

const FACILITY_DEFINITIONS = [
  ['bukgu', 'T0000064', '효문운동장 인조잔디축구장', '효문운동장', '인조잔디축구장', '북구', 'B0001023'],
  ['bukgu', 'T0000037', '달천운동장 인조잔디축구장', '달천운동장', '인조잔디축구장', '북구', 'B0001016'],
  ['bukgu', 'T0000046', '염포운동장 인조잔디축구장', '염포운동장', '인조잔디축구장', '북구', 'B0001018'],
  ['bukgu', 'T0000044', '양정생활체육공원 인조잔디축구장', '양정생활체육공원', '인조잔디축구장', '북구', 'B0001017'],
  ['bukgu', 'T0000033', '농소운동장 인조잔디축구장(A)', '농소운동장', '인조잔디축구장(A)', '북구', 'B0001015'],
  ['bukgu', 'T0000034', '농소운동장 인조잔디축구장(B)', '농소운동장', '인조잔디축구장(B)', '북구', 'B0001015'],
  ['bukgu', 'T0000040', '상안다목적구장', '상안다목적구장', '축구장', '북구', 'B0001013'],
  ['bukgu', 'T0000039', '명촌다목적구장', '명촌다목적구장', '축구장', '북구', 'B0001012'],
  ['bukgu', 'T0000058', '화봉다목적구장', '화봉다목적구장', '축구장', '북구', 'B0001021'],
  ['bukgu', 'T0000059', '효문다목적구장', '효문다목적구장', '축구장', '북구', 'B0001022'],
  ['bukgu', 'T0000032', '가람다목적구장', '가람다목적구장', '축구장', '북구', 'B0001011'],
  ['bukgu', 'T0000056', '중산다목적구장', '중산다목적구장', '축구장', '북구', 'B0001020'],
  ['bukgu', 'T0000042', '송정다목적구장', '송정다목적구장', '축구장', '북구', 'B0001014'],
  ['junggu', 'T0000010', '중구다목적구장', '중구다목적구장', '축구장', '중구', 'B0000003', 7, 22],
  ['junggu', 'T0000009', '함월구민운동장', '함월구민운동장', '축구장', '중구', 'B0000003', 7, 18],
  ['junggu', 'T0000007', '십리대밭축구장 인조잔디 B구장', '십리대밭축구장', '인조잔디 B구장', '중구', 'B0000003', 7, 18],
  ['junggu', 'T0000008', '십리대밭축구장 인조잔디 C구장', '십리대밭축구장', '인조잔디 C구장', '중구', 'B0000003', 7, 18],
  ['namgu', 'T0000219', '선암호수공원축구장', '선암호수공원', '축구장', '남구', 'B0000001'],
  ['donggu', 'T0000003', '서부시민운동장 인조잔디구장', '서부시민운동장', '인조잔디축구장', '동구', 'B0000001'],
  ['ulju', 'T0000001', '간절곶인조구장 A', '간절곶스포츠파크', '인조구장 A', '울주군', 'B0000151'],
  ['ulju', 'T0000002', '간절곶인조구장 B', '간절곶스포츠파크', '인조구장 B', '울주군', 'B0000151'],
  ['ulju', 'T0000003', '간절곶천연구장', '간절곶스포츠파크', '천연잔디구장', '울주군', 'B0000151'],
  ['ulju', 'T0000431', '구영운동장', '구영운동장', '축구장', '울주군', 'B0000201'],
  ['ulju', 'T0000013', '대암인조구장', '대암체육공원', '인조구장', '울주군', 'B0000183'],
  ['ulju', 'T0000015', '범서인조구장', '범서생활체육공원', '인조구장', '울주군', 'B0000154'],
  ['ulju', 'T0000018', '삼동인조구장', '삼동면민운동장', '인조구장', '울주군', 'B0000187'],
  ['ulju', 'T0000025', '상북인조구장', '상북면민운동장', '인조구장', '울주군', 'B0000182'],
  ['ulju', 'T0000030', '서생인조구장', '서생체육공원', '인조구장', '울주군', 'B0000152'],
  ['ulju', 'T0000034', '온산인조구장', '온산운동장', '인조구장', '울주군', 'B0000112'],
  ['ulju', 'T0000040', '온양인조구장', '온양체육공원', '인조구장', '울주군', 'B0000181'],
  ['ulju', 'T0000048', '웅촌인조구장', '웅촌운동장', '인조구장', '울주군', 'B0000185'],
  ['ulju', 'T0000051', '작천정운동장', '작천정운동장', '축구장', '울주군', 'B0000190'],
  ['ulju', 'T0000055', '청량인조구장', '청량운동장', '인조구장', '울주군', 'B0000186'],
  ['ulju', 'T0000059', '화랑인조구장', '화랑체육공원', '인조구장', '울주군', 'B0000155']
];

const hd = new Holidays('KR');
let facilityCache = null;
let facilityCacheExpiresAt = 0;

function officialSourceUrl(providerKey, itemId, memId) {
  const provider = PROVIDERS[providerKey];
  const params = new URLSearchParams({ selItemKind: 'FTB', mem_id: memId, item_id: itemId });
  if (provider.itemType) params.set('ITEM_TYPE', provider.itemType);
  return `${provider.baseUrl}${provider.viewPath}?${params.toString()}`;
}

function createFacility(definition) {
  const [provider, itemId, name, place, itemName, area, memId, openHour, closeHour] = definition;
  const providerInfo = PROVIDERS[provider];
  return {
    id: `${provider}:${itemId}`,
    itemId,
    name,
    shortName: name,
    place,
    itemName,
    area,
    memId,
    provider,
    providerName: providerInfo.label,
    openHour: openHour ?? providerInfo.defaultOpen,
    closeHour: closeHour ?? providerInfo.defaultClose,
    sourceUrl: officialSourceUrl(provider, itemId, memId)
  };
}

function loadFacilityCatalog() {
  const now = Date.now();
  if (facilityCache && facilityCacheExpiresAt > now) return facilityCache;
  const facilities = FACILITY_DEFINITIONS.map(createFacility).sort((a, b) => {
    const areaOrder = ULSAN_AREAS.indexOf(a.area) - ULSAN_AREAS.indexOf(b.area);
    return areaOrder || a.name.localeCompare(b.name, 'ko-KR');
  });
  facilityCache = {
    facilities,
    areas: ULSAN_AREAS,
    countsByArea: Object.fromEntries(
      ULSAN_AREAS.map((area) => [area, facilities.filter((facility) => facility.area === area).length])
    ),
    sourceUrl: 'https://www.ulsan.go.kr/',
    source: 'official-municipal-reservation-systems',
    scope: '울산광역시 전체',
    filter: 'soccer-only',
    errors: [],
    updatedAt: new Date().toISOString()
  };
  facilityCacheExpiresAt = now + FACILITY_CACHE_TTL_MS;
  return facilityCache;
}

function requestText(urlInput, { body, referer } = {}) {
  const url = new URL(urlInput);
  const headers = {
    Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest'
  };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  if (referer) {
    headers.Referer = referer;
    headers.Origin = new URL(referer).origin;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: body ? 'POST' : 'GET',
        headers,
        rejectUnauthorized: process.env.ULSAN_REJECT_UNAUTHORIZED === '1'
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Upstream HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => req.destroy(new Error('공식 예약 서버 응답 시간 초과')));
    if (body) req.write(body);
    req.end();
  });
}

async function postExplodeTime(dateISO, facility) {
  const provider = PROVIDERS[facility.provider];
  const body = new URLSearchParams({
    selDate: dateISO.replaceAll('-', ''),
    item_id: facility.itemId
  }).toString();
  const endpoint = `${provider.baseUrl}${provider.ajaxPath}`;
  const request = () => facility.provider === 'namgu'
    ? requestText(`${endpoint}?${body}`, { referer: facility.sourceUrl })
    : requestText(endpoint, { body, referer: facility.sourceUrl });
  let source;
  try {
    source = await request();
  } catch (error) {
    if (!/Upstream HTTP 5\d\d/.test(error.message || '')) throw error;
    source = await request();
  }
  const payload = JSON.parse(source);
  return Array.isArray(payload) ? payload[0] || {} : payload;
}

function resolveFacility(facilityId) {
  const requested = String(facilityId || DEFAULT_FACILITY_ID).trim();
  const id = requested === 'dalcheon-soccer' ? DALCHEON_FACILITY_ID : requested;
  const catalog = loadFacilityCatalog();
  const facility = catalog.facilities.find(
    (candidate) => candidate.id === id || (candidate.provider === 'bukgu' && candidate.itemId === id)
  );
  if (!facility) throw new Error(`Unknown facilityId: ${facilityId}`);
  return facility;
}

function holidayInfo(dateISO) {
  const hit = hd.isHoliday(new Date(`${dateISO}T00:00:00`));
  if (!hit) return { isHoliday: false, name: null, type: null };
  const list = Array.isArray(hit) ? hit : [hit];
  return { isHoliday: true, name: list[0]?.name || list[0]?.localName || '공휴일', type: 'public' };
}

function operatingHours(facility, dateISO) {
  if (facility.provider === 'namgu' && facility.itemId === 'T0000219') {
    const month = Number(dateISO.slice(5, 7));
    if ([1, 2, 3, 10, 11, 12].includes(month)) return { openHour: 8, closeHour: 22 };
  }
  return { openHour: facility.openHour, closeHour: facility.closeHour };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function makeSlots(bookedHours, facility, dateISO) {
  const { openHour, closeHour } = operatingHours(facility, dateISO);
  return Array.from({ length: closeHour - openHour }, (_, index) => {
    const hour = openHour + index;
    const booked = bookedHours.has(hour);
    return {
      hour,
      start: `${pad2(hour)}:00`,
      end: `${pad2(hour + 1)}:00`,
      status: booked ? 'BOOKED' : 'AVAILABLE',
      label: booked ? '예약불가' : '예약가능'
    };
  });
}

export async function fetchUlsanFacilities() {
  return loadFacilityCatalog();
}

export async function fetchUlsanFacilitySlots(dateISO, facilityId = DEFAULT_FACILITY_ID) {
  const facility = resolveFacility(facilityId);
  const raw = await postExplodeTime(dateISO, facility);
  const holiday = holidayInfo(dateISO);
  if (raw?.chk_result !== 'OK' && raw?.chk_result !== 'NODATA') {
    return {
      facility: facility.id,
      facilityName: facility.name,
      facilityInfo: facility,
      date: dateISO,
      sourceUrl: facility.sourceUrl,
      slots: [],
      rawRowCount: 0,
      holiday,
      error: raw?.msg || '공식 예약 시스템에서 조회를 제한했습니다.',
      msg: raw?.msg || ''
    };
  }
  const bookedHours = new Set(
    String(raw.hhhlist || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite)
  );
  const slots = makeSlots(bookedHours, facility, dateISO);
  return {
    facility: facility.id,
    facilityName: facility.name,
    facilityInfo: facility,
    date: dateISO,
    sourceUrl: facility.sourceUrl,
    slots,
    rawRowCount: slots.length,
    holiday,
    allBooked: slots.length > 0 && slots.every((slot) => slot.status === 'BOOKED'),
    bookedHoursCount: slots.filter((slot) => slot.status === 'BOOKED').length,
    availableHoursCount: slots.filter((slot) => slot.status === 'AVAILABLE').length,
    msg: raw?.msg || ''
  };
}

function normalizeArea(area) {
  return ULSAN_AREAS.includes(String(area || '').trim()) ? String(area).trim() : '중구';
}

function normalizeHours(hours) {
  const value = Number(hours || 2);
  return Number.isFinite(value) ? Math.max(1, Math.min(4, Math.trunc(value))) : 2;
}

function normalizeTime(time, hours) {
  const match = /^(\d{1,2}):?(\d{2})?$/.exec(String(time || '19:00').trim());
  if (!match) return '19:00';
  return `${pad2(Math.max(5, Math.min(24 - hours, Number(match[1]))))}:00`;
}

function areaRank(selectedArea, facilityArea) {
  const rank = NEARBY_AREAS[selectedArea];
  const index = rank.indexOf(facilityArea);
  return index === -1 ? rank.length : index;
}

function scoreSlots(slots, requestedHours) {
  const requested = slots.filter((slot) => requestedHours.includes(slot.hour));
  const booked = requested.filter((slot) => slot.status === 'BOOKED');
  return {
    requestedHours,
    requestedSlots: requested.length,
    availableSlots: requested.length - booked.length,
    bookedSlots: booked.length,
    isFullyAvailable: requested.length === requestedHours.length && booked.length === 0,
    unavailableSlots: booked.map((slot) => `${slot.start}-${slot.end}`)
  };
}

export async function recommendSoccerFacilities({ area, dateISO, startTime, hours }) {
  const selectedArea = normalizeArea(area);
  const duration = normalizeHours(hours);
  const start = normalizeTime(startTime, duration);
  const firstHour = Number(start.slice(0, 2));
  const requestedHours = Array.from({ length: duration }, (_, index) => firstHour + index);
  const candidates = loadFacilityCatalog().facilities.sort(
    (a, b) => areaRank(selectedArea, a.area) - areaRank(selectedArea, b.area)
  ).slice(0, MAX_RECOMMENDATION_CANDIDATES);
  const results = await Promise.all(
    candidates.map(async (facility) => {
      try {
        const data = await fetchUlsanFacilitySlots(dateISO, facility.id);
        return {
          facility,
          date: dateISO,
          startTime: start,
          hours: duration,
          areaRank: areaRank(selectedArea, facility.area),
          sourceUrl: facility.sourceUrl,
          error: data.error || null,
          ...scoreSlots(data.slots, requestedHours)
        };
      } catch (error) {
        return {
          facility,
          date: dateISO,
          startTime: start,
          hours: duration,
          areaRank: areaRank(selectedArea, facility.area),
          sourceUrl: facility.sourceUrl,
          error: error.message || '조회 실패',
          requestedHours,
          requestedSlots: requestedHours.length,
          availableSlots: 0,
          bookedSlots: requestedHours.length,
          isFullyAvailable: false,
          unavailableSlots: []
        };
      }
    })
  );
  results.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    if (a.isFullyAvailable !== b.isFullyAvailable) return a.isFullyAvailable ? -1 : 1;
    if (a.bookedSlots !== b.bookedSlots) return a.bookedSlots - b.bookedSlots;
    if (a.availableSlots !== b.availableSlots) return b.availableSlots - a.availableSlots;
    if (a.areaRank !== b.areaRank) return a.areaRank - b.areaRank;
    return a.facility.name.localeCompare(b.facility.name, 'ko-KR');
  });
  return {
    area: selectedArea,
    date: dateISO,
    startTime: start,
    hours: duration,
    requestedHours,
    facilitiesChecked: results.length,
    results,
    updatedAt: new Date().toISOString()
  };
}

export async function fetchDalcheonSoccerSlots(dateISO) {
  return fetchUlsanFacilitySlots(dateISO, DALCHEON_FACILITY_ID);
}
