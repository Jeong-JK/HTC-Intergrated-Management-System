import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Home, ShieldAlert, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Plus, X, UserX, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Modal, Btn, Field, inputCls } from '../components/Common.jsx'
import DatePicker from '../components/DatePicker.jsx'
import { goHub } from '../site.js'
import { TitleInput, useMonthWheel, dragStyle } from '../components/MonthNav.jsx'
import { setWorkLogUserColor, getWorkLogs, getWorkLogUsers, getWorkLogMissing, searchWorkLogs, createWorkLog, updateWorkLog, deleteWorkLog } from '../api.js'

const DATE_FMT = 'YYYY-MM-DD'
const MONTH_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_NAMES = 3 // 월간 칸에 표시할 최대 작성자 수

const mondayOf = (d) => d.subtract((d.day() + 6) % 7, 'day').startOf('day')

// 주차 표기는 그 주 목요일이 속한 달 기준
const weekLabel = (weekStart) => {
  const thu = weekStart.add(3, 'day')
  return `${thu.year()}년 ${thu.month() + 1}월 ${Math.ceil(thu.date() / 7)}주차`
}

const dayLabel = (d) => `${d.format('M/D')} (${MONTH_WEEKDAYS[d.day()]})`

// 사용자별 캘린더 색: 지정색(worklog_color) 없으면 id로 기본 팔레트에서
const PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#a855f7', '#14b8a6', '#ec4899', '#eab308', '#6366f1', '#0ea5e9', '#84cc16', '#64748b']
const userColor = (id, color) => color || PALETTE[id % PALETTE.length]
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
  const [showColors, setShowColors] = useState(false) // 직원별 색상 설정 창
  const [searchText, setSearchText] = useState('') // 입력 중인 검색어
  const [search, setSearch] = useState(null) // null | { q, rows, truncated, loading }

  useEffect(() => { document.title = '업무일지 캘린더 - HTC' }, [])

  useEffect(() => {
    if (blocked || !canManage) return
    getWorkLogUsers().then(r => setUsers(r.data.data)).catch(() => {})
  }, [blocked, canManage])

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
        <ColorModal users={users} onClose={() => setShowColors(false)}
          onSaved={() => { getWorkLogUsers().then(r => setUsers(r.data.data)).catch(() => {}); setReloadKey(k => k + 1) }} />
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

