import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchDalcheonSoccerSlots,
  fetchUlsanFacilities,
  fetchUlsanFacilitySlots,
  recommendSoccerFacilities
} from './dalcheon.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
// Cache reservation results to avoid hitting the upstream service on every tap.
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {Map<string, { expiresAt:number, value:any }>} */
const cache = new Map();

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
});

// CORS is only needed for local dev with separate Vite server.
if (process.env.CORS === '1') {
  await app.register(cors, { origin: true });
}

app.get('/health', async () => ({ ok: true }));

app.get('/api/ulsan/facilities', async () => fetchUlsanFacilities());

app.get('/api/ulsan/location-search', async (req, reply) => {
  const query = String(req.query?.q || '').trim();
  if (query.length < 2 || query.length > 80) {
    return reply.code(400).send({
      error: 'BadRequest',
      message: '장소나 주소를 2자 이상 입력해 주세요.'
    });
  }

  const cacheKey = `location-search:${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

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
    },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    return reply.code(502).send({
      error: 'LocationSearchUnavailable',
      message: '장소 검색 서비스가 잠시 응답하지 않습니다. 잠시 후 다시 시도해 주세요.'
    });
  }
  const items = await response.json();
  const value = {
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
  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value });
  return value;
});

app.get('/api/ulsan/sports', async (req, reply) => {
  const date = normalizeDate(req.query?.date);
  if (!date) {
    return reply.code(400).send({
      error: 'BadRequest',
      message: 'date must be YYYY-MM-DD (or omit for today)'
    });
  }

  const facilityId = String(req.query?.facilityId || req.query?.itemId || 'junggu:T0000010').trim();
  const cacheKey = `ulsan-sports:${facilityId}:${date}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const value = {
      ...(await fetchUlsanFacilitySlots(date, facilityId)),
      updatedAt: new Date().toISOString()
    };

    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    return reply.code(400).send({
      error: 'BadRequest',
      message: error.message || 'failed to fetch facility slots'
    });
  }
});

app.get('/api/ulsan/soccer/recommendations', async (req, reply) => {
  const date = normalizeDate(req.query?.date);
  if (!date) {
    return reply.code(400).send({
      error: 'BadRequest',
      message: 'date must be YYYY-MM-DD (or omit for today)'
    });
  }

  const area = String(req.query?.area || '중구');
  const startTime = String(req.query?.start || req.query?.startTime || '19:00');
  const hours = Number(req.query?.hours || 2);
  const latitude = Number(req.query?.lat);
  const longitude = Number(req.query?.lng);
  const validLatitude = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null;
  const validLongitude = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null;
  const locationKey = validLatitude === null || validLongitude === null ? area : `${validLatitude.toFixed(4)}:${validLongitude.toFixed(4)}`;
  const cacheKey = `ulsan-soccer-recommend:${locationKey}:${date}:${startTime}:${hours}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await recommendSoccerFacilities({
    area,
    dateISO: date,
    startTime,
    hours,
    latitude: validLatitude,
    longitude: validLongitude
  });

  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value });
  return value;
});

app.get('/api/dalcheon/soccer', async (req, reply) => {
  const date = normalizeDate(req.query?.date);
  if (!date) {
    return reply.code(400).send({
      error: 'BadRequest',
      message: 'date must be YYYY-MM-DD (or omit for today)'
    });
  }

  const cacheKey = `dalcheon-soccer:${date}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const value = {
    ...(await fetchDalcheonSoccerSlots(date)),
    updatedAt: new Date().toISOString()
  };

  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value });
  return value;
});

// Serve built web app (PWA) if present.
const webDist = path.resolve(__dirname, '../../web/dist');
try {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
    wildcard: false
  });

  // SPA fallback: serve index.html for all non-API routes.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
      return reply.code(404).send({ error: 'NotFound' });
    }
    return reply.sendFile('index.html');
  });
} catch {
  // ignore if dist doesn't exist (e.g., dev)
}

function normalizeDate(dateParam) {
  if (dateParam == null || dateParam === '') {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(dateParam);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

app.listen({ port: PORT, host: HOST });
