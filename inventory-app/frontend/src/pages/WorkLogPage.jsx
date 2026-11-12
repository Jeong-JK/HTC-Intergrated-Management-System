import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Home, ShieldAlert, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Plus, X, UserX, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Modal, Btn, Field, inputCls } from '../components/Common.jsx'
import DatePicker from '../components/DatePicker.jsx'
import { goHub } from '../site.js'
import { TitleInput, useMonthWheel, dragStyle } from '../components/MonthNav.jsx'
import { setWorkLogUserHue, getWorkLogPalette, getWorkLogs, getWorkLogUsers, getWorkLogMissing, searchWorkLogs, createWorkLog, updateWorkLog, deleteWorkLog, getWorkLogGroup } from '../api.js'

const DATE_FMT = 'YYYY-MM-DD'
const MONTH_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_NAMES = 3 // 월간 칸에 표시할 최대 막대 줄 수 (넘치면 '외 N명')

const mondayOf = (d) => d.subtract((d.day() + 6) % 7, 'day').startOf('day')

// 주차 표기는 그 주 목요일이 속한 달 기준
const weekLabel = (weekStart) => {
  const thu = weekStart.add(3, 'day')
  return `${thu.year()}년 ${thu.month() + 1}월 ${Math.ceil(thu.date() / 7)}주차`
}

const dayLabel = (d) => `${d.format('M/D')} (${MONTH_WEEKDAYS[d.day()]})`

// 배경 밝기에 맞춘 글자색 (밝으면 검정, 어두우면 흰색)
const textOn = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62 ? '#1e293b' : '#ffffff'
}
const userLabel = (u) => [u.name ?? u.user_name, u.position ?? u.user_position].filter(Boolean).join(' ')

// 기간형 일지를 날짜별로 펼침: { 'YYYY-MM-DD': [log, ...] }
function groupByDay(logs, from, to) {
  const map = {}
  logs.forEach(log => {
    let d = dayjs(log.start_date)
    const end = dayjs(log.end_date)
    if (d.isBefore(from)) d = from
    while (!d.isAfter(end) && !d.isAfter(to)) {
      const key = d.format(DATE_FMT)
      ;(map[key] = map[key] || []).push(log)
      d = d.add(1, 'day')
    }
  })
  return map
}