function MonthView({ month, range, byDay, today, onDayClick, onOpenWeek, onMore, onWheelStep }) {
  const boxRef = useRef(null)
  const gridRef = useRef(null)
  const drag = useMonthWheel(boxRef, gridRef, onWheelStep)
  const days = []
  for (let d = range[0]; !d.isAfter(range[1]); d = d.add(1, 'day')) days.push(d)

  return (
    <div ref={boxRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {MONTH_WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>{w}</div>
        ))}
      </div>
      <div
        ref={gridRef}
        className="grid grid-cols-7"
        style={dragStyle(drag)}
      >
        {days.map(d => {
          const key = d.format(DATE_FMT)
          const dayLogs = byDay[key] || []
          const inMonth = d.month() === month.month()
          const dow = d.day()
          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              className={`min-h-[80px] sm:min-h-[110px] border-b border-r border-slate-100 p-1.5 cursor-pointer hover:bg-blue-50/40 transition-colors ${inMonth ? '' : 'bg-slate-50/70'}`}
            >
              <div className={`text-xs font-medium mb-1 ${inMonth ? '' : 'opacity-40'}`}>
                <span className={key === today
                  ? 'inline-flex w-6 h-6 items-center justify-center rounded-full bg-blue-600 text-white'
                  : `inline-block px-1 ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-600'}`}>
                  {d.date()}
                </span>
              </div>
              <AuthorList logs={dayLogs} onPick={userId => onOpenWeek(key, userId)} onMore={onMore && (() => onMore(key))} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 날짜별 작성자 이름(직급), 넘치면 "외 N명" — 작성 여부는 모든 사용자에게 공개
function AuthorList({ logs, onPick, onMore }) {
  const authors = [...new Map(logs.map(l => [l.user_id, l])).values()]
  const shown = authors.length > MAX_NAMES ? authors.slice(0, MAX_NAMES - 1) : authors
  const rest = authors.length - shown.length
  if (!authors.length) return null
  return (
    <>
    <button onClick={e => { if (onMore) { e.stopPropagation(); onMore() } }}
      className="sm:hidden block w-full text-center text-[11px] font-semibold px-1 py-0.5 rounded bg-orange-50 text-orange-700">
      {authors.length}명
    </button>
    <div className="max-sm:hidden space-y-0.5">
      {shown.map(a => (
        <button
          key={a.user_id}
          onClick={e => { e.stopPropagation(); onPick(a.user_id) }}
          className="block w-full text-left truncate text-[11px] px-1.5 py-0.5 rounded hover:brightness-95"
          style={{ backgroundColor: userColor(a.user_id, a.user_color), color: textOn(userColor(a.user_id, a.user_color)) }}
        >
          {userLabel(a)}
        </button>
      ))}
      {rest > 0 && (onMore
        ? <button onClick={e => { e.stopPropagation(); onMore() }} className="text-[11px] text-orange-600 hover:underline px-1.5">외 {rest}명 · 일간 보기</button>
        : <div className="text-[11px] text-slate-400 px-1.5">외 {rest}명</div>)}
    </div>
    </>
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
                  style={{ borderLeft: `4px solid ${userColor(log.user_id, log.user_color)}` }}
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
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: userColor(userLogs[0].user_id, userLogs[0].user_color) }} />
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

function WorkLogModal({ log, date, me, isAdmin, canEditOwn, canDeleteOwn, users, defaultUserId, onClose, onSaved }) {
  const initialDate = date || dayjs().format(DATE_FMT)
  // 다른 사람 일지는 관리자만 수정/삭제 (업무일지관리자는 열람만)
  const own = !log || log.user_id === me.id
  const readOnly = !!log && !(isAdmin || (own && canEditOwn))
  const canDelete = !!log && (isAdmin || (own && canDeleteOwn))
  const [userId, setUserId] = useState(log?.user_id ?? defaultUserId ?? me.id)
  const [start, setStart] = useState(log?.start_date ?? initialDate)
  const [end, setEnd] = useState(log?.end_date ?? initialDate)
  const [items, setItems] = useState(() => {
    const list = log ? log.items.map(i => i.content) : []
    while (!readOnly && list.length < 3) list.push('')
    return list
  })
  const [saving, setSaving] = useState(false)

  const setItem = (idx, value) => setItems(items.map((v, i) => (i === idx ? value : v)))

  const handleSave = async () => {
    const contents = items.map(s => s.trim()).filter(Boolean)
    if (!start) return alert('시작일을 선택하세요')
    const endDate = end || start
    if (endDate < start) return alert('종료일이 시작일보다 빠릅니다')
    if (!contents.length) return alert('업무 내용을 1개 이상 입력하세요')

    const payload = { start_date: start, end_date: endDate, items: contents, user_id: userId }
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
    const msg = log.is_multi_day
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
      sub={readOnly ? '열람 전용입니다' : '기간을 지정하면 모든 날짜에 같은 업무가 등록됩니다'}
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
        {readOnly ? (
          <Field label="기간" full>
            <div className={`${inputCls} bg-slate-50`}>{start === end ? start : `${start} ~ ${end}`}</div>
          </Field>
        ) : (
          <>
            <Field label="시작일">
              <DatePicker value={start} onChange={v => { setStart(v); if (v && (!end || end < v)) setEnd(v) }} />
            </Field>
            <Field label="종료일">
              <DatePicker value={end} onChange={setEnd} />
            </Field>
          </>
        )}

        <Field label="업무 내용" full>
          <div className="space-y-2">
            {items.map((value, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="w-5 text-right text-xs text-slate-400 pt-2.5">{idx + 1}.</span>
                <textarea
                  rows={2}
                  value={value}
                  readOnly={readOnly}
                  onChange={e => setItem(idx, e.target.value)}
                  placeholder={readOnly ? '' : '업무 내용을 입력하세요'}
                  className={`${inputCls} resize-y ${readOnly ? 'bg-slate-50' : ''}`}
                />
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
                onClick={() => setItems([...items, ''])}
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

// 색상 표: 열 = 색상(빨 주 노 초 … 파 남 보 … 회색), 행 = 밝은 색 → 진한 색 (Tailwind 기본 색상 100~900)
const PICKER_ROWS = [
  ['#fee2e2', '#ffedd5', '#fef3c7', '#fef9c3', '#ecfccb', '#dcfce7', '#ccfbf1', '#cffafe', '#e0f2fe', '#dbeafe', '#e0e7ff', '#ede9fe', '#f3e8ff', '#fce7f3', '#f5f5f4', '#f1f5f9'],
  ['#fecaca', '#fed7aa', '#fde68a', '#fef08a', '#d9f99d', '#bbf7d0', '#99f6e4', '#a5f3fc', '#bae6fd', '#bfdbfe', '#c7d2fe', '#ddd6fe', '#e9d5ff', '#fbcfe8', '#e7e5e4', '#e2e8f0'],
  ['#fca5a5', '#fdba74', '#fcd34d', '#fde047', '#bef264', '#86efac', '#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f9a8d4', '#d6d3d1', '#cbd5e1'],
  ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#f472b6', '#a8a29e', '#94a3b8'],
  ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#78716c', '#64748b'],
  ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#4f46e5', '#7c3aed', '#9333ea', '#db2777', '#57534e', '#475569'],
  ['#b91c1c', '#c2410c', '#b45309', '#a16207', '#4d7c0f', '#15803d', '#0f766e', '#0e7490', '#0369a1', '#1d4ed8', '#4338ca', '#6d28d9', '#7e22ce', '#be185d', '#44403c', '#334155'],
  ['#991b1b', '#9a3412', '#92400e', '#854d0e', '#3f6212', '#166534', '#115e59', '#155e75', '#075985', '#1e40af', '#3730a3', '#5b21b6', '#6b21a8', '#9d174d', '#292524', '#1e293b'],
  ['#7f1d1d', '#7c2d12', '#78350f', '#713f12', '#365314', '#14532d', '#134e4a', '#164e63', '#0c4a6e', '#1e3a8a', '#312e81', '#4c1d95', '#581c87', '#831843', '#1c1917', '#0f172a'],
]

// 관리자/업무일지관리자: 직원별 캘린더 색 지정 (고르면 바로 저장)
function ColorModal({ users, onClose, onSaved }) {
  const [saving, setSaving] = useState(null)
  const [openFor, setOpenFor] = useState(null) // 색상 표를 펼친 직원
  const timer = useRef(null)

  const pick = async (u, color) => {
    setSaving(u.id)
    try {
      await setWorkLogUserColor(u.id, color)
      setOpenFor(null)
      onSaved()
    } catch (e) {
      alert(e.response?.data?.detail || '색상을 저장하지 못했습니다')
    } finally {
      setSaving(null)
    }
  }
  // 직접 지정: 고르는 동안 값이 계속 바뀌므로 멈춘 뒤 한 번만 저장
  const pickLater = (u, color) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => pick(u, color), 500)
  }

  return (
    <Modal title="직원별 캘린더 색상" sub="지정하지 않으면 기본 색이 자동으로 정해집니다" onClose={onClose} size="lg"
      footer={<Btn onClick={onClose}>닫기</Btn>}>
      <div className="divide-y divide-slate-100">
        {users.map(u => {
          const current = userColor(u.id, u.worklog_color)
          return (
            <div key={u.id} className={saving === u.id ? 'opacity-50' : ''}>
              <div className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-28 flex-shrink-0 text-sm font-medium text-slate-800 truncate">{userLabel(u)}</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: current, color: textOn(current) }}>{u.name}</span>
                <button onClick={() => setOpenFor(openFor === u.id ? null : u.id)} title="색상 표에서 고르기"
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border hover:bg-slate-50 ${openFor === u.id ? 'border-blue-400' : 'border-slate-200'}`}>
                  <span className="w-5 h-5 rounded" style={{ backgroundColor: current }} />
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                <input type="color" key={current} defaultValue={current} onChange={e => pickLater(u, e.target.value)} title="직접 지정"
                  className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0" />
                {u.worklog_color && (
                  <button onClick={() => pick(u, null)} className="text-xs text-slate-400 hover:text-slate-600">기본으로</button>
                )}
              </div>
              {openFor === u.id && (
                <div className="pb-3 overflow-x-auto">
                  <div className="inline-grid gap-0.5 p-2 rounded-lg border border-slate-200 bg-white shadow-sm"
                    style={{ gridTemplateColumns: `repeat(${PICKER_ROWS[0].length}, 1.25rem)` }}>
                    {PICKER_ROWS.flat().map((c, i) => (
                      <button key={i} onClick={() => pick(u, c)} title={c}
                        className={`w-5 h-5 transition-transform ${current === c ? 'ring-2 ring-offset-1 ring-slate-800' : 'hover:scale-125'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
