import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createServer } from '../deploy-server.mjs';

const source = await fs.readFile(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
const nativeFetch = globalThis.fetch;
let sequence = 0;
async function freshWorker() {
  const code = source + '\nexport { responseCache, normalizeDate };\n// isolated test ' + sequence++;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
async function request(worker, path, context) {
  const response = await worker.default.fetch(new Request('https://test.local' + path), {}, context);
  return { status: response.status, data: await response.json(), headers: response.headers };
}
function mock(t, fixture) {
  let count = 0;
  globalThis.fetch = async (input, init = {}) => {
    count++;
    const url = new URL(typeof input === 'string' ? input : input.url);
    const data = await fixture(url, init);
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = nativeFetch; });
  return () => count;
}

test('34 unique facilities, legacy alias, correct hours and booked count', async t => {
  mock(t, () => ({ chk_result: 'OK', hhhlist: '18,19,' }));
  const worker = await freshWorker();
  const catalog = (await request(worker, '/api/ulsan/facilities')).data;
  assert.equal(catalog.facilities.length, 34);
  assert.equal(new Set(catalog.facilities.map(f => f.id)).size, 34);
  const result = (await request(worker, '/api/dalcheon/soccer?date=2026-11-04')).data;
  assert.equal(result.facility, 'bukgu:T0000037');
  assert.equal(result.bookedHoursCount, 2);
  assert.equal(result.slots.length, 19);
  const limited = (await request(worker, '/api/ulsan/sports?date=2026-11-04&facilityId=junggu:T0000009')).data;
  assert.equal(limited.slots[0].start, '07:00');
  assert.equal(limited.slots.at(-1).end, '18:00');
});

test('invalid dates and unknown facilities are rejected before upstream requests', async t => {
  const calls = mock(t, () => ({ chk_result: 'OK', hhhlist: '' }));
  const worker = await freshWorker();
  for (const date of ['2026-02-31', '2026-02-29', '2026-04-31', '2026-13-01', 'bad']) {
    assert.equal((await request(worker, '/api/ulsan/sports?date=' + date)).status, 400);
  }
  assert.equal((await request(worker, '/api/ulsan/sports?date=2026-11-04&facilityId=unknown')).status, 404);
  assert.equal(calls(), 0);
  assert.equal(worker.normalizeDate('2028-02-29'), '2028-02-29');
  assert.equal(worker.normalizeDate(), new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
});

test('forced refresh bypasses both fresh caches and returns updated reservations', async t => {
  let hours = '18';
  const calls = mock(t, () => ({ chk_result: 'OK', hhhlist: hours }));
  const worker = await freshWorker();
  const path = '/api/ulsan/sports?date=2026-11-04&facilityId=bukgu:T0000037';
  assert.equal((await request(worker, path)).data.bookedHoursCount, 1);
  hours = '18,19';
  assert.equal((await request(worker, path)).data.bookedHoursCount, 1);
  const refreshed = await request(worker, path + '&refresh=1');
  assert.equal(refreshed.data.bookedHoursCount, 2);
  assert.equal(refreshed.headers.get('cache-control'), 'no-store');
  assert.equal(calls(), 2);
});

test('recommendation cache uses the same 60 second slot TTL', async t => {
  mock(t, () => ({ chk_result: 'OK', hhhlist: '' }));
  const worker = await freshWorker();
  await request(worker, '/api/ulsan/soccer/recommendations?date=2026-11-05&area=북구');
  const entry = worker.responseCache.get('slots:bukgu:T0000037:2026-11-05');
  assert.ok(entry);
  assert.equal(entry.expiresAt - entry.savedAt, 60000);
});

test('stale source warnings and source timestamps survive recommendation scoring', async t => {
  mock(t, () => { throw new Error('upstream unavailable'); });
  const worker = await freshWorker();
  const facilities = (await request(worker, '/api/ulsan/facilities')).data.facilities;
  const now = Date.now();
  const updatedAt = new Date(now - 3600000).toISOString();
  for (const f of facilities) worker.responseCache.set('slots:' + f.id + ':2026-11-06', {
    value: { facility: f.id, updatedAt, slots: [{ hour:19,start:'19:00',end:'20:00',status:'AVAILABLE' },{ hour:20,start:'20:00',end:'21:00',status:'AVAILABLE' }] },
    savedAt: now - 3600000, expiresAt: now - 1, staleExpiresAt: now + 3600000
  });
  const result = await request(worker, '/api/ulsan/soccer/recommendations?date=2026-11-06&area=북구');
  assert.equal(result.data.stale, true);
  assert.ok(result.data.cacheWarning);
  assert.equal(result.data.results[0].stale, true);
  assert.equal(result.data.results[0].updatedAt, updatedAt);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(worker.responseCache.has('recommend:북구:2026-11-06:19:00:2'), false);
});

test('partly available facilities rank before facilities closed at requested time', async t => {
  mock(t, (url, init) => {
    const params = new URLSearchParams(url.search || String(init.body || ''));
    const partial = url.host === 'crs.ujcmc.or.kr' && params.get('item_id') === 'T0000010';
    const data = { chk_result: 'OK', hhhlist: partial ? '19' : '19,20' };
    return ['crs.ujcmc.or.kr','crs.uncmc.or.kr','crs.donggu.ulsan.kr'].includes(url.host) ? [data] : data;
  });
  const worker = await freshWorker();
  const result = (await request(worker, '/api/ulsan/soccer/recommendations?date=2026-11-07&area=중구&start=19:00&hours=2')).data;
  assert.equal(result.results[0].facility.id, 'junggu:T0000010');
  assert.equal(result.results[0].availableSlots, 1);
  const closed = result.results.find(row => row.facility.id === 'junggu:T0000009');
  assert.equal(closed.requestedSlots, 2);
  assert.equal(closed.closedSlots, 2);
  assert.equal(closed.isFullyAvailable, false);
});

test('concurrent requests share upstream work and register background completion', async t => {
  const calls = mock(t, async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return { chk_result: 'NODATA', hhhlist: '' };
  });
  const worker = await freshWorker();
  const background = [];
  const context = { waitUntil(promise) { background.push(promise); } };
  const path = '/api/dalcheon/soccer?date=2026-11-08';
  const responses = await Promise.all([request(worker, path, context), request(worker, path, context)]);
  assert.equal(calls(), 1);
  assert.ok(background.length);
  await Promise.all(background);
  assert.equal(responses[0].data.bookedHoursCount, 0);
});

test('upstream failure never produces available slots', async t => {
  mock(t, () => { throw new Error('test secret must not leak'); });
  const result = await request(await freshWorker(), '/api/dalcheon/soccer?date=2026-11-09');
  assert.equal(result.status, 502);
  assert.equal(result.data.slots, undefined);
  assert.doesNotMatch(result.data.message, /test secret/);
});

test('Node/Render serves the same UI, catalog and validation without dependencies', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const catalog = await (await nativeFetch(base + '/api/ulsan/facilities')).json();
  assert.equal(catalog.facilities.length, 34);
  assert.equal((await nativeFetch(base + '/api/ulsan/sports?date=2026-02-31')).status, 400);
  const html = await (await nativeFetch(base)).text();
  assert.match(html, /기준 위치 검색/);
  assert.match(html, /invalidateRecommendations/);
  assert.equal((await nativeFetch(base, { method:'POST' })).status, 405);
});

test('all inline browser scripts have valid JavaScript syntax', () => {
  for (const match of source.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