export default function WorkLogPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = !!user?.is_admin
  // 권한은 사용자 관리에서 부여 (관리자는 전부)
  const can = (field) => isAdmin || !!user?.[field]
  const canManage = can('can_manage_worklog') // 업무일지관리자: 타인 열람만
  const canWrite = can('can_write_worklog')
  const blocked = !can('can_access_worklog') // 접근 권한 없으면 차단

  // 'month' | 'week' | 'day'(일간, 관리자) | 'list'(직원별 상세, 관리자)
  const [view, setView] = useState(() => window.innerWidth < 640 ? 'week' : 'month') // 폰은 주간(내 일지 목록)으로 시작
  const [month, setMonth] = useState(dayjs().startOf('month')) // 월간/상세 기준 달
  const [weekStart, setWeekStart] = useState(mondayOf(dayjs()))
  const [day, setDay] = useState(dayjs().startOf('day'))
  const [targetUserId, setTargetUserId] = useState(user?.id) // 주간/상세 화면에서 볼 직원
  const [missing, setMissing] = useState([])
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null) // null | { log } | { date }
  const [reloadKey, setReloadKey] = useState(0)
  const [showColors, setShowColors] = useState(false) // 직원별 색 계열 설정 창
  const [palette, setPalette] = useState(null) // { hues: [{ key, name, shades[6] }], default_shade, my_hue }
  const [searchText, setSearchText] = useState('') // 입력 중인 검색어
  const [search, setSearch] = useState(null) // null | { q, rows, truncated, loading }

  useEffect(() => { document.title = '업무일지 캘린더 - HTC' }, [])

  useEffect(() => {
    if (blocked || !canManage) return
    getWorkLogUsers().then(r => setUsers(r.data.data)).catch(() => {})
  }, [blocked, canManage])

  const loadPalette = () => getWorkLogPalette().then(r => setPalette(r.data)).catch(() => {})
  useEffect(() => { if (!blocked) loadPalette() }, [blocked])

  // 화면 범위: 월간 = 달력에 보이는 전체 칸, 주간 = 월~일, 일간 = 하루, 상세 = 해당 달
  const range = useMemo(() => {
    if (view === 'week') return [weekStart, weekStart.add(6, 'day')]
    if (view === 'day') return [day, day]
    const last = month.endOf('month').startOf('day')
    if (view === 'list') return [month, last]
    return [month.subtract(month.day(), 'day'), last.add(6 - last.day(), 'day')]
  }, [view, month, weekStart, day])

  const personal = view === 'week' || view === 'list' // 한 사람 것만 보는 화면

  useEffect(() => {
    if (blocked) return
    const params = { start: range[0].format(DATE_FMT), end: range[1].format(DATE_FMT) }
    if (personal && targetUserId) params.user_id = targetUserId
    setLoading(true)
    getWorkLogs(params)
      .then(r => setLogs(r.data.data))
      .catch(e => alert(e.response?.data?.detail || '업무일지를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [range, targetUserId, reloadKey, blocked])

  const byDay = useMemo(() => groupByDay(logs, range[0], range[1]), [logs, range])

  // 미작성자: 일간 화면은 그 날짜, 나머지는 오늘 기준
  const missingDay = view === 'day' ? day : dayjs().startOf('day')
  const missingKey = missingDay.format(DATE_FMT)
  useEffect(() => {
    if (blocked) return
    getWorkLogMissing(missingKey).then(r => setMissing(r.data.data)).catch(() => setMissing([]))
  }, [missingKey, reloadKey, blocked])

  const runSearch = (e) => {
    e.preventDefault()
    const q = searchText.trim()
    if (!q) { setSearch(null); return }
    setSearch({ q, rows: [], truncated: false, loading: true })
    searchWorkLogs(q)
      .then(r => setSearch({ q, rows: r.data.data, truncated: r.data.truncated, loading: false }))
      .catch(err => { alert(err.response?.data?.detail || '검색하지 못했습니다'); setSearch(null) })
  }
  const clearSearch = () => { setSearch(null); setSearchText('') }

  const openDay = (date) => {
    setDay(dayjs(date).startOf('day'))
    setView('day')
  }

  // 화면 전환: 지금 보고 있는 날짜를 기준으로 이어서 보여줌
  const switchView = (next) => {
    const now = dayjs().startOf('day')
    const anchor = view === 'week' ? (now.isBefore(weekStart) || now.isAfter(weekStart.add(6, 'day')) ? weekStart : now)
      : view === 'day' ? day
      : (now.isSame(month, 'month') ? now : month)
    if (next === 'month' || next === 'list') setMonth(anchor.startOf('month'))
    if (next === 'week') setWeekStart(mondayOf(anchor))
    if (next === 'day') setDay(anchor)
    setView(next)
  }

  const openWeek = (date, userId) => {
    setWeekStart(mondayOf(dayjs(date)))
    if (userId) setTargetUserId(userId)
    setView('week')
  }

  // 월간 캘린더 이름 클릭: 본인 것은 누구나, 다른 사람 것은 업무일지관리자만
  const openAuthorWeek = (date, userId) => {
    if (userId !== user.id && !canManage) {
      alert('업무일지는 작성자 본인 및 관리자만 열람 가능합니다.')
      return
    }
    openWeek(date, userId)
  }

  // 빈 날짜 클릭 → 작성 (주간 화면에선 본인 주간일 때만, 관리자는 대리 작성 가능)
  const openNew = (date) => {
    if (!canWrite) return
    if (view === 'week' && targetUserId !== user.id && !isAdmin) return
    setEditing({ date })
  }

  const handleSaved = (saved) => {
    setEditing(null)
    setReloadKey(k => k + 1)
    if (saved) openWeek(saved.start_date, saved.user_id) // 신규 저장 → 해당 주간 화면으로
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-sm w-full">
          <ShieldAlert size={40} className="mx-auto text-red-500 mb-4" />
          <p className="text-lg font-bold text-slate-800">권한이 없습니다</p>
          <p className="text-sm text-slate-500 mt-1">관리자에게 문의하세요.</p>
          <button
            onClick={goHub}
            className="mt-6 px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            메인으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const today = dayjs().format(DATE_FMT)
  const navBtn = 'p-2 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-slate-600'

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button onClick={goHub} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
              <Home size={16} />
              메인으로
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <CalendarDays size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">업무일지 캘린더</h1>
                <p className="hidden sm:block text-sm text-slate-500">{canManage ? '전체 직원 업무일지' : '내 업무일지'}</p>
              </div>
            </div>
          </div>
          {canWrite && (
            <Btn variant="primary" className="max-sm:hidden" onClick={() => setEditing({ date: today })}>
              <Plus size={16} /> 업무일지 작성
            </Btn>
          )}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 pt-4 pb-24 sm:py-6">
        {/* 툴바 */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {(view === 'month' || view === 'list') && (
              <>
                <button className={navBtn} onClick={() => setMonth(month.subtract(1, 'month'))}><ChevronLeft size={16} /></button>
                <TitleInput type="month" value={month.format('YYYY-MM')} label={month.format('YYYY년 M월')}
                  onChange={d => setMonth(d.startOf('month'))} className="text-lg font-bold text-slate-800 min-w-[130px] text-center" />
                <button className={navBtn} onClick={() => setMonth(month.add(1, 'month'))}><ChevronRight size={16} /></button>
                <Btn onClick={() => setMonth(dayjs().startOf('month'))}>이번 달</Btn>
              </>
            )}
            {view === 'week' && (
              <>
                <button className={navBtn} onClick={() => setWeekStart(weekStart.subtract(1, 'week'))} title="이전 주"><ChevronLeft size={16} /></button>
                <div className="text-center min-w-[190px]">
                  <h2 className="text-lg font-bold text-slate-800">{weekLabel(weekStart)}</h2>
                  <p className="text-xs text-slate-500">{weekStart.format('M/D')} ~ {weekStart.add(4, 'day').format('M/D')}</p>
                </div>
                <button className={navBtn} onClick={() => setWeekStart(weekStart.add(1, 'week'))} title="다음 주"><ChevronRight size={16} /></button>
                <Btn onClick={() => setWeekStart(mondayOf(dayjs()))}>이번 주</Btn>
              </>
            )}
            {view === 'day' && (
              <>
                <button className={navBtn} onClick={() => setDay(day.subtract(1, 'day'))} title="전날"><ChevronLeft size={16} /></button>
                <TitleInput type="date" value={day.format(DATE_FMT)} label={`${day.format('YYYY년')} ${dayLabel(day)}`}
                  onChange={d => setDay(d.startOf('day'))} className="text-lg font-bold text-slate-800 min-w-[170px] text-center" />
                <button className={navBtn} onClick={() => setDay(day.add(1, 'day'))} title="다음날"><ChevronRight size={16} /></button>
                <Btn onClick={() => setDay(dayjs().startOf('day'))}>오늘</Btn>
              </>
            )}
            {loading && <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin ml-2" />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={runSearch} className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder={canManage ? '업무 내용 검색 (전체 직원)' : '내 업무 내용 검색'} maxLength={50}
                className="border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-sm bg-white w-44 sm:w-56 focus:outline-none focus:border-orange-400" />
              {searchText && (
                <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="검색 지우기">
                  <X size={14} />
                </button>
              )}
            </form>
            {personal && canManage && (
              <select
                value={targetUserId || ''}
                onChange={e => setTargetUserId(Number(e.target.value))}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700"
              >
                {users.map(u => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
              </select>
            )}
            {canManage && <Btn onClick={() => setShowColors(true)}>색상</Btn>}
            {/* 보기 전환: 일간/상세는 다른 사람 내용을 보는 화면이라 관리자/업무일지관리자만 */}
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
              {[['month', '월간'], ['week', '주간'], ...(canManage ? [['day', '일간'], ['list', '상세']] : [])].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={`px-3 py-1.5 border-l first:border-l-0 border-slate-200 ${view === v ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <MissingBanner day={missingDay} users={missing} />

        {search ? (
          <SearchView search={search} onClose={clearSearch}
            onPick={row => { clearSearch(); openAuthorWeek(row.start_date, row.user_id) }} />
        ) : (<>
        {view === 'month' && (
          <MonthView month={month} range={range} byDay={byDay} today={today}
            onDayClick={openNew} onOpenWeek={openAuthorWeek} onMore={canManage ? openDay : null}
            onWheelStep={dir => setMonth(m => m.add(dir, 'month'))} />
        )}
        {view === 'week' && (
          <WeekView weekStart={weekStart} byDay={byDay} today={today}
            onDayClick={openNew} onLogClick={log => setEditing({ log })} />
        )}
        {view === 'day' && (
          <DayView logs={byDay[day.format(DATE_FMT)] || []} onLogClick={log => setEditing({ log })} />
        )}
        {view === 'list' && (
          <ListView logs={logs} onLogClick={log => setEditing({ log })} />
        )}
        </>)}
      </div>

      {showColors && (
        <ColorModal users={users} palette={palette} onClose={() => setShowColors(false)}
          onSaved={() => { getWorkLogUsers().then(r => setUsers(r.data.data)).catch(() => {}); loadPalette(); setReloadKey(k => k + 1) }} />
      )}

      {canWrite && !editing && (
        <button onClick={() => setEditing({ date: today })} title="업무일지 작성"
          className="sm:hidden fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:bg-blue-700">
          <Plus size={26} />
        </button>
      )}

      {editing && (
        <WorkLogModal
          log={editing.log}
          date={editing.date}
          me={user}
          isAdmin={isAdmin}
          canEditOwn={can('can_edit_worklog')}
          canDeleteOwn={can('can_delete_worklog')}
          users={users}
          palette={palette}
          defaultUserId={isAdmin && personal ? targetUserId : user.id}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// 캘린더 위 미작성자 표시 (모든 사용자)
function MissingBanner({ day, users }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">
      <UserX size={16} className={`mt-0.5 flex-shrink-0 ${users.length ? 'text-red-500' : 'text-emerald-500'}`} />
      <span className="font-semibold text-slate-700 whitespace-nowrap">{dayLabel(day)} 미작성</span>
      {users.length
        ? <span className="text-slate-600">{users.map((u, i) => (
            <span key={u.id}>{i > 0 && ', '}<b className="font-semibold text-slate-800">{u.name}</b>{u.position && ` ${u.position}`}</span>
          ))} <span className="text-slate-400">({users.length}명)</span></span>
        : <span className="text-emerald-600">모두 작성했습니다</span>}
    </div>
  )
}

// 월간 막대(연속일정·하루짜리 공통): 날짜 줄(24px) 바로 아래부터 한 줄씩
const BAR_TOP = 30 // px — 칸 위 여백(6) + 날짜 줄(24)
const BAR_H = 18   // px — 막대 한 줄 높이

// 이 주에 걸친 일지 → 열 위치/길이 + 겹치지 않게 줄(lane) 배정
function weekBars(multi, week) {
  const first = week[0], last = week[week.length - 1]
  const bars = multi
    .map(log => {
      const s = dayjs(log.start_date), e = dayjs(log.end_date)
      if (e.isBefore(first, 'day') || s.isAfter(last, 'day')) return null
      const from = s.isBefore(first, 'day') ? first : s
      const to = e.isAfter(last, 'day') ? last : e
      return { log, col: from.diff(first, 'day'), span: to.diff(from, 'day') + 1,
               isStart: !s.isBefore(first, 'day'), isEnd: !e.isAfter(last, 'day') }
    })
    .filter(Boolean)
    .sort((a, b) => a.col - b.col || b.span - a.span)
  const laneEnds = [] // 줄마다 마지막으로 차지한 열
  for (const bar of bars) {
    let lane = laneEnds.findIndex(endCol => endCol < bar.col)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = bar.col + bar.span - 1
    bar.lane = lane
  }
  return { bars, lanes: laneEnds.length }
}

function MonthView({ month, range, byDay, today, onDayClick, onOpenWeek, onMore, onWheelStep }) {
  const boxRef = useRef(null)
  const gridRef = useRef(null)
  const drag = useMonthWheel(boxRef, gridRef, onWheelStep)
  const days = []
  for (let d = range[0]; !d.isAfter(range[1]); d = d.add(1, 'day')) days.push(d)
  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  // 막대로 그릴 것: 연속일정은 일지마다, 하루짜리는 사람당 하루 1개 (작성 여부는 모든 사용자에게 공개)
  const items = [...new Map(Object.values(byDay).flat()
    .map(l => [l.is_multi_day ? `m${l.id}` : `s${l.user_id}|${l.start_date}`, l])).values()]

  return (
    <div ref={boxRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {MONTH_WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>{w}</div>
        ))}
      </div>
      <div ref={gridRef} style={dragStyle(drag)}>
        {weeks.map(week => {
          const { bars } = weekBars(items, week)
          const hidden = Array(7).fill(0) // 줄이 넘쳐 안 보이는 막대 수 (칸별)
          for (const b of bars) if (b.lane >= MAX_NAMES) for (let i = b.col; i < b.col + b.span; i++) hidden[i]++
          return (
            <div key={week[0].format(DATE_FMT)} className="relative grid grid-cols-7">
              {week.map((d, i) => {
                const key = d.format(DATE_FMT)
                const inMonth = d.month() === month.month()
                const dow = d.day()
                return (
                  <div
                    key={key}
                    onClick={() => onDayClick(key)}
                    className={`min-h-[90px] sm:min-h-[110px] border-b border-r border-slate-100 p-1.5 cursor-pointer hover:bg-blue-50/40 transition-colors ${inMonth ? '' : 'bg-slate-50/70'}`}
                  >
                    <div className={`h-6 mb-1 text-xs font-medium ${inMonth ? '' : 'opacity-40'}`}>
                      <span className={key === today
                        ? 'inline-flex w-6 h-6 items-center justify-center rounded-full bg-blue-600 text-white'
                        : `inline-block px-1 ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-600'}`}>
                        {d.date()}
                      </span>
                    </div>
                    {hidden[i] > 0 && (
                      <div style={{ marginTop: MAX_NAMES * BAR_H }}>
                        {onMore
                          ? <button onClick={e => { e.stopPropagation(); onMore(key) }} className="text-[11px] text-slate-500 hover:underline px-1">외 {hidden[i]}명 · 일간 보기</button>
                          : <span className="text-[11px] text-slate-400 px-1">외 {hidden[i]}명</span>}
                      </div>
                    )}
                  </div>
                )
              })}
              {bars.filter(b => b.lane < MAX_NAMES).map(({ log, col, span, lane, isStart, isEnd }) => {
                const c = log.color
                return (
                  <button
                    key={log.id}
                    onClick={e => { e.stopPropagation(); onOpenWeek(log.start_date, log.user_id) }}
                    title={log.is_multi_day
                      ? `${userLabel(log)} · ${dayjs(log.start_date).format('M/D')} ~ ${dayjs(log.end_date).format('M/D')}`
                      : userLabel(log)}
                    className={`absolute truncate text-left text-[11px] font-medium px-1.5 hover:brightness-95 ${isStart ? 'rounded-l' : ''} ${isEnd ? 'rounded-r' : ''}`}
                    style={{
                      top: BAR_TOP + lane * BAR_H, height: BAR_H - 2, lineHeight: `${BAR_H - 2}px`,
                      left: `calc(${(col / 7) * 100}% + ${isStart ? 4 : 0}px)`,
                      width: `calc(${(span / 7) * 100}% - ${(isStart ? 4 : 0) + (isEnd ? 4 : 0)}px)`,
                      backgroundColor: c, color: textOn(c),
                    }}
                  >
                    {isStart ? userLabel(log) : `← ${userLabel(log)}`}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({ weekStart, byDay, today, onDayClick, onLogClick }) {
  const days = Array.from({ length: 5 }, (_, i) => weekStart.add(i, 'day')) // 월~금 (주말 제외)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {days.map(d => {
        const key = d.format(DATE_FMT)
        const dayLogs = byDay[key] || []
        return (
          <div key={key} className={`bg-white rounded-xl border shadow-sm flex flex-col min-h-[100px] sm:min-h-[160px] lg:min-h-[420px] ${key === today ? 'border-blue-400' : 'border-slate-200'}`}>
            <div className="px-3 py-2 border-b border-slate-100 text-sm font-semibold text-slate-700">
              {MONTH_WEEKDAYS[d.day()]} <span className="font-normal text-slate-500">{d.format('M/D')}</span>
              {key === today && <span className="ml-1.5 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">오늘</span>}
            </div>
            <div className="flex-1 p-2 space-y-2 cursor-pointer hover:bg-slate-50/60" onClick={() => onDayClick(key)}>
              {dayLogs.map(log => (
                <div
                  key={log.id}
                  onClick={e => { e.stopPropagation(); onLogClick(log) }}
                  className="rounded-lg border border-slate-200 bg-white p-2 hover:border-blue-300 hover:shadow-sm transition-all"
                  style={{ borderLeft: `4px solid ${log.color}` }}
                >
                  <LogItems log={log} />
                </div>
              ))}
              {!dayLogs.length && <div className="text-center text-slate-300 text-xs pt-6"><Plus size={14} className="inline" /> 작성</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 기간 배지 + 항목 목록 (주간/일간/상세 공용)
function LogItems({ log }) {
  return (
    <>
      {!!log.is_multi_day && (
        <div className="text-[10px] text-orange-600 font-medium mb-1">
          기간 {dayjs(log.start_date).format('M/D')} ~ {dayjs(log.end_date).format('M/D')}
        </div>
      )}
      <ol className="space-y-1">
        {log.items.map(it => (
          <li key={it.id} className="text-sm text-slate-700 whitespace-pre-wrap break-words">
            <span className="text-slate-400 mr-1">{it.item_order}.</span>{it.content}
          </li>
        ))}
      </ol>
    </>
  )
}

const Empty = ({ text }) => (
  <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-sm text-slate-400">{text}</div>
)

// 일간: 그날 작성한 전원의 업무를 사람별 카드로
function DayView({ logs, onLogClick }) {
  if (!logs.length) return <Empty text="이 날짜에 작성된 업무일지가 없습니다" />
  const byUser = [...logs.reduce((m, l) => m.set(l.user_id, [...(m.get(l.user_id) || []), l]), new Map()).values()]
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {byUser.map(userLogs => (
        <div key={userLogs[0].user_id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-100 font-semibold text-slate-800 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: userLogs[0].user_color }} />
            {userLabel(userLogs[0])}
          </div>
          <div className="p-3 space-y-2">
            {userLogs.map(log => (
              <div key={log.id} onClick={() => onLogClick(log)}
                className="rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                <LogItems log={log} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// 상세: 선택한 직원의 한 달 업무일지를 날짜순으로
function ListView({ logs, onLogClick }) {
  if (!logs.length) return <Empty text="이 달에 작성된 업무일지가 없습니다" />
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
      {logs.map(log => {
        const start = dayjs(log.start_date)
        return (
          <div key={log.id} onClick={() => onLogClick(log)} className="flex gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50">
            <div className="w-32 flex-shrink-0 text-sm font-semibold text-slate-700">
              {dayLabel(start)}
              {!!log.is_multi_day && <div className="text-xs font-normal text-orange-600">~ {dayLabel(dayjs(log.end_date))}</div>}
            </div>
            <div className="flex-1">
              <LogItems log={{ ...log, is_multi_day: false }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 검색어 강조 (대소문자 무시)
function Highlight({ text, q }) {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp('(' + escaped + ')', 'gi'))
  return parts.map((p, i) => i % 2 ? <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-0.5">{p}</mark> : p)
}

// 검색 결과: 날짜별 묶음 → 작성자 · 검색어가 들어간 줄
function SearchView({ search, onClose, onPick }) {
  const { q, rows, truncated, loading } = search
  const groups = []
  for (const row of rows) {
    const key = `${row.start_date}~${row.end_date}`
    if (groups[groups.length - 1]?.key !== key) groups.push({ key, row, items: [] })
    groups[groups.length - 1].items.push(row)
  }
  const fmt = d => `${dayjs(d).format('YYYY.MM.DD')} (${MONTH_WEEKDAYS[dayjs(d).day()]})`
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="text-sm text-slate-700">
          <span className="font-semibold text-orange-600">"{q}"</span> 검색 결과
          {!loading && <span className="text-slate-500"> · {rows.length}줄{truncated && ' (최근 것만 표시, 검색어를 더 구체적으로)'}</span>}
        </div>
        <Btn onClick={onClose}><X size={14} /> 달력으로</Btn>
      </div>
      {loading ? (
        <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" /></div>
      ) : !rows.length ? (
        <div className="py-16 text-center text-sm text-slate-400">검색 결과가 없습니다</div>
      ) : groups.map(g => (
        <div key={g.key}>
          <div className="px-4 py-2 bg-slate-100 border-y border-slate-200 text-sm font-bold text-slate-800">
            {fmt(g.row.start_date)}
            {!!g.row.is_multi_day && <span className="font-normal text-orange-600"> ~ {fmt(g.row.end_date)}</span>}
          </div>
          {g.items.map((row, i) => (
            <div key={row.id} onClick={() => onPick(row)} title="이 주 업무일지로 이동"
              className="flex gap-4 px-4 py-2 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-orange-50">
              <div className="w-32 flex-shrink-0 text-sm font-medium text-slate-700">
                {(i === 0 || g.items[i - 1].user_id !== row.user_id) && userLabel(row)}
              </div>
              <div className="flex-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                <Highlight text={row.content} q={q} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function WorkLogModal({ log, date, me, isAdmin, canEditOwn, canDeleteOwn, users, palette, defaultUserId, onClose, onSaved }) {
  const initialDate = date || dayjs().format(DATE_FMT)
  // 다른 사람 일지는 관리자만 수정/삭제 (업무일지관리자는 열람만)
  const own = !log || log.user_id === me.id
  const readOnly = !!log && !(isAdmin || (own && canEditOwn))
  const canDelete = !!log && (isAdmin || (own && canDeleteOwn))
  const [userId, setUserId] = useState(log?.user_id ?? defaultUserId ?? me.id)
  // 일지 날짜 = 항목 날짜 기본값. 항목 start/end 가 null 이면 이 날짜 하루, 값이 있으면 그 항목만의 기간
  const [start, setStart] = useState(log ? (log.start_date === log.end_date ? log.start_date : initialDate) : initialDate)
  const [items, setItems] = useState(() => {
    const own = log && log.start_date !== log.end_date ? { start: log.start_date, end: log.end_date } : { start: null, end: null }
    const list = log ? log.items.map(i => ({ content: i.content, ...own })) : []
    while (!readOnly && list.length < 3) list.push({ content: '', start: null, end: null })
    return list
  })
  const [lines, setLines] = useState(1) // 같이 작성한 줄(기간) 수 — 삭제 안내용
  // 수정/보기: 같이 작성한 항목 전체를 불러옴 (기간이 다른 항목은 캘린더에서 다른 줄)
  useEffect(() => {
    if (!log) return
    getWorkLogGroup(log.id).then(({ data }) => {
      const singles = data.data.filter(i => i.start_date === i.end_date).map(i => i.start_date).sort()
      const base = singles[0] ?? log.start_date
      setStart(base)
      setLines(data.lines)
      setItems(data.data.map(i => i.start_date === base && i.end_date === base
        ? { content: i.content, start: null, end: null }
        : { content: i.content, start: i.start_date, end: i.end_date }))
    }).catch(() => {})
  }, [])
  const [saving, setSaving] = useState(false)
  const [shade, setShade] = useState(log?.color_shade ?? null) // null = 기본 단계
  // 색은 작성자 계열 안에서만: 작성자를 안 바꿨으면 그 일지의 계열, 아니면 직원 목록/내 계열
  const ownerHue = log && log.user_id === userId ? log.user_hue
    : users.find(u => u.id === userId)?.hue ?? (userId === me.id ? palette?.my_hue : null)
  const hueInfo = palette?.hues.find(h => h.key === ownerHue)
  const shadeIdx = shade ?? palette?.default_shade ?? 2

  const setItem = (idx, patch) => setItems(items.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  const rangeText = (it) => it.start === it.end ? it.start : `${it.start} ~ ${it.end}`

  const handleSave = async () => {
    if (!start) return alert('날짜를 선택하세요')
    const list = items.filter(it => it.content.trim())
      .map(it => ({ content: it.content.trim(), start_date: it.start || start, end_date: it.end || it.start || start }))
    if (list.some(it => it.end_date < it.start_date)) return alert('종료일이 시작일보다 빠른 항목이 있습니다')
    if (!list.length) return alert('업무 내용을 1개 이상 입력하세요')

    const payload = { start_date: start, items: list, user_id: userId, color_shade: shade }
    setSaving(true)
    try {
      if (log) {
        await updateWorkLog(log.id, payload)
        onSaved(null)
      } else {
        await createWorkLog(payload)
        onSaved(payload)
      }
    } catch (e) {
      alert(e.response?.data?.detail || '저장에 실패했습니다')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const msg = lines > 1
      ? `같이 작성한 항목 전체(캘린더 ${lines}줄)가 삭제됩니다. 삭제하시겠습니까?`
      : log.is_multi_day
        ? `기간(${log.start_date} ~ ${log.end_date}) 전체 업무일지가 삭제됩니다. 삭제하시겠습니까?`
        : '이 업무일지를 삭제하시겠습니까?'
    if (!confirm(msg)) return
    try {
      await deleteWorkLog(log.id)
      onSaved(null)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    }
  }

  return (
    <Modal
      title={readOnly ? '업무일지 보기' : log ? '업무일지 수정' : '업무일지 작성'}
      sub={readOnly ? '열람 전용입니다' : '항목마다 기간을 따로 지정할 수 있습니다 (기본은 위 날짜 하루)'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {canDelete && <Btn variant="red" onClick={handleDelete} disabled={saving}>삭제</Btn>}
          <div className="flex-1" />
          <Btn onClick={onClose}>{readOnly ? '닫기' : '취소'}</Btn>
          {!readOnly && <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Btn>}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="작성자" full>
          {isAdmin && !readOnly ? (
            <select value={userId} onChange={e => setUserId(Number(e.target.value))} className={inputCls}>
              {users.map(u => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
            </select>
          ) : (
            <div className={`${inputCls} bg-slate-50`}>{log ? userLabel(log) : me.name}</div>
          )}
        </Field>
        <Field label="날짜" full>
          {readOnly
            ? <div className={`${inputCls} bg-slate-50`}>{start}</div>
            : <div className="w-44"><DatePicker value={start} onChange={setStart} /></div>}
        </Field>

        {hueInfo && (
          <Field label="캘린더 색상" full>
            <div className="flex items-center gap-2">
              {hueInfo.shades.map((c, i) => (!readOnly || i === shadeIdx) && (
                <button key={i} type="button" disabled={readOnly} onClick={() => setShade(i)} title={`${i + 1}단계`}
                  className={`w-8 h-8 rounded-lg transition-transform disabled:cursor-default ${i === shadeIdx ? 'ring-2 ring-offset-2 ring-slate-700' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <span className="text-xs text-slate-400 ml-1">{hueInfo.name} 계열</span>
            </div>
          </Field>
        )}

        <Field label="업무 내용" full>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="w-5 text-right text-xs text-slate-400 pt-2.5">{idx + 1}.</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <textarea
                    rows={2}
                    value={it.content}
                    readOnly={readOnly}
                    onChange={e => setItem(idx, { content: e.target.value })}
                    placeholder={readOnly ? '' : '업무 내용을 입력하세요'}
                    className={`${inputCls} resize-y ${readOnly ? 'bg-slate-50' : ''}`}
                  />
                  {it.start ? (readOnly ? (
                    <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">{rangeText(it)}</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-36"><DatePicker value={it.start}
                        onChange={v => setItem(idx, v ? { start: v, end: it.end < v ? v : it.end } : { start: null, end: null })} /></div>
                      <span>~</span>
                      <div className="w-36"><DatePicker value={it.end} onChange={v => setItem(idx, { end: v || it.start })} /></div>
                      <button type="button" onClick={() => setItem(idx, { start: null, end: null })}
                        className="px-2 py-1 rounded hover:bg-slate-100 text-slate-500">기본 날짜로</button>
                    </div>
                  )) : !readOnly && (
                    <button type="button" onClick={() => setItem(idx, { start: start, end: start })}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600">
                      <CalendarDays size={12} /> {start || '날짜'} 하루 · 기간 따로 지정
                    </button>
                  )}
                </div>
                {!readOnly && items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="항목 삭제"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setItems([...items, { content: '', start: null, end: null }])}
                className="ml-7 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={14} /> 항목 추가
              </button>
            )}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

// 관리자/업무일지관리자: 직원별 색 계열 지정 (한 사람당 하나, 서로 겹치지 않게). 일지 색은 작성자가 그 계열 안에서 고름
function ColorModal({ users, palette, onClose, onSaved }) {
  const [saving, setSaving] = useState(null)
  if (!palette) return null
  const ownerOf = Object.fromEntries(users.map(u => [u.hue, u]))

  const pick = async (u, hue) => {
    setSaving(u.id)
    try {
      await setWorkLogUserHue(u.id, hue)
      onSaved()
    } catch (e) {
      alert(e.response?.data?.detail || '색 계열을 저장하지 못했습니다')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Modal title="직원별 색 계열" sub="일지 색은 작성자가 자기 계열 안에서 고릅니다 · 다른 사람이 쓰는 계열은 고를 수 없습니다"
      onClose={onClose} size="lg" footer={<Btn onClick={onClose}>닫기</Btn>}>
      <div className="divide-y divide-slate-100">
        {users.map(u => (
          <div key={u.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${saving === u.id ? 'opacity-50' : ''}`}>
            <span className="w-28 flex-shrink-0 text-sm font-medium text-slate-800 truncate">{userLabel(u)}</span>
            <span className="w-12 flex-shrink-0 text-xs text-slate-500">{palette.hues.find(h => h.key === u.hue)?.name}</span>
            <div className="flex flex-wrap gap-1.5">
              {palette.hues.map(h => {
                const mine = h.key === u.hue
                const owner = ownerOf[h.key]
                const taken = !!owner && !mine
                return (
                  <button key={h.key} disabled={taken || mine} onClick={() => pick(u, h.key)}
                    title={taken ? `${h.name} — ${owner.name} 사용 중` : h.name}
                    className={`w-6 h-6 rounded-md transition-transform ${mine ? 'ring-2 ring-offset-1 ring-slate-800' : taken ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110'}`}
                    style={{ backgroundColor: h.shades[palette.default_shade] }} />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
