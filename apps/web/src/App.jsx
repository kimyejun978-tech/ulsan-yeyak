import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DEFAULT_FACILITY_ID = 'junggu:T0000010'
const FAVORITES_KEY = 'ulsan-soccer-favorites'
const AREAS = ['중구', '남구', '동구', '북구', '울주군']
const HOURS = [1, 2, 3, 4]
const TIME_OPTIONS = Array.from({ length: 19 }, (_, index) => `${String(index + 5).padStart(2, '0')}:00`)
const responseCache = new Map()
const pendingRequests = new Map()

async function fetchJson(url, ttl = 30000) {
  const cached = responseCache.get(url)
  if (cached && Date.now() - cached.savedAt < ttl) return cached.data
  if (pendingRequests.has(url)) return pendingRequests.get(url)

  const request = fetch(url)
    .then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || `API error: ${response.status}`)
      responseCache.set(url, { data, savedAt: Date.now() })
      return data
    })
    .finally(() => pendingRequests.delete(url))

  pendingRequests.set(url, request)
  return request
}

function toISODate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function readFavorites() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed)
      ? parsed.filter(Boolean).map((id) => (String(id).includes(':') ? id : `bukgu:${id}`))
      : []
  } catch {
    return []
  }
}

function saveFavorites(ids) {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
}

function formatKoreanAmPm(hhmm) {
  const [hhStr, mm] = String(hhmm).split(':')
  const hh = Number(hhStr)
  if (!Number.isFinite(hh) || mm == null) return hhmm

  const isPM = hh >= 12
  const period = isPM ? '오후' : '오전'
  let h12 = hh % 12
  if (h12 === 0) h12 = 12
  return `${period} ${h12}:${mm}`
}

function groupSlots(slots, status) {
  const blocks = []
  let cur = null

  for (const slot of Array.isArray(slots) ? slots : []) {
    if (slot.status === status) {
      if (!cur) cur = { start: slot.start, end: slot.end, hours: 1 }
      else if (cur.end === slot.start) {
        cur.end = slot.end
        cur.hours += 1
      } else {
        blocks.push(cur)
        cur = { start: slot.start, end: slot.end, hours: 1 }
      }
    } else if (cur) {
      blocks.push(cur)
      cur = null
    }
  }

  if (cur) blocks.push(cur)
  return blocks
}

function facilityLabel(facility) {
  if (!facility) return '달천축구장'
  const name = facility.shortName || facility.name || facility.id
  return facility.area ? `${facility.area} · ${name}` : name
}

function resultLabel(result) {
  if (result.error) return '조회 실패'
  if (result.isFullyAvailable) return '예약 없음'
  if (result.bookedSlots === result.requestedSlots) return '전부 예약'
  return `${result.availableSlots}/${result.requestedSlots}시간 가능`
}

