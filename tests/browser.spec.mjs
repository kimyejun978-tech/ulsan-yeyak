import {test,expect} from '../.qa-browser/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:8787';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jSTkAAAAASUVORK5CYII=','base64');
async function setup(page,request){
  await page.clock.setFixedTime(new Date('2026-11-04T03:00:00Z'));
  const catalog=await(await request.get(base+'/api/ulsan/facilities')).json();
  const facilities=catalog.facilities;
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/**',async route=>{
    const filename=route.request().url().endsWith('.css')?'leaflet.css':'leaflet.js';
    const body=await fs.readFile(new URL('../.qa-browser/node_modules/leaflet/dist/'+filename,import.meta.url));
    await route.fulfill({body,contentType:filename.endsWith('css')?'text/css':'application/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
  });
  await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({body:png,contentType:'image/png'}));
  await page.route('**/api/ulsan/sports?*',async route=>{
    const url=new URL(route.request().url()),date=url.searchParams.get('date');
    if(date==='2026-11-05'){await route.fulfill({status:502,json:{message:'Test upstream unavailable'}});return;}
    if(date==='2026-11-06')await new Promise(resolve=>setTimeout(resolve,300));
    const f=facilities.find(f=>f.id===url.searchParams.get('facilityId'))||facilities[0];
    await route.fulfill({json:{facility:f.id,facilityInfo:f,date,sourceUrl:f.sourceUrl,slots:[{hour:18,start:'18:00',end:'19:00',status:'BOOKED'},{hour:19,start:'19:00',end:'20:00',status:'AVAILABLE'}],updatedAt:'2026-11-04T02:00:00Z'}});
  });
  await page.route('**/api/ulsan/soccer/recommendations?*',route=>{
    const url=new URL(route.request().url());
    return route.fulfill({json:{date:url.searchParams.get('date'),startTime:url.searchParams.get('start'),hours:Number(url.searchParams.get('hours')),facilitiesChecked:3,stale:true,cacheWarning:'일부 운동장은 이전 조회 정보입니다.',results:facilities.slice(0,3).map((f,index)=>({facility:f,sourceUrl:f.sourceUrl,isFullyAvailable:index===0,availableSlots:index===0?3:1,bookedSlots:index===0?0:2,requestedSlots:3,availableWindows:[{start:'19:00',end:index===0?'22:00':'20:00'}],error:null,stale:index===0,updatedAt:'2026-11-04T01:00:00Z',distanceKm:1+index}))}});
  });
  await page.goto(base);
  await expect(page.locator('#timeline')).toContainText('시간대별 예약 현황');
}

test('mobile controls preserve time, favorites and recommendation date; stale warning stays visible',async({page,request},testInfo)=>{
  await setup(page,request);
  await page.locator('#hours').selectOption('3');
  await expect(page.locator('#start')).toHaveValue('19:00');
  const star=page.locator('[data-toggle-fav]').first();
  await star.click();await expect(page.locator('#favorites button')).toHaveCount(1);
  await page.locator('#recDate').fill('2026-11-07');
  await page.locator('#recommendBtn').click();
  await expect(page.locator('.recMain')).toHaveCount(3);
  await expect(page.locator('#recommendations')).toContainText('이전 조회 정보');
  await expect(page.locator('#recommendations')).toContainText('2026-11-07');
  await page.screenshot({path:testInfo.outputPath('mobile-recommendations.png'),fullPage:true});
  await page.locator('[data-pick]').first().click();
  await expect(page.locator('#date')).toHaveValue('2026-11-07');
  await page.locator('#recDate').fill('2026-11-08');
  await expect(page.locator('#recommendations')).toContainText('조건이 변경');
  await expect(page.locator('[data-pick]')).toHaveCount(0);
});

test('mobile and desktop widths do not overflow, and the map accepts a location',async({page,request},testInfo)=>{
  await setup(page,request);
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('layout-'+width+'.png'),fullPage:true});
  }
  await page.locator('#recommendMap').click({position:{x:100,y:100}});
  await expect(page.locator('#originTitle')).toHaveText('지도에서 선택한 위치');
});

test('lookup failures remove previous results and old responses cannot overwrite a new date',async({page,request},testInfo)=>{
  await setup(page,request);
  await page.locator('#date').fill('2026-11-06');
  await page.locator('#date').fill('2026-11-07');
  await expect(page.locator('#timeline')).toContainText('2026-11-07');
  await page.waitForTimeout(400);
  await expect(page.locator('#timeline')).not.toContainText('2026-11-06');
  await page.locator('#date').fill('2026-11-05');
  await expect(page.locator('#topMessage')).toContainText('조회에 실패');
  await expect(page.locator('#timeline')).not.toContainText('시간대별 예약 현황');
  await page.screenshot({path:testInfo.outputPath('worker-error.png'),fullPage:true});
  await page.locator('#date').fill('');
  await expect(page.locator('#prev')).toBeDisabled();
  await expect(page.locator('#next')).toBeDisabled();
});

test('Dalcheon web app does not report availability after a failed lookup',async({page},testInfo)=>{
  await page.clock.setFixedTime(new Date('2026-11-04T03:00:00Z'));
  await page.route('**/api/dalcheon/soccer?*',route=>{
    const date=new URL(route.request().url()).searchParams.get('date');
    return date==='2026-11-05'?route.fulfill({status:503,json:{message:'Unavailable'}}):route.fulfill({json:{date,slots:[{start:'18:00',end:'19:00',status:'BOOKED'}],allBooked:false}});
  });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('main')).toContainText('1시간 예약');
  await expect(page.locator('.loadingOverlay')).toHaveCount(0);
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('dalcheon-'+width+'.png'),fullPage:true});
  }
  await page.getByLabel('조회 날짜',{exact:true}).fill('2026-11-05');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('예약 없음');
  await page.screenshot({path:testInfo.outputPath('dalcheon-error.png'),fullPage:true});
});
