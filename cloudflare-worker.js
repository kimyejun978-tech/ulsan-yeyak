const DEFAULT_FACILITY_ID = 'junggu:T0000010';
const DALCHEON_FACILITY_ID = 'bukgu:T0000037';
const CACHE_TTL_MS = 5 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 3000;
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

const FACILITY_COORDINATES = {
  '효문운동장': [35.5872986, 129.3731082],
  '달천운동장': [35.6289982, 129.3222548],
  '염포운동장': [35.5394205, 129.3975041],
  '양정생활체육공원': [35.54824, 129.39274],
  '농소운동장': [35.6205477, 129.3562325],
  '상안다목적구장': [35.6225792, 129.3374756],
  '명촌다목적구장': [35.5574482, 129.3567733],
  '화봉다목적구장': [35.5907462, 129.3642069],
  '효문다목적구장': [35.57469, 129.37727],
  '가람다목적구장': [35.5907462, 129.3642069],
  '중산다목적구장': [35.66216, 129.35455],
  '송정다목적구장': [35.6019215, 129.3668462],
  '중구다목적구장': [35.5843409, 129.3328581],
  '함월구민운동장': [35.5782325, 129.3065687],
  '십리대밭축구장': [35.5497119, 129.2996875],
  '선암호수공원': [35.5157131, 129.3243602],
  '서부시민운동장': [35.54403, 129.42094],
  '간절곶스포츠파크': [35.3592125, 129.3617851],
  '구영운동장': [35.58165, 129.25035],
  '대암체육공원': [35.519, 129.145],
  '범서생활체육공원': [35.5649476, 129.232909],
  '삼동면민운동장': [35.5035574, 129.1316649],
  '상북면민운동장': [35.5911428, 129.0891958],
  '서생체육공원': [35.3471291, 129.3195815],
  '온산운동장': [35.4396056, 129.3334831],
  '온양체육공원': [35.4270149, 129.2806854],
  '웅촌운동장': [35.4615215, 129.2079772],
  '작천정운동장': [35.5508432, 129.1023035],
  '청량운동장': [35.4930662, 129.3061005],
  '화랑체육공원': [35.6285216, 129.1620225]
};