function BlockList({ blocks, tone, emptyTitle, emptySub, metaLabel }) {
  if (!blocks.length) {
    return (
      <div className={`hero ${tone}`}>
        <div className="heroTitle">{emptyTitle}</div>
        <div className="heroSub">{emptySub}</div>
      </div>
    )
  }

  return (
    <div className="blocksList">
      {blocks.map((block) => (
        <div key={`${block.start}-${block.end}`} className={`block ${tone}`}>
          <div className="blockTime">
            {formatKoreanAmPm(block.start)} ~ {formatKoreanAmPm(block.end)}
          </div>
          <div className="blockMeta">
            {block.hours}시간 {metaLabel}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [facilityId, setFacilityId] = useState(DEFAULT_FACILITY_ID)
  const [facilities, setFacilities] = useState([])
  const [favorites, setFavorites] = useState(readFavorites)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [facilityError, setFacilityError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [recommendArea, setRecommendArea] = useState('중구')
  const [recommendDate, setRecommendDate] = useState(() => toISODate(new Date()))
  const [recommendStart, setRecommendStart] = useState('19:00')
  const [recommendHours, setRecommendHours] = useState(2)
  const [recommendations, setRecommendations] = useState(null)
  const [recommendError, setRecommendError] = useState(null)
  const [recommendLoading, setRecommendLoading] = useState(false)

  async function loadFacilities() {
    setFacilityError(null)
    try {
      const base = import.meta.env.VITE_API_BASE || ''
      const json = await fetchJson(`${base}/api/ulsan/facilities`, 60 * 60 * 1000)
      const list = Array.isArray(json?.facilities) ? json.facilities : []
      setFacilities(list)

      const preferred = favorites.find((id) => list.some((facility) => facility.id === id))
      if (!list.some((facility) => facility.id === facilityId)) {
        setFacilityId(preferred || list[0]?.id || DEFAULT_FACILITY_ID)
      }
    } catch (e) {
      setFacilityError(String(e?.message || e))
      setFacilities([
        {
          id: DEFAULT_FACILITY_ID,
          itemId: 'T0000010',
          name: '중구다목적구장',
          shortName: '중구다목적구장',
          area: '중구'
        }
      ])
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const base = import.meta.env.VITE_API_BASE || ''
      const params = new URLSearchParams({ date, facilityId })
      const json = await fetchJson(`${base}/api/ulsan/sports?${params.toString()}`, 30000)
      setData(json)
    } catch (e) {
      setError(String(e?.message || e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadRecommendations() {
    setRecommendLoading(true)
    setRecommendError(null)
    try {
      const base = import.meta.env.VITE_API_BASE || ''
      const params = new URLSearchParams({
        area: recommendArea,
        date: recommendDate,
        start: recommendStart,
        hours: String(recommendHours)
      })
      const json = await fetchJson(`${base}/api/ulsan/soccer/recommendations?${params.toString()}`, 60000)
      setRecommendations(json)
    } catch (e) {
      setRecommendError(String(e?.message || e))
      setRecommendations(null)
    } finally {
      setRecommendLoading(false)
    }
  }

  function toggleFavorite(id) {
    const next = favorites.includes(id) ? favorites.filter((favoriteId) => favoriteId !== id) : [id, ...favorites]
    setFavorites(next)
    saveFavorites(next)
  }

  useEffect(() => {
    loadFacilities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, facilityId])

  const selectedFacility = useMemo(() => {
    return facilities.find((facility) => facility.id === facilityId) || data?.facilityInfo || facilities[0]
  }, [data, facilities, facilityId])

  const favoriteFacilities = useMemo(() => {
    return favorites
      .map((id) => facilities.find((facility) => facility.id === id))
      .filter(Boolean)
  }, [facilities, favorites])

  const sortedFacilities = useMemo(() => {
    return [...facilities].sort((a, b) => {
      const aFav = favorites.includes(a.id)
      const bFav = favorites.includes(b.id)
      if (aFav !== bFav) return aFav ? -1 : 1
      const area = String(a.area || '').localeCompare(String(b.area || ''), 'ko-KR')
      if (area !== 0) return area
      return String(a.shortName || a.name).localeCompare(String(b.shortName || b.name), 'ko-KR')
    })
  }, [facilities, favorites])

  const availableBlocks = useMemo(() => groupSlots(data?.slots, 'AVAILABLE'), [data])
  const bookedBlocks = useMemo(() => groupSlots(data?.slots, 'BOOKED'), [data])
  const selectedIsFavorite = favorites.includes(facilityId)
  const recommendTimeOptions = useMemo(() => {
    const maxStart = 24 - recommendHours
    return TIME_OPTIONS.filter((time) => Number(time.slice(0, 2)) <= maxStart)
  }, [recommendHours])

  useEffect(() => {
    if (!recommendTimeOptions.includes(recommendStart)) {
      setRecommendStart(recommendTimeOptions.at(-1) || '19:00')
    }
  }, [recommendStart, recommendTimeOptions])

  const quickDates = useMemo(() => {
    const now = new Date()
    const today = new Date(now)
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)

    const nextDow = (dow) => {
      const d = new Date(now)
      const delta = (dow - now.getDay() + 7) % 7
      d.setDate(now.getDate() + delta)
      return { d, delta }
    }

    const sat = nextDow(6)
    const sun = nextDow(0)

    const fmtMD = (d) => `${d.getMonth() + 1}/${d.getDate()}`
    const suffix = (delta) => (delta === 0 ? '·오늘' : delta === 1 ? '·내일' : '')

    return [
      { label: '오늘', value: toISODate(today) },
      { label: '내일', value: toISODate(tomorrow) },
      { label: `토(${fmtMD(sat.d)}${suffix(sat.delta)})`, value: toISODate(sat.d) },
      { label: `일(${fmtMD(sun.d)}${suffix(sun.delta)})`, value: toISODate(sun.d) }
    ]
  }, [])

  return (
    <div className={loading || recommendLoading ? 'wrap loading' : 'wrap'}>
      {(loading || recommendLoading) && (
        <div className="loadingOverlay" role="status" aria-live="polite">
          <div className="loadingCard">
            <div className="spinner" aria-hidden="true" />
            <div className="loadingText">불러오는 중…</div>
          </div>
        </div>
      )}

      <header className="header">
        <div>
          <div className="title">울산 축구장 예약 확인</div>
          <div className="subtitle">{facilityLabel(selectedFacility)}</div>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
          새로고침
        </button>
      </header>

      <section className="controls">
        <div className="facilityLine">
          <label className="field grow">
            <span className="fieldLabel">축구장</span>
            <select
              className="facilitySelect"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              disabled={loading}
            >
              {sortedFacilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {favorites.includes(facility.id) ? '★ ' : ''}
                  {facilityLabel(facility)}
                </option>
              ))}
            </select>
          </label>
          <button
            className={selectedIsFavorite ? 'iconBtn active' : 'iconBtn'}
            onClick={() => toggleFavorite(facilityId)}
            aria-label={selectedIsFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            title={selectedIsFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            {selectedIsFavorite ? '★' : '☆'}
          </button>
        </div>

        {favoriteFacilities.length > 0 && (
          <div className="favoriteBar">
            {favoriteFacilities.map((facility) => (
              <button
                key={facility.id}
                className={facility.id === facilityId ? 'favoriteChip active' : 'favoriteChip'}
                onClick={() => setFacilityId(facility.id)}
              >
                {facility.shortName || facility.name}
              </button>
            ))}
          </div>
        )}

        <div className="row">
          <div className="dateNav">
            <button
              className="navBtn"
              onClick={() => {
                const d = new Date(date + 'T00:00:00')
                d.setDate(d.getDate() - 1)
                setDate(toISODate(d))
              }}
              aria-label="이전 날짜"
              title="이전 날짜"
            >
              ← 이전
            </button>
            <input className="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button
              className="navBtn"
              onClick={() => {
                const d = new Date(date + 'T00:00:00')
                d.setDate(d.getDate() + 1)
                setDate(toISODate(d))
              }}
              aria-label="다음 날짜"
              title="다음 날짜"
            >
              다음 →
            </button>
          </div>
        </div>

        <div className="quickGrid">
          {(() => {
            const activeTaken = new Set()
            const items = quickDates.map((q) => {
              const isActive = q.value === date && !activeTaken.has(q.value)
              if (isActive) activeTaken.add(q.value)

              return (
                <button
                  key={q.label}
                  className={isActive ? 'chip active' : 'chip'}
                  onClick={() => {
                    if (q.value === date) load()
                    else setDate(q.value)
                  }}
                >
                  {q.label}
                </button>
              )
            })
            return [
              <div key="r1" className="quickRow">
                {items[0]}
                {items[1]}
              </div>,
              <div key="r2" className="quickRow">
                {items[2]}
                {items[3]}
              </div>
            ]
          })()}
        </div>

        {facilityError && <div className="notice">축구장 목록은 기본값으로 표시 중입니다.</div>}
        {error && <div className="error">{error}</div>}
      </section>

      <main className="timeline" aria-label="time slots">
        {data?.holiday?.isHoliday && (
          <div className="hero danger">
            <div className="heroTitle">
              {data.holiday.type === 'substitute' ? '대체공휴일' : '공휴일'}: {data.holiday.name}
            </div>
            <div className="heroSub">
              {data.holiday.type === 'substitute' && data.holiday.of
                ? `(${data.holiday.of} 대체휴일) 예약 불가`
                : '공휴일에는 예약이 불가합니다.'}
            </div>
          </div>
        )}

        {data?.error && (
          <div className="hero danger">
            <div className="heroTitle">조회 불가</div>
            <div className="heroSub">{data.error}</div>
            {data?.msg ? <div className="heroSub">(공식 응답: {data.msg})</div> : null}
          </div>
        )}

        {!data?.error && !data?.holiday?.isHoliday && (
          <>
            <section className="blocks ok">
              <div className="blocksTitle">가능한 시간</div>
              <BlockList
                blocks={availableBlocks}
                tone="ok"
                emptyTitle="가능 시간 없음"
                emptySub="이 날짜는 예약 가능한 시간이 보이지 않아요"
                metaLabel="가능"
              />
            </section>

            <section className="blocks danger">
              <div className="blocksTitle">예약된 시간</div>
              {data?.allBooked ? (
                <div className="hero danger">
                  <div className="heroTitle">전 시간 예약 불가</div>
                  <div className="heroSub">공휴일/연휴/휴무일이면 이렇게 막힐 수 있어</div>
                </div>
              ) : (
                <BlockList
                  blocks={bookedBlocks}
                  tone="danger"
                  emptyTitle="예약 없음"
                  emptySub="표시된 운영 시간은 모두 사용 가능"
                  metaLabel="예약"
                />
              )}
            </section>
          </>
        )}
      </main>

      <section className="recommendPanel">
        <div className="panelHead">
          <div>
            <div className="panelTitle">주변 축구장 추천</div>
            <div className="panelSub">예약 없는 순</div>
          </div>
          <button className="btn primary" onClick={loadRecommendations} disabled={recommendLoading}>
            추천 보기
          </button>
        </div>

        <div className="recommendGrid">
          <label className="field">
            <span className="fieldLabel">지역</span>
            <select className="facilitySelect" value={recommendArea} onChange={(e) => setRecommendArea(e.target.value)}>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="fieldLabel">날짜</span>
            <input
              className="date full"
              type="date"
              value={recommendDate}
              onChange={(e) => setRecommendDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="fieldLabel">시작</span>
            <select
              className="facilitySelect"
              value={recommendStart}
              onChange={(e) => setRecommendStart(e.target.value)}
            >
              {recommendTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {formatKoreanAmPm(time)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="fieldLabel">시간</span>
            <select
              className="facilitySelect"
              value={recommendHours}
              onChange={(e) => setRecommendHours(Number(e.target.value))}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}시간
                </option>
              ))}
            </select>
          </label>
        </div>

        {recommendError && <div className="error">{recommendError}</div>}

        {recommendations?.results?.length ? (
          <div className="recommendList">
            {recommendations.results.map((result) => {
              const isFavorite = favorites.includes(result.facility.id)
              return (
                <article
                  key={result.facility.id}
                  className={result.isFullyAvailable ? 'recommendItem best' : 'recommendItem'}
                >
                  <button
                    className={isFavorite ? 'miniStar active' : 'miniStar'}
                    onClick={() => toggleFavorite(result.facility.id)}
                    aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    {isFavorite ? '★' : '☆'}
                  </button>
                  <button
                    className="recommendMain"
                    onClick={() => {
                      setFacilityId(result.facility.id)
                      setDate(recommendations.date)
                    }}
                  >
                    <span className="recommendName">{facilityLabel(result.facility)}</span>
                    <span className="recommendMeta">
                      {formatKoreanAmPm(recommendations.startTime)}부터 {recommendations.hours}시간 ·{' '}
                      {resultLabel(result)}
                    </span>
                  </button>
                  <span className={result.isFullyAvailable ? 'statusPill ok' : 'statusPill'}>
                    {result.isFullyAvailable ? '추천' : resultLabel(result)}
                  </span>
                </article>
              )
            })}
          </div>
        ) : recommendations ? (
          <div className="empty">추천할 축구장이 없습니다.</div>
        ) : null}
      </section>

      <div className="madeBy">made by 김예준</div>

      <footer className="footer">
        <a href={data?.sourceUrl || 'https://www.ulsan.go.kr/'} target="_blank" rel="noreferrer">
          공식 예약 사이트 열기
        </a>
      </footer>
    </div>
  )
}