const SEEDED_FACILITIES = FACILITY_DEFINITIONS.map(
  ([provider, itemId, name, place, itemName, area, memId, openHour, closeHour]) =>
    createFacility({ provider, itemId, name, place, itemName, area, memId, openHour, closeHour })
);
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
  if (url.pathname === '/api/ulsan/facilities') return json(await loadFacilityCatalog(), 200, 3600);
  if (url.pathname === '/api/ulsan/location-search') {
    const query = String(url.searchParams.get('q') || '').trim();
    if (query.length < 2 || query.length > 80) {
      return json({ error: 'BadRequest', message: '장소나 주소를 2자 이상 입력해 주세요.' }, 400);
    }
    return json(await cached(`location:${query.toLowerCase()}`, () => searchUlsanLocations(query)), 200, 300);
  }
  if (url.pathname === '/api/ulsan/sports' || url.pathname === '/api/dalcheon/soccer') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    const facilityId = url.pathname === '/api/dalcheon/soccer' ? DALCHEON_FACILITY_ID : url.searchParams.get('facilityId');
    return json(await cached(`slots:${facilityId || DEFAULT_FACILITY_ID}:${date}`, () => fetchFacilitySlots(date, facilityId)), 200, 30);
  }
  if (url.pathname === '/api/ulsan/soccer/recommendations') {
    const date = normalizeDate(url.searchParams.get('date'));
    if (!date) return json({ error: 'BadRequest', message: 'date must be YYYY-MM-DD' }, 400);
    const area = url.searchParams.get('area') || '중구';
    const startTime = url.searchParams.get('start') || url.searchParams.get('startTime') || '19:00';
    const hours = Number(url.searchParams.get('hours') || 2);
    const latitude = normalizeCoordinate(url.searchParams.get('lat'), -90, 90);
    const longitude = normalizeCoordinate(url.searchParams.get('lng'), -180, 180);
    const locationKey = latitude === null || longitude === null ? area : `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    return json(await cached(`recommend:${locationKey}:${date}:${startTime}:${hours}`, () => recommendSoccerFacilities({ area, dateISO: date, startTime, hours, latitude, longitude })), 200, 30);
  }
  if (url.pathname === '/' || url.pathname === '/index.html') return html(APP_HTML);
  return json({ error: 'NotFound' }, 404);
}

async function requestText(url, init = {}) {
  const headers = {
    Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    ...init.headers
  };
  if (init.body) headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  if (init.referer) {
    headers.Referer = init.referer;
    headers.Origin = new URL(init.referer).origin;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { ...init, headers, signal: init.signal || controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('공식 예약 서버 응답이 늦어 조회를 중단했어요. 잠시 후 다시 시도해 주세요.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function searchUlsanLocations(query) {
  const params = new URLSearchParams({
    q: `${query}, 울산광역시`,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'kr',
    bounded: '1',
    viewbox: '128.95,35.75,129.50,35.30',
    'accept-language': 'ko'
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'User-Agent': 'ulsan-soccer-reservation-checker/1.0 (github.com/kimyejun978-tech/ulsan-yeyak)'
    }
  });
  if (!response.ok) throw new Error('장소 검색 서비스가 잠시 응답하지 않습니다. 잠시 후 다시 시도해 주세요.');
  const items = await response.json();
  return {
    query,
    results: items.map((item) => {
      const address = item.address || {};
      const label = item.name || address.amenity || address.road || address.suburb || String(item.display_name || '').split(',')[0];
      return {
        label,
        detail: item.display_name || label,
        latitude: Number(item.lat),
        longitude: Number(item.lon)
      };
    }).filter((item) => item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
  };
}

async function postExplodeTime(selDate, facility) {
  const provider = PROVIDERS[facility.provider];
  if (!provider) throw new Error(`Unknown provider: ${facility.provider}`);
  const body = new URLSearchParams({ selDate, item_id: facility.itemId }).toString();
  const endpoint = `${provider.baseUrl}${provider.ajaxPath}`;
  const request = () => facility.provider === 'namgu'
    ? requestText(`${endpoint}?${body}`, { referer: facilitySourceUrl(facility) })
    : requestText(endpoint, { method: 'POST', body, referer: facilitySourceUrl(facility) });
  let source;
  try {
    source = await request();
  } catch (error) {
    if (!/Upstream HTTP 5\d\d/.test(error.message || '')) throw error;
    source = await request();
  }
  let payload;
  try {
    payload = JSON.parse(source);
  } catch (error) {
    if (facility.provider !== 'namgu') throw error;
    return {
      chk_result: 'UPSTREAM_BLOCKED',
      hhhlist: '',
      msg: '남구 공식 예약 서버가 외부 자동 조회를 제한하고 있어 공식 사이트에서 확인해 주세요.'
    };
  }
  return Array.isArray(payload) ? payload[0] || {} : payload;
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
  return Boolean(facility?.provider && facility?.itemId && facility?.name && ULSAN_AREAS.includes(facility.area));
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

function officialSourceUrl(providerKey, itemId, memId) {
  const provider = PROVIDERS[providerKey];
  if (!provider) return '#';
  const params = new URLSearchParams({
    selItemKind: 'FTB',
    mem_id: memId,
    item_id: itemId
  });
  if (provider.itemType) params.set('ITEM_TYPE', provider.itemType);
  return `${provider.baseUrl}${provider.viewPath}?${params.toString()}`;
}

function createFacility({ provider, itemId, name, place, itemName, area, memId, openHour, closeHour }) {
  const providerInfo = PROVIDERS[provider];
  const coordinates = FACILITY_COORDINATES[place] || FACILITY_COORDINATES[name] || null;
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
    latitude: coordinates?.[0] ?? null,
    longitude: coordinates?.[1] ?? null,
    sourceUrl: officialSourceUrl(provider, itemId, memId)
  };
}

function facilityFromOfficial(facilityId) {
  return SEEDED_FACILITIES.find(
    (facility) => facility.id === facilityId || (facility.provider === 'bukgu' && facility.itemId === facilityId)
  );
}

function facilitySourceUrl(facility) {
  return facility.sourceUrl || officialSourceUrl(facility.provider, facility.itemId, facility.memId);
}

function facilityFromUrl(rawUrl, label = '', baseUrl = PROVIDERS.bukgu.baseUrl, place = '') {
  try {
    let href = htmlDecode(rawUrl).trim();
    if (/^sports_facilities\//i.test(href)) href = `/yeyak/${href}`;
    const url = new URL(href, baseUrl);
    const itemId = url.searchParams.get('item_id');
    if (!itemId || !/^T\d+$/i.test(itemId)) return null;
    const parsedItemName = shortFacilityName(label, itemId);
    const itemName = isGenericFacilityName(parsedItemName, itemId) ? '' : parsedItemName;
    const provider = Object.entries(PROVIDERS).find(([, value]) => value.baseUrl === url.origin)?.[0] || 'bukgu';
    return createFacility({
      provider,
      itemId,
      name: composeFacilityName(place, itemName, itemId),
      place: cleanText(place),
      itemName,
      area: inferArea(`${label} ${place}`),
      memId: url.searchParams.get('mem_id') || ''
    });
  } catch {
    return null;
  }
}

function extractFacilities(source, baseUrl = PROVIDERS.bukgu.baseUrl) {
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

function extractFacilityListUrls(source, baseUrl = PROVIDERS.bukgu.baseUrl) {
  const urls = [];
  const hrefRe = /(?:href|data-url)=["']([^"']*sports_facilities\/facility_list[^"']*)["']/gi;
  for (const match of source.matchAll(hrefRe)) {
    try {
      const url = new URL(htmlDecode(match[1]), baseUrl);
      if (!url.searchParams.get('ITEM_TYPE') || url.searchParams.get('ITEM_TYPE') === 'I') urls.push(url.toString());
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
    if (!facility?.id) continue;
    const previous = byId.get(facility.id);
    const name = preferredText(facility.name, previous?.name, facility.itemId) || `울산 축구장 ${facility.itemId}`;
    const shortName = preferredText(facility.shortName, previous?.shortName, facility.itemId) || name;
    const place = preferredText(facility.place, previous?.place, facility.itemId);
    const itemName = preferredText(facility.itemName, previous?.itemName, facility.itemId);
    byId.set(facility.id, {
      ...(previous || {}),
      ...facility,
      id: facility.id,
      name,
      shortName,
      place,
      itemName,
      area: facility.area || previous?.area || inferArea(name)
    });
  }
  return [...byId.values()]
    .filter(isSoccerFacility)
    .sort((a, b) => {
      const area = ULSAN_AREAS.indexOf(a.area) - ULSAN_AREAS.indexOf(b.area);
      if (area !== 0) return area;
      return String(a.shortName || a.name).localeCompare(String(b.shortName || b.name), 'ko-KR');
    });
}

async function loadFacilityCatalog() {
  if (facilityCache) return facilityCache;
  const facilities = mergeFacilities(SEEDED_FACILITIES);
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
  if (id === 'dalcheon-soccer') return DALCHEON_FACILITY_ID;
  return id || DEFAULT_FACILITY_ID;
}

async function resolveFacility(facilityId) {
  const id = normalizeFacilityId(facilityId);
  const catalog = await loadFacilityCatalog();
  const known = catalog.facilities.find(
    (facility) => facility.id === id || (facility.provider === 'bukgu' && facility.itemId === id)
  );
  if (known) return known;
  const official = facilityFromOfficial(id);
  if (official) return official;
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

function operatingHours(facility, dateISO) {
  if (facility.provider === 'namgu' && facility.itemId === 'T0000219') {
    const month = Number(String(dateISO).slice(5, 7));
    if ([1, 2, 3, 10, 11, 12].includes(month)) return { openHour: 8, closeHour: 22 };
  }
  return { openHour: facility.openHour, closeHour: facility.closeHour };
}

function makeSlots(bookedHours, facility, dateISO) {
  const slots = [];
  const { openHour, closeHour } = operatingHours(facility, dateISO);
  for (let h = openHour; h < closeHour; h++) {
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
  const slots = makeSlots(bookedHours, facility, dateISO);
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

function normalizeCoordinate(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function distanceKm(latitude, longitude, facility) {
  if (latitude === null || longitude === null || !Number.isFinite(facility.latitude) || !Number.isFinite(facility.longitude)) return null;
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(facility.latitude - latitude);
  const dLng = radians(facility.longitude - longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(facility.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function groupSlotWindows(slots) {
  const windows = [];
  let current = null;
  for (const slot of slots) {
    if (!current || current.end !== slot.start) {
      if (current) windows.push(current);
      current = { start: slot.start, end: slot.end };
    } else {
      current.end = slot.end;
    }
  }
  if (current) windows.push(current);
  return windows;
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
    isFullyAvailable: targetSlots.length === hours.length && bookedSlots.length === 0,
    availableWindows: groupSlotWindows(availableSlots),
    bookedWindows: groupSlotWindows(bookedSlots),
    unavailableSlots: bookedSlots.map((slot) => `${slot.start}-${slot.end}`)
  };
}

function areaRank(selectedArea, facilityArea) {
  const rank = NEARBY_AREAS[selectedArea] || NEARBY_AREAS.북구;
  const index = rank.indexOf(facilityArea);
  return index === -1 ? rank.length : index;
}

async function recommendSoccerFacilities({ area, dateISO, startTime, hours, latitude = null, longitude = null }) {
  const normalizedArea = normalizeArea(area);
  const normalizedHours = normalizeHours(hours);
  const normalizedStart = normalizeTime(startTime, normalizedHours);
  const targetHours = requestedHours(normalizedStart, normalizedHours);
  const catalog = await loadFacilityCatalog();
  const rankedAreas = NEARBY_AREAS[normalizedArea] || NEARBY_AREAS.북구;
  const hasLocation = latitude !== null && longitude !== null;
  const candidates = catalog.facilities
    .filter((facility) => !facility.area || rankedAreas.includes(facility.area))
    .map((facility) => ({ facility, distanceKm: distanceKm(latitude, longitude, facility) }))
    .sort((a, b) => hasLocation
      ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
      : areaRank(normalizedArea, a.facility.area) - areaRank(normalizedArea, b.facility.area))
    .slice(0, MAX_RECOMMENDATION_CANDIDATES);
  const results = await Promise.all(
    candidates.map(async ({ facility, distanceKm: facilityDistance }) => {
      try {
        const data = await cached(`slots:${facility.id}:${dateISO}`, () => fetchFacilitySlots(dateISO, facility.id));
        return {
          facility,
          date: dateISO,
          startTime: normalizedStart,
          hours: normalizedHours,
          areaRank: areaRank(normalizedArea, facility.area),
          distanceKm: facilityDistance,
          sourceUrl: data.sourceUrl,
          error: data.error || null,
          ...recommendationScore(data.slots, targetHours)
        };
      } catch (error) {
        return {
          facility,
          date: dateISO,
          startTime: normalizedStart,
          hours: normalizedHours,
          areaRank: areaRank(normalizedArea, facility.area),
          distanceKm: facilityDistance,
          sourceUrl: facility.sourceUrl,
          error: error.message || '조회 실패',
          requestedHours: targetHours,
          requestedSlots: targetHours.length,
          availableSlots: 0,
          bookedSlots: targetHours.length,
          isFullyAvailable: false,
          availableWindows: [],
          bookedWindows: [],
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
    if ((a.distanceKm ?? Infinity) !== (b.distanceKm ?? Infinity)) return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    if (a.availableSlots !== b.availableSlots) return b.availableSlots - a.availableSlots;
    if (a.areaRank !== b.areaRank) return a.areaRank - b.areaRank;
    return String(a.facility.shortName || a.facility.name).localeCompare(String(b.facility.shortName || b.facility.name), 'ko-KR');
  });
  return {
    area: normalizedArea,
    origin: hasLocation ? { latitude, longitude } : null,
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

function json(value, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge > 0 ? `public, max-age=${maxAge}, stale-while-revalidate=${maxAge}` : 'no-store',
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
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIINfQ3ynkJ2RjMZJdSeXQkzKoXlF0+iqbM=" crossorigin="">
  <style>
    :root{color-scheme:light;--bg:#f5f7fb;--surface:#fff;--soft:#f1f5f9;--line:#d8e0eb;--lineStrong:#aebbd0;--text:#172033;--muted:#66758a;--blue:#1f66e5;--blueSoft:#e9f0ff;--green:#118252;--greenSoft:#e8f7ef;--red:#bd3c3c;--redSoft:#fff1f1;--amber:#98670f;--amberSoft:#fff7df}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:0}
    button,input,select{font:inherit} button{cursor:pointer}.app{max-width:980px;margin:0 auto;padding:18px 14px 34px}.top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}.topActions{display:flex;gap:8px;align-items:center}
    h1{margin:0;font-size:28px;line-height:1.1}.eyebrow{margin:0 0 6px;color:var(--blue);font-size:12px;font-weight:950}.sub{margin:6px 0 0;color:var(--muted);font-size:14px;font-weight:800}.surface{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px;box-shadow:0 8px 24px rgba(18,31,54,.06)}
    .sectionHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.sectionTitle{font-size:16px;font-weight:950}.label{display:block;margin-bottom:7px;color:var(--muted);font-size:13px;font-weight:900}.selectRow,.dateLine{display:flex;gap:10px;align-items:center}.dateInputWrap{min-width:0;flex:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.dateBadge{border:1px solid #6fc99b;background:var(--greenSoft);color:#0d6840;border-radius:8px;padding:10px 12px;font-size:13px;font-weight:950;white-space:nowrap}.dateBadge:empty{display:none}.filterLine{display:grid;grid-template-columns:180px minmax(0,1fr);gap:10px;align-items:end}.grow{flex:1}.input,select{width:100%;min-width:0;border:1px solid var(--lineStrong);background:#fff;color:var(--text);border-radius:8px;padding:12px 13px;font-weight:850}
    .tool,.btn{min-height:46px;border:1px solid var(--lineStrong);background:#fff;color:var(--text);border-radius:8px;padding:0 14px;font-weight:950}.tool{width:48px;padding:0;font-size:22px}.btn.primary{border-color:#1f66e5;background:var(--blue);color:#fff}.btn.subtle{background:var(--soft)}.favorite.active,.miniStar.active{border-color:#d49b16;color:#a16207;background:var(--amberSoft)}
    .favRail{display:flex;gap:8px;overflow:auto;margin:10px 0}.favRail:empty{display:none}.chip{white-space:nowrap;background:var(--amberSoft);border-color:#e9c86e;color:#73510d}
    .facilityList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:318px;overflow:auto;padding-right:2px}.facilityItem{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:70px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 9px;color:var(--text)}.facilityItem.selected{border-color:#1f66e5;background:var(--blueSoft)}.facilityMain{min-width:0;flex:1;border:0;background:transparent;padding:2px;text-align:left;color:var(--text)}.facilityMain:focus-visible,.miniStar:focus-visible{outline:3px solid rgba(31,102,229,.25);outline-offset:2px}.facilityText{min-width:0}.facilityText b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.facilityText small{display:block;margin-top:4px;color:var(--muted);font-size:12px;font-weight:800}.miniStar{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:8px;font-size:20px;flex:0 0 auto}.empty{border:1px dashed var(--lineStrong);border-radius:8px;padding:16px;text-align:center;color:var(--muted);font-weight:850}
    .quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.quick .active{border-color:#1f66e5;background:var(--blueSoft);color:#174fae;box-shadow:inset 0 0 0 1px #1f66e5}.message{margin-top:10px;border-radius:8px;padding:11px 12px;font-weight:900}.message.wait{background:var(--amberSoft);border:1px solid #ead28b;color:var(--amber)}.message.error{background:var(--redSoft);border:1px solid #f0b9b9;color:var(--red)}
    .summary{display:grid;grid-template-columns:1fr}.stat{border:1px solid var(--line);border-radius:8px;padding:12px;background:var(--soft)}.stat b{display:block;font-size:24px}.stat span{display:block;color:var(--muted);font-size:13px;font-weight:900}.timelineLegend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:7px}.legendItem{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:13px;font-weight:900}.legendDot{width:12px;height:12px;border-radius:3px}.legendDot.available{background:#69c998}.legendDot.booked{background:#e78383}.availabilityTrack{display:flex;gap:8px;overflow-x:auto;padding:2px 0 4px}.timeSegment{min-width:150px;flex-basis:0;flex-grow:var(--hours);border:1px solid;border-radius:8px;padding:13px 14px}.timeSegment b{display:block;font-size:16px}.timeSegment .meta{margin-top:5px}.timeSegment.available{border-color:#74cfa2;background:var(--greenSoft);color:#0d6840}.timeSegment.booked{border-color:#e99595;background:var(--redSoft);color:#982f2f}.timeSegment.only{min-width:100%}.badPanel{border-color:#e8a1a1;background:var(--redSoft)}
    .placeSearch{margin-bottom:10px}.searchControls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.searchResults{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:8px;margin-top:8px;overflow:hidden}.searchResults:empty{display:none}.placeResult{width:100%;border:0;border-bottom:1px solid var(--line);background:#fff;padding:11px 12px;text-align:left;color:var(--text)}.placeResult:last-child{border-bottom:0}.placeResult:hover,.placeResult:focus-visible{background:var(--blueSoft);outline:0}.placeResult b{display:block;font-size:14px}.placeResult small{display:block;margin-top:3px;color:var(--muted);font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.locationBar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.locationStatus{min-width:0;color:var(--muted);font-size:14px;font-weight:900}.mapShell{position:relative;overflow:hidden;border:1px solid var(--lineStrong);border-radius:8px;background:var(--soft);margin-bottom:12px}.recommendMap{width:100%;height:240px}.mapNotice{position:absolute;z-index:500;left:12px;right:12px;bottom:12px;border:1px solid #ead28b;border-radius:8px;background:rgba(255,247,223,.96);color:var(--amber);padding:9px 11px;font-size:12px;font-weight:900}.mapNotice[hidden]{display:none}.leaflet-container{font:inherit}.leaflet-control-attribution{font-size:10px}.meta{display:block;color:var(--muted);font-size:13px;font-weight:850}.availabilityText{display:block;margin-top:4px;color:#34445c;font-size:13px;font-weight:900}.grid{display:grid;grid-template-columns:1.2fr 1fr .8fr;gap:10px}.recList{display:flex;flex-direction:column;gap:8px;margin-top:12px}.rec{display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;border:1px solid var(--line);background:#fff;border-radius:8px;padding:9px;cursor:pointer}.rec:hover{border-color:#1f66e5}.rec:focus-visible{outline:3px solid rgba(31,102,229,.25);outline-offset:2px}.rec.best{border-color:#74c79d;background:var(--greenSoft)}.recMain{background:transparent;border:0;color:var(--text);text-align:left;padding:0;pointer-events:none}.distance{color:#174fae;font-weight:950}.pill{border:1px solid #e6c161;background:var(--amberSoft);color:#76520a;padding:7px 10px;border-radius:8px;font-size:13px;font-weight:950;white-space:nowrap}.pill.good{border-color:#6fc99b;background:#dff5ea;color:#0d6840}.pill.bad{border-color:#e99595;background:var(--redSoft);color:#982f2f}.made{margin:26px 0 7px;text-align:center;font-weight:950}.footer{text-align:center;color:var(--muted);font-size:14px}.footer a{color:var(--blue);text-decoration:none;font-weight:850}
    @media(max-width:760px){.facilityList,.summary{grid-template-columns:1fr}.grid{grid-template-columns:1fr 1fr}.quick{grid-template-columns:1fr 1fr}.rec{grid-template-columns:48px 1fr}.pill{grid-column:2;justify-self:start}}@media(max-width:520px){.top,.sectionHead,.selectRow,.dateLine,.locationBar{align-items:stretch;flex-direction:column}.topActions{width:100%}.topActions .btn{flex:1}.dateInputWrap{grid-template-columns:1fr}.filterLine,.grid{grid-template-columns:1fr}.tool{width:100%}.topActions .tool{width:48px;flex:0 0 48px}.recommendMap{height:210px}h1{font-size:24px}}
  </style>
</head>
<body>
<div class="app">
  <header class="top">
    <div><p class="eyebrow">ULSAN FOOTBALL</p><h1>울산 축구장 예약</h1><p class="sub" id="subtitle">운동장 불러오는 중</p></div>
    <div class="topActions"><button class="btn primary" id="goRecommend">주변 추천</button><button class="tool" id="refresh" title="새로고침" aria-label="새로고침">↻</button></div>
  </header>
  <section class="surface">
    <div class="sectionHead"><div><div class="sectionTitle">운동장 선택</div><p class="sub">실제 울산 공공예약 시설명 기준</p></div></div>
    <div class="filterLine"><label><span class="label">지역</span><select id="facilityArea"></select></label><label><span class="label">운동장 검색</span><input class="input" id="facilitySearch" type="search" placeholder="운동장 이름을 입력하세요" autocomplete="off"></label></div>
    <div class="favRail" id="favorites"></div>
    <div class="facilityList" id="facilityList"></div>
  </section>
  <section class="surface">
    <div class="dateLine"><button class="btn subtle" id="prev">‹ 이전</button><div class="dateInputWrap"><input class="input" id="date" type="date"><span class="dateBadge" id="dateBadge"></span></div><button class="btn subtle" id="next">다음 ›</button></div>
    <div class="quick"><button class="btn" data-quick="0">오늘</button><button class="btn" data-quick="1">내일</button><button class="btn" data-weekday="6">토요일</button><button class="btn" data-weekday="0">일요일</button></div>
    <div id="topMessage"></div>
  </section>
  <main id="timeline"></main>
  <section class="surface" id="nearby">
    <div class="sectionHead"><div><div class="sectionTitle">주변 추천</div><p class="sub">선택한 위치에서 가깝고 예약이 비어 있는 운동장 우선</p></div><button class="btn primary" id="recommendBtn">추천 보기</button></div>
    <form class="placeSearch" id="locationSearchForm">
      <label class="label" for="locationQuery">기준 위치 검색</label>
      <div class="searchControls"><input class="input" id="locationQuery" type="search" placeholder="장소나 주소를 입력하세요" autocomplete="off"><button class="btn" type="submit" id="locationSearchBtn">검색</button></div>
      <div class="searchResults" id="locationResults" aria-live="polite"></div>
    </form>
    <div class="locationBar"><div class="locationStatus" id="locationStatus">울산시청 기준 · 지도를 눌러 위치를 바꿀 수 있어요</div><button class="btn" id="useLocation">현위치 사용</button></div>
    <div class="mapShell"><div class="recommendMap" id="recommendMap" aria-label="추천 기준 위치 선택 지도"></div><div class="mapNotice" id="mapNotice" hidden>지도 일부를 불러오지 못했어요. 위 검색으로도 위치를 선택할 수 있습니다.</div></div>
    <div class="grid">
      <label><span class="label">날짜</span><input class="input" id="recDate" type="date"></label>
      <label><span class="label">시작 시각</span><select id="start"></select></label>
      <label><span class="label">이용 시간</span><select id="hours"><option value="1">1시간</option><option value="2" selected>2시간</option><option value="3">3시간</option><option value="4">4시간</option></select></label>
    </div>
    <div id="recommendations"></div>
  </section>
  <div class="made">made by 김예준</div>
  <footer class="footer"><a id="source" href="https://www.ulsan.go.kr/" target="_blank" rel="noreferrer">공식 예약 사이트 열기</a></footer>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
const $ = (id) => document.getElementById(id);
const FAVORITES_KEY = 'ulsan-soccer-favorites';
const AREAS = ['중구','남구','동구','북구','울주군'];
let facilities = [];
let selected = 'junggu:T0000010';
let currentData = null;
let slotsRequestId = 0;
let lastRenderedSelected = '';
const memoryCache = new Map();
const pendingRequests = new Map();
let recommendationOrigin = {latitude:35.5396,longitude:129.3114,label:'울산시청'};
let recommendMap = null;
let originMarker = null;
let facilityLayer = null;
let locationSearchResults = [];
function readFavorites(){try{const parsed=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'); return Array.isArray(parsed)?parsed.filter(Boolean).map(id=>String(id).includes(':')?String(id):'bukgu:'+id):[]}catch{return []}}
let favorites = readFavorites();
function escapeHtml(value){return String(value ?? '').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function iso(d){return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')}
function displayName(f){return !f ? '달천운동장 인조잔디축구장' : (f.name || f.shortName || f.id)}
function detailName(f){if(!f)return '울산 공공 축구장'; const bits=[]; if(f.area)bits.push(f.area); if(f.itemName)bits.push(f.itemName); if(f.providerName)bits.push(f.providerName); return bits.join(' · ')}
function ampm(t){const h=Number(String(t).slice(0,2)); const m=String(t).slice(3,5); const p=h>=12?'오후':'오전'; let h12=h%12; if(!h12) h12=12; return p + ' ' + h12 + ':' + m}
function groupSegments(slots){const out=[];let cur=null;(slots||[]).forEach(s=>{if(!cur||cur.status!==s.status||cur.end!==s.start){if(cur)out.push(cur);cur={status:s.status,start:s.start,end:s.end,hours:1}}else{cur.end=s.end;cur.hours++}});if(cur)out.push(cur);return out}
function saveFav(){localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))}
function toggleFavorite(id){if(!id)return; favorites=favorites.includes(id)?favorites.filter(value=>value!==id):[id,...favorites]; saveFav(); renderFacilities()}
async function fetchJson(url,ttl=30000,force=false){const now=Date.now(); const hit=memoryCache.get(url); if(!force&&hit&&now-hit.savedAt<ttl)return hit.data; if(!force&&pendingRequests.has(url))return pendingRequests.get(url); const request=fetch(url,{cache:force?'reload':'default'}).then(async response=>{const data=await response.json(); if(!response.ok)throw new Error(data.message||'조회에 실패했습니다.'); memoryCache.set(url,{data,savedAt:Date.now()}); return data}).finally(()=>pendingRequests.delete(url)); pendingRequests.set(url,request); return request}
function setMessage(kind,text){$('topMessage').innerHTML=text?'<div class="message '+kind+'">'+escapeHtml(text)+'</div>':''}
function distanceLabel(value){if(!Number.isFinite(value))return '';return value<1?Math.round(value*1000)+'m':value.toFixed(1)+'km'}
function setRecommendationOrigin(latitude,longitude,label,zoom=13){if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;recommendationOrigin={latitude,longitude,label};$('locationStatus').textContent=label+' 기준';if(recommendMap){recommendMap.setView([latitude,longitude],zoom);if(originMarker)originMarker.setLatLng([latitude,longitude]);else originMarker=L.marker([latitude,longitude]).addTo(recommendMap);originMarker.bindPopup('<b>'+escapeHtml(label)+'</b><br>추천 기준 위치');setTimeout(()=>recommendMap.invalidateSize(),80)}}
function renderFacilityMarkers(){if(!recommendMap||!window.L)return;if(facilityLayer)facilityLayer.remove();facilityLayer=L.layerGroup().addTo(recommendMap);facilities.filter(f=>Number.isFinite(f.latitude)&&Number.isFinite(f.longitude)).forEach(f=>{const marker=L.circleMarker([f.latitude,f.longitude],{radius:6,color:'#1f66e5',weight:2,fillColor:'#fff',fillOpacity:1}).addTo(facilityLayer);marker.bindPopup('<b>'+escapeHtml(displayName(f))+'</b><br>'+escapeHtml(detailName(f)));marker.on('click',()=>setRecommendationOrigin(f.latitude,f.longitude,displayName(f),14))})}
function initializeRecommendationMap(){if(!window.L){$('locationStatus').textContent='지도를 불러오지 못했어요. 검색으로 위치를 선택해 주세요.';$('mapNotice').hidden=false;return}recommendMap=L.map('recommendMap',{zoomControl:true,preferCanvas:true}).setView([recommendationOrigin.latitude,recommendationOrigin.longitude],12);let tileErrors=0;const tiles=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:20,keepBuffer:4,updateWhenIdle:false,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(recommendMap);tiles.on('tileerror',()=>{tileErrors++;if(tileErrors>=2)$('mapNotice').hidden=false});tiles.on('load',()=>{$('mapNotice').hidden=true});recommendMap.on('click',(event)=>setRecommendationOrigin(event.latlng.lat,event.latlng.lng,'지도에서 선택한 위치',14));recommendMap.whenReady(()=>setTimeout(()=>recommendMap.invalidateSize(),100));setRecommendationOrigin(recommendationOrigin.latitude,recommendationOrigin.longitude,recommendationOrigin.label,12);renderFacilityMarkers()}
function renderLocationResults(){const host=$('locationResults');host.innerHTML=locationSearchResults.length?locationSearchResults.map((item,index)=>'<button type="button" class="placeResult" data-location-index="'+index+'"><b>'+escapeHtml(item.label)+'</b><small>'+escapeHtml(item.detail)+'</small></button>').join(''):'<div class="empty">울산 안에서 검색 결과를 찾지 못했어요.</div>'}
async function searchLocations(){const query=$('locationQuery').value.trim();if(query.length<2){locationSearchResults=[];$('locationResults').innerHTML='<div class="empty">장소나 주소를 2자 이상 입력해 주세요.</div>';return}const button=$('locationSearchBtn');button.disabled=true;button.textContent='검색 중';$('locationResults').innerHTML='<div class="empty">울산 안에서 장소를 찾고 있어요.</div>';try{const j=await fetchJson('/api/ulsan/location-search?'+new URLSearchParams({q:query}),60*60*1000);locationSearchResults=j.results||[];renderLocationResults()}catch(e){locationSearchResults=[];$('locationResults').innerHTML='<div class="message error">'+escapeHtml(e.message)+'</div>'}finally{button.disabled=false;button.textContent='검색'}}
function selectLocationResult(index){const item=locationSearchResults[index];if(!item)return;$('locationQuery').value=item.label;$('locationResults').innerHTML='';setRecommendationOrigin(item.latitude,item.longitude,item.label,15)}
function renderFacilities(){const query=$('facilitySearch').value.trim().toLowerCase(); const area=$('facilityArea').value||'전체'; const sorted=[...facilities].sort((a,b)=>{if(a.id===selected||b.id===selected)return a.id===selected?-1:1; const af=favorites.includes(a.id),bf=favorites.includes(b.id); if(af!==bf)return af?-1:1; const ar=AREAS.indexOf(a.area)-AREAS.indexOf(b.area); return ar||displayName(a).localeCompare(displayName(b),'ko-KR')}); const visible=sorted.filter(f=>(area==='전체'||f.area===area)&&(displayName(f)+' '+detailName(f)).toLowerCase().includes(query)); const sf=facilities.find(f=>f.id===selected); $('subtitle').textContent=sf?displayName(sf):'울산 전체 '+facilities.length+'곳'; $('favorites').innerHTML=favorites.map(id=>facilities.find(f=>f.id===id)).filter(Boolean).map(f=>'<button class="btn chip" data-fav="'+escapeHtml(f.id)+'">★ '+escapeHtml(displayName(f))+'</button>').join(''); $('facilityList').innerHTML=visible.length?visible.map(f=>{const fav=favorites.includes(f.id); const name=escapeHtml(displayName(f)); return '<div class="facilityItem '+(f.id===selected?'selected':'')+'"><button type="button" class="facilityMain" data-facility="'+escapeHtml(f.id)+'"><span class="facilityText"><b>'+name+'</b><small>'+escapeHtml(detailName(f))+'</small></span></button><button type="button" class="miniStar '+(fav?'active':'')+'" data-toggle-fav="'+escapeHtml(f.id)+'" aria-label="'+(fav?'즐겨찾기 해제: ':'즐겨찾기 추가: ')+name+'" aria-pressed="'+String(fav)+'">'+(fav?'★':'☆')+'</button></div>'}).join(''):'<div class="empty">조건에 맞는 축구장이 없습니다</div>'; if(lastRenderedSelected!==selected){$('facilityList').scrollTop=0;lastRenderedSelected=selected}}
function shortcutDate(button){const date=new Date();if(button.dataset.quick!==undefined){date.setDate(date.getDate()+Number(button.dataset.quick))}else{const weekday=Number(button.dataset.weekday);date.setDate(date.getDate()+(weekday-date.getDay()+7)%7)}return iso(date)}
function renderDateState(){const selectedDate=$('date').value; const isToday=selectedDate===iso(new Date()); $('dateBadge').textContent=isToday?'오늘 선택됨':''; document.querySelectorAll('[data-quick],[data-weekday]').forEach(button=>{const active=selectedDate===shortcutDate(button);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})}
function renderTimeline(){if(!currentData)return; $('source').href=currentData.sourceUrl||'https://www.ulsan.go.kr/'; if(currentData.error){$('timeline').innerHTML='<section class="surface badPanel"><div class="sectionTitle">조회 불가</div><p class="sub">'+escapeHtml(currentData.error)+'</p></section>';return} const segments=groupSegments(currentData.slots); const allAvailable=segments.length===1&&segments[0].status==='AVAILABLE'; const name=displayName(currentData.facilityInfo); const track=segments.length?segments.map(segment=>{const open=segment.status==='AVAILABLE'; const title=allAvailable?'예약 없음':ampm(segment.start)+' ~ '+ampm(segment.end); const detail=allAvailable?ampm(segment.start)+' ~ '+ampm(segment.end)+' · '+segment.hours+'시간 전체 가능':segment.hours+'시간 '+(open?'가능':'예약'); return '<div class="timeSegment '+(open?'available':'booked')+(segments.length===1?' only':'')+'" style="--hours:'+segment.hours+'"><b>'+title+'</b><span class="meta">'+detail+'</span></div>'}).join(''):'<div class="empty">표시할 운영 시간이 없습니다</div>'; $('timeline').innerHTML='<section class="surface"><div class="summary"><div class="stat"><span>선택 운동장</span><b>'+escapeHtml(name)+'</b><span>'+escapeHtml(currentData.date)+'</span></div></div></section><section class="surface"><div class="sectionHead"><div><div class="sectionTitle">시간대별 예약 현황</div><div class="timelineLegend"><span class="legendItem"><i class="legendDot available"></i>예약 가능</span><span class="legendItem"><i class="legendDot booked"></i>예약됨</span></div></div></div><div class="availabilityTrack">'+track+'</div></section>'}
async function loadFacilities(){try{const j=await fetchJson('/api/ulsan/facilities',60*60*1000); facilities=j.facilities||[]; const preferred=favorites.find(id=>facilities.some(f=>f.id===id)); if(!facilities.some(f=>f.id===selected))selected=preferred||(facilities[0]&&facilities[0].id)||selected; renderFacilities(); renderFacilityMarkers()}catch(e){setMessage('error',e.message); facilities=[]; renderFacilities()}}
async function loadSlots(force=false){const requestId=++slotsRequestId; renderDateState(); const qs=new URLSearchParams({date:$('date').value,facilityId:selected}); const url='/api/ulsan/sports?'+qs; try{if(force||!memoryCache.has(url))setMessage('wait','예약 정보를 불러오는 중입니다.'); const data=await fetchJson(url,30000,force); if(requestId!==slotsRequestId)return; currentData=data; setMessage('',''); renderFacilities(); renderTimeline()}catch(e){if(requestId===slotsRequestId)setMessage('error',e.message)}}
function updateStartOptions(){const h=Number($('hours').value||2); const max=24-h; $('start').innerHTML=''; for(let i=5;i<=max;i++){const t=String(i).padStart(2,'0')+':00'; const o=document.createElement('option'); o.value=t; o.textContent=ampm(t); $('start').appendChild(o)} if(!$('start').value)$('start').value='19:00'}
function requestWindow(start,hours){const end=String(Number(start.slice(0,2))+Number(hours)).padStart(2,'0')+':00';return start+'~'+end}
function windowList(windows){return (windows||[]).map(window=>window.start+'~'+window.end).join(', ')}
function resultLabel(r){if(r.error)return '조회 실패';if(r.isFullyAvailable)return '전체 가능';if(!r.availableSlots)return '예약 불가';return '일부 가능'}
function availabilityDetail(r,start,hours){if(r.error)return '예약 현황을 확인하지 못했어요';if(r.isFullyAvailable)return '가능 '+requestWindow(start,hours);const available=windowList(r.availableWindows);return available?'가능 '+available:'가능 시간 없음'}
function useCurrentLocation(){const button=$('useLocation');if(!navigator.geolocation){$('locationStatus').textContent='이 브라우저에서는 현위치를 사용할 수 없어요.';return}button.disabled=true;button.textContent='위치 확인 중';navigator.geolocation.getCurrentPosition(position=>{setRecommendationOrigin(position.coords.latitude,position.coords.longitude,'내 현위치',14);button.disabled=false;button.textContent='현위치 다시 찾기'},()=>{$('locationStatus').textContent='위치 권한을 허용하거나 지도에서 위치를 선택해 주세요.';button.disabled=false;button.textContent='현위치 사용'},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}
async function loadRecommendations(){const button=$('recommendBtn'); const original=button.textContent; button.disabled=true; button.textContent='조회 중'; try{const qs=new URLSearchParams({area:'중구',lat:String(recommendationOrigin.latitude),lng:String(recommendationOrigin.longitude),date:$('recDate').value,start:$('start').value,hours:$('hours').value}); const url='/api/ulsan/soccer/recommendations?'+qs; if(!memoryCache.has(url))$('recommendations').innerHTML='<div class="message wait">선택 위치에서 가까운 축구장 12곳의 예약 현황을 확인합니다.</div>'; const j=await fetchJson(url,60000); const items=(j.results||[]).slice(0,12); const requested=requestWindow(j.startTime,j.hours); $('recommendations').innerHTML='<p class="sub">'+escapeHtml(recommendationOrigin.label)+' 기준 · 요청 '+requested+' · 가까운 '+j.facilitiesChecked+'곳 확인</p><div class="recList">'+items.map(x=>{const distance=distanceLabel(x.distanceKm);const status=resultLabel(x);const tone=x.isFullyAvailable?'good':(!x.availableSlots||x.error?'bad':'');return '<article class="rec '+(x.isFullyAvailable?'best':'')+'" data-pick="'+escapeHtml(x.facility.id)+'" role="button" tabindex="0" aria-label="'+escapeHtml(displayName(x.facility))+' 상세보기"><button class="tool favorite '+(favorites.includes(x.facility.id)?'active':'')+'" data-star="'+escapeHtml(x.facility.id)+'" aria-label="즐겨찾기 '+escapeHtml(displayName(x.facility))+'">'+(favorites.includes(x.facility.id)?'★':'☆')+'</button><div class="recMain"><b>'+escapeHtml(displayName(x.facility))+'</b><span class="meta">'+(distance?'<span class="distance">'+distance+'</span> · ':'')+escapeHtml(detailName(x.facility))+'</span><span class="availabilityText">요청 '+requested+' · '+escapeHtml(availabilityDetail(x,j.startTime,j.hours))+'</span></div><span class="pill '+tone+'">'+status+'</span></article>'}).join('')+'</div>'}catch(e){$('recommendations').innerHTML='<div class="message error">'+escapeHtml(e.message)+'</div>'}finally{button.disabled=false;button.textContent=original}}
async function openRecommendation(id){if(!id)return; selected=id; $('facilityArea').value='전체'; $('facilitySearch').value=''; $('date').value=$('recDate').value; renderFacilities(); await loadSlots(); $('timeline').scrollIntoView({behavior:'smooth',block:'start'})}
$('date').value=iso(new Date()); $('recDate').value=$('date').value; ['전체',...AREAS].forEach(a=>{$('facilityArea').append(new Option(a,a))}); updateStartOptions(); $('start').value='19:00'; renderDateState(); initializeRecommendationMap();
$('facilitySearch').oninput=renderFacilities; $('facilityArea').onchange=()=>{const area=$('facilityArea').value; const current=facilities.find(f=>f.id===selected); if(area!=='전체'&&current?.area!==area){const first=facilities.find(f=>f.area===area); if(first){selected=first.id; loadSlots(); return}} renderFacilities()}; $('facilityList').onclick=(e)=>{const star=e.target.closest('[data-toggle-fav]'); if(star){toggleFavorite(star.dataset.toggleFav);return} const btn=e.target.closest('[data-facility]'); if(btn){selected=btn.dataset.facility; $('facilitySearch').value=''; loadSlots()}};
$('favorites').onclick=(e)=>{const id=e.target.closest('[data-fav]')?.dataset.fav; if(id){selected=id; loadSlots()}}; $('prev').onclick=()=>{const d=new Date($('date').value+'T00:00:00'); d.setDate(d.getDate()-1); $('date').value=iso(d); loadSlots()}; $('next').onclick=()=>{const d=new Date($('date').value+'T00:00:00'); d.setDate(d.getDate()+1); $('date').value=iso(d); loadSlots()}; $('date').onchange=()=>loadSlots(); $('refresh').onclick=()=>loadSlots(true); $('goRecommend').onclick=()=>{$('nearby').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>recommendMap?.invalidateSize(),300)}; $('useLocation').onclick=useCurrentLocation;
$('locationSearchForm').onsubmit=(event)=>{event.preventDefault();searchLocations()}; $('locationResults').onclick=(event)=>{const result=event.target.closest('[data-location-index]');if(result)selectLocationResult(Number(result.dataset.locationIndex))}; $('locationQuery').oninput=()=>{if(!$('locationQuery').value.trim()){$('locationResults').innerHTML='';locationSearchResults=[]}};
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const d=new Date(); d.setDate(d.getDate()+Number(b.dataset.quick)); $('date').value=iso(d); loadSlots()}); document.querySelectorAll('[data-weekday]').forEach(b=>b.onclick=()=>{const d=new Date(); const dow=Number(b.dataset.weekday); const delta=(dow-d.getDay()+7)%7; d.setDate(d.getDate()+delta); $('date').value=iso(d); loadSlots()});
$('hours').onchange=updateStartOptions; $('recommendBtn').onclick=loadRecommendations; $('recommendations').onclick=(e)=>{const star=e.target.closest('[data-star]')?.dataset.star; const pick=e.target.closest('[data-pick]')?.dataset.pick; if(star){toggleFavorite(star);loadRecommendations();return} if(pick)openRecommendation(pick)}; $('recommendations').onkeydown=(e)=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-pick]')){e.preventDefault();openRecommendation(e.target.dataset.pick)}};
loadFacilities().then(loadSlots);
</script>
</body>
</html>`;
