import { useState, useEffect } from 'react'
import { getCalendar } from '../api.js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal, Btn } from '../components/Common.jsx'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = [
  '#EF4444', // 1. 빨강 (red-500)
  '#F97316', // 2. 주황 (orange-500)
  '#EAB308', // 3. 노랑 (yellow-500)
  '#22C55E', // 4. 초록 (green-500)
  '#3B82F6', // 5. 파랑 (blue-500)
  '#4F46E5', // 6. 남색 (indigo-600)
  '#A855F7', // 7. 보라 (purple-500)
]

export default function CalendarPage() {
  const [current, setCurrent] = useState(dayjs())
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRental, setSelectedRental] = useState(null)
  const [viewMode, setViewMode] = useState('month') // 'month' or 'week'
  const [selectedUndecidedCompany, setSelectedUndecidedCompany] = useState(null) // 미정 업체 상세보기

  useScrollRestore('calendar', [rentals])

  useEffect(() => {
    setLoading(true)
    getCalendar(current.year(), current.month() + 1)
      .then(r => setRentals(r.data))
      .finally(() => setLoading(false))
  }, [current])

  const year = current.year()
  const month = current.month()

  // 업체 + 기간별로 대여 그룹화 (펼친 상태용)
  const groupRentalsByBorrowerAndPeriod = () => {
    const grouped = {}

    rentals.forEach(rental => {
      const key = `${rental.borrower}-${rental.rent_date}-${rental.expected_return || 'none'}`

      if (!grouped[key]) {
        grouped[key] = {
          borrower: rental.borrower,
          contact_name: rental.contact_name,
          rent_date: rental.rent_date,
          expected_return: rental.expected_return,
          returned_at: rental.returned_at,
          items: []
        }
      }

      grouped[key].items.push({
        rental_id: rental.rental_id,
        item_name: rental.item_name,
        quantity: rental.quantity
      })
    })

    return Object.values(grouped)
  }

  // 업체별로만 그룹화 (접힌 상태용)
  const groupRentalsByBorrowerOnly = () => {
    const grouped = {}

    rentals.forEach(rental => {
      const borrower = rental.borrower

      if (!grouped[borrower]) {
        grouped[borrower] = {
          borrower: borrower,
          periods: [], // 기간별 대여 목록
          allItems: []
        }
      }

      // 기간별로 구분
      const periodKey = `${rental.rent_date}-${rental.expected_return || 'none'}`
      let period = grouped[borrower].periods.find(p => p.key === periodKey)

      if (!period) {
        period = {
          key: periodKey,
          rent_date: rental.rent_date,
          expected_return: rental.expected_return,
          returned_at: rental.returned_at,
          contact_name: rental.contact_name,
          items: []
        }
        grouped[borrower].periods.push(period)
      }

      period.items.push({
        rental_id: rental.rental_id,
        item_name: rental.item_name,
        quantity: rental.quantity
      })

      grouped[borrower].allItems.push({
        rental_id: rental.rental_id,
        item_name: rental.item_name,
        quantity: rental.quantity
      })
    })

    // 각 업체의 periods를 날짜순 정렬
    Object.values(grouped).forEach(company => {
      company.periods.sort((a, b) => a.rent_date.localeCompare(b.rent_date))
    })

    return Object.values(grouped)
  }

  const groupedRentals = groupRentalsByBorrowerAndPeriod()
  const companyGroups = groupRentalsByBorrowerOnly()

  // 반납예정일 미정인 대여들 분리
  const undecidedRentals = groupedRentals.filter(r => !r.expected_return && !r.returned_at)

  // 미정 대여들을 업체별로 그룹화
  const groupUndecidedByCompany = () => {
    const grouped = {}
    undecidedRentals.forEach(rental => {
      const borrower = rental.borrower
      if (!grouped[borrower]) {
        grouped[borrower] = {
          borrower,
          rentals: [],
          allItems: [],
          totalItemCount: 0
        }
      }
      grouped[borrower].rentals.push(rental)
      rental.items.forEach(item => {
        grouped[borrower].allItems.push({
          ...item,
          rent_date: rental.rent_date,
          contact_name: rental.contact_name
        })
        grouped[borrower].totalItemCount += item.quantity || 1
      })
    })
    return Object.values(grouped)
  }
  const undecidedByCompany = groupUndecidedByCompany()

  const decidedCompanyGroups = companyGroups.map(company => ({
    ...company,
    periods: company.periods.filter(p => p.expected_return && !p.returned_at) // 반납완료된 건 제외
  })).filter(company => company.periods.length > 0)

  // 업체별 색상 매핑 (캘린더에 표시되는 업체만)
  const decidedCompanies = decidedCompanyGroups.map(g => g.borrower)
  const colorMap = Object.fromEntries(decidedCompanies.map((c, i) => [c, COLORS[i % COLORS.length]]))

  // 달력 생성
  const firstDay = dayjs(new Date(year, month, 1))
  const lastDay = firstDay.endOf('month')
  const startWeekday = firstDay.day() // 0(일) ~ 6(토)
  const daysInMonth = lastDay.date()

  // 달력 셀 생성 (이전 달 + 현재 달 + 다음 달)
  const calendarDays = []

  // 이전 달 날짜들
  const prevMonthLastDay = firstDay.subtract(1, 'day')
  for (let i = startWeekday - 1; i >= 0; i--) {
    calendarDays.push({
      date: prevMonthLastDay.subtract(i, 'day'),
      isCurrentMonth: false
    })
  }

  // 현재 달 날짜들
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      date: dayjs(new Date(year, month, d)),
      isCurrentMonth: true
    })
  }

  // 다음 달 날짜들 (6주 = 42일로 맞춤)
  const remainingDays = 42 - calendarDays.length
  for (let d = 1; d <= remainingDays; d++) {
    calendarDays.push({
      date: lastDay.add(d, 'day'),
      isCurrentMonth: false
    })
  }

  // 각 날짜에 해당하는 대여 정보 찾기 (현재 대여중인 것만)
  const getRentalsForDate = (date) => {
    const result = []

    decidedCompanyGroups.forEach(company => {
      company.periods.forEach(period => {
        const rentDate = dayjs(period.rent_date)
        const returnDate = dayjs(period.expected_return)

        const isAfterRentDate = date.isSame(rentDate, 'day') || date.isAfter(rentDate, 'day')
        const isBeforeReturnDate = date.isSame(returnDate, 'day') || date.isBefore(returnDate, 'day')

        if (isAfterRentDate && isBeforeReturnDate) {
          result.push({
            borrower: company.borrower,
            contact_name: period.contact_name,
            rent_date: period.rent_date,
            expected_return: period.expected_return,
            items: period.items
          })
        }
      })
    })

    return result
  }

  // 대여 막대가 어느 위치에 있는지 확인 (시작/중간/끝)
  const getRentalPosition = (rental, date) => {
    const rentDate = dayjs(rental.rent_date)
    const returnDate = rental.expected_return ? dayjs(rental.expected_return) : null

    const isStart = date.isSame(rentDate, 'day')
    const isEnd = returnDate && date.isSame(returnDate, 'day')

    return { isStart, isEnd }
  }

  // 주 단위로 그룹화
  const weeks = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7))
  }

  // 주간 뷰용 날짜 계산
  const getWeekDays = () => {
    const startOfWeek = current.day(0) // 일요일
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push({
        date: startOfWeek.add(i, 'day'),
        isCurrentMonth: true
      })
    }
    return days
  }

  const weekDays = getWeekDays()

  const today = dayjs()

  // 대여 상세 정보 모달 열기
  const handleRentalClick = (rental) => {
    setSelectedRental(rental)
  }

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">대여 캘린더</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="bg-blue-600 text-white text-lg font-bold px-3 py-1 rounded">
              {viewMode === 'month'
                ? current.format('YYYY년 MM월')
                : `${weekDays[0].date.format('YYYY.MM.DD')} ~ ${weekDays[6].date.format('MM.DD')}`
              }
            </span>
            <span className="text-slate-600 text-sm">
              {decidedCompanyGroups.length}개 업체 · {groupedRentals.length - undecidedRentals.length}개 기간
              {undecidedRentals.length > 0 && <span className="text-orange-500 font-medium ml-1">+ 미정 {undecidedRentals.length}건</span>}
            </span>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {/* 뷰 모드 전환 */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              월간
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              주간
            </button>
          </div>

          {/* 네비게이션 */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setCurrent(c => viewMode === 'month' ? c.subtract(1, 'month') : c.subtract(1, 'week'))}
              className="p-2 rounded border border-border text-dim hover:text-text transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrent(dayjs())}
              className="px-3 py-1.5 rounded border border-border text-dim hover:text-text text-sm transition-colors"
            >
              오늘
            </button>
            <button
              onClick={() => setCurrent(c => viewMode === 'month' ? c.add(1, 'month') : c.add(1, 'week'))}
              className="p-2 rounded border border-border text-dim hover:text-text transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 반납예정일 미정 대여 (상단 고정) - 업체별 그룹화 */}
      {undecidedByCompany.length > 0 && (
        <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
            <h3 className="font-bold text-amber-800">반납예정일 미정 ({undecidedByCompany.length}개 업체, 총 {undecidedRentals.length}건)</h3>
            <span className="text-xs text-amber-600">더블클릭하여 상세정보 보기</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {undecidedByCompany.map((company, idx) => (
              <div
                key={idx}
                className="bg-white border border-amber-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-50 transition-colors select-none"
                onDoubleClick={() => setSelectedUndecidedCompany(company)}
                title="더블클릭해서 상세정보 보기"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{company.borrower}</span>
                  <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                    {company.rentals.length}건
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  품목 {company.allItems.length}개 (총 {company.totalItemCount}개)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 범례 */}
      {decidedCompanyGroups.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {decidedCompanyGroups.map(company => (
            <div
              key={company.borrower}
              className="rounded-lg px-3 py-1.5 flex items-center gap-2 bg-slate-50 border border-slate-200"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: colorMap[company.borrower] }}
              />
              <span className="text-sm font-medium text-text">
                {company.borrower}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 달력 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-3 text-center text-sm font-semibold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        {loading && (
          <div className="p-8 text-center text-dim">로딩 중...</div>
        )}

        {!loading && viewMode === 'month' && (
          <div>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 border-b border-slate-100 last:border-0">
                {week.map((day, dayIdx) => {
                  const dayRentals = getRentalsForDate(day.date)
                  const isToday = day.date.isSame(today, 'day')
                  const isWeekend = dayIdx === 0 || dayIdx === 6

                  return (
                    <div
                      key={day.date.format('YYYY-MM-DD')}
                      className={`min-h-[140px] p-2.5 border-r border-slate-100 last:border-r-0 ${
                        !day.isCurrentMonth ? 'bg-slate-50/50' : ''
                      } transition-colors relative`}
                    >
                      <div
                        className={`text-base font-semibold mb-2 ${
                          !day.isCurrentMonth
                            ? 'text-slate-300'
                            : isToday
                            ? 'bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center'
                            : isWeekend && dayIdx === 0
                            ? 'text-red-500'
                            : isWeekend && dayIdx === 6
                            ? 'text-blue-500'
                            : 'text-slate-700'
                        }`}
                      >
                        {day.date.date()}
                      </div>

                      {/* 대여 막대 (연속된 느낌으로) */}
                      <div className="space-y-1.5 mt-2">
                        {dayRentals.slice(0, 6).map((rental, idx) => {
                          const { isStart, isEnd } = getRentalPosition(rental, day.date)

                          // 둥근 모서리 결정 (시작일과 끝일에만)
                          const roundedLeft = isStart
                          const roundedRight = isEnd

                          return (
                            <div
                              key={idx}
                              className="text-xs px-2 py-1 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: colorMap[rental.borrower],
                                borderTopLeftRadius: roundedLeft ? '5px' : '0',
                                borderBottomLeftRadius: roundedLeft ? '5px' : '0',
                                borderTopRightRadius: roundedRight ? '5px' : '0',
                                borderBottomRightRadius: roundedRight ? '5px' : '0',
                                marginLeft: roundedLeft ? '0' : '-2px',
                                marginRight: roundedRight ? '0' : '-2px',
                                paddingLeft: roundedLeft ? '8px' : '10px',
                                paddingRight: roundedRight ? '8px' : '10px'
                              }}
                              onClick={() => handleRentalClick(rental)}
                              title={`${rental.borrower} - ${rental.items.length}개 품목 (${rental.rent_date} ~ ${rental.expected_return})`}
                            >
                              {isStart && rental.borrower}
                            </div>
                          )
                        })}
                        {dayRentals.length > 6 && (
                          <div className="text-xs text-slate-400 pl-1 font-medium">
                            +{dayRentals.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* 주간 뷰 */}
        {!loading && viewMode === 'week' && (
          <div className="grid grid-cols-7">
            {weekDays.map((day, dayIdx) => {
              const dayRentals = getRentalsForDate(day.date)
              const isToday = day.date.isSame(today, 'day')
              const isWeekend = dayIdx === 0 || dayIdx === 6

              return (
                <div
                  key={day.date.format('YYYY-MM-DD')}
                  className={`min-h-[400px] p-3 border-r border-slate-100 last:border-r-0 ${
                    isToday ? 'bg-blue-50/30' : ''
                  } transition-colors`}
                >
                  <div
                    className={`text-base font-semibold mb-3 pb-2 border-b border-slate-200 ${
                      isToday
                        ? 'text-blue-600'
                        : isWeekend && dayIdx === 0
                        ? 'text-red-500'
                        : isWeekend && dayIdx === 6
                        ? 'text-blue-500'
                        : 'text-slate-700'
                    }`}
                  >
                    {day.date.date()}일
                    {isToday && <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">오늘</span>}
                  </div>

                  {/* 대여 목록 (주간 뷰에서는 모든 대여 표시) */}
                  <div className="space-y-2">
                    {dayRentals.map((rental, idx) => {
                      const { isStart, isEnd } = getRentalPosition(rental, day.date)

                      return (
                        <div
                          key={idx}
                          className="rounded-lg p-2.5 cursor-pointer hover:opacity-90 transition-all shadow-sm border-l-4"
                          style={{
                            backgroundColor: `${colorMap[rental.borrower]}15`,
                            borderLeftColor: colorMap[rental.borrower]
                          }}
                          onClick={() => handleRentalClick(rental)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="font-semibold text-sm text-slate-800 flex-1">
                              {rental.borrower}
                            </div>
                            {isStart && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                시작
                              </span>
                            )}
                            {isEnd && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                                종료
                              </span>
                            )}
                          </div>
                          {rental.contact_name && (
                            <div className="text-xs text-slate-600 mb-1">
                              담당: {rental.contact_name}
                            </div>
                          )}
                          <div className="text-xs text-slate-500">
                            품목 {rental.items.length}개
                          </div>
                          <div className="text-xs text-slate-400 mono mt-1">
                            {rental.rent_date} ~ {rental.expected_return}
                          </div>
                        </div>
                      )
                    })}
                    {dayRentals.length === 0 && (
                      <div className="text-xs text-slate-400 text-center py-8">
                        대여 없음
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 대여 상세정보 모달 */}
      {selectedRental && (
        <Modal
          title={`${selectedRental.borrower} 대여 상세정보`}
          onClose={() => setSelectedRental(null)}
          size="lg"
          footer={
            <Btn onClick={() => setSelectedRental(null)} className="flex-1 justify-center">
              닫기
            </Btn>
          }
        >
          <div className="space-y-4">
            {/* 대여 기본 정보 */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: colorMap[selectedRental.borrower] }} />
                <span className="font-semibold text-base">{selectedRental.borrower}</span>
              </div>
              {selectedRental.contact_name && (
                <div>
                  <span className="text-dim">담당자:</span>
                  <span className="ml-2 font-medium">{selectedRental.contact_name}</span>
                </div>
              )}
              <div>
                <span className="text-dim">대여일:</span>
                <span className="ml-2 font-medium mono">{selectedRental.rent_date}</span>
              </div>
              <div>
                <span className="text-dim">반납예정:</span>
                <span className="ml-2 font-medium mono">{selectedRental.expected_return || '미정'}</span>
              </div>
              {selectedRental.returned_at && (
                <div>
                  <span className="text-dim">실제반납:</span>
                  <span className="ml-2 font-medium mono text-green-600">{selectedRental.returned_at}</span>
                </div>
              )}
            </div>

            {/* 대여 품목 목록 */}
            <div>
              <h3 className="font-semibold text-sm text-text mb-2">대여 품목 ({selectedRental.items.length}개)</h3>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="text-sm w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left">#</th>
                      <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left">품명</th>
                      <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-center">수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRental.items.map((item, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.item_name || '-'}</td>
                        <td className="px-3 py-2 text-xs mono text-center">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 총 수량 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <span className="text-dim">총 대여 수량:</span>
              <span className="ml-2 font-bold text-blue-600">
                {selectedRental.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}개
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* 미정 업체 상세정보 모달 */}
      {selectedUndecidedCompany && (
        <Modal
          title={`${selectedUndecidedCompany.borrower} - 반납예정일 미정`}
          onClose={() => setSelectedUndecidedCompany(null)}
          size="lg"
          footer={
            <Btn onClick={() => setSelectedUndecidedCompany(null)} className="flex-1 justify-center">
              닫기
            </Btn>
          }
        >
          <div className="space-y-4">
            {/* 업체 정보 */}
            <div className="bg-amber-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">{selectedUndecidedCompany.borrower}</span>
                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-medium">
                  미정 {selectedUndecidedCompany.rentals.length}건
                </span>
              </div>
              <div>
                <span className="text-dim">총 품목:</span>
                <span className="ml-2 font-medium">{selectedUndecidedCompany.allItems.length}개</span>
              </div>
              <div>
                <span className="text-dim">총 수량:</span>
                <span className="ml-2 font-medium">{selectedUndecidedCompany.totalItemCount}개</span>
              </div>
            </div>

            {/* 대여 건별 목록 */}
            {selectedUndecidedCompany.rentals.map((rental, rentalIdx) => (
              <div key={rentalIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">대여일: {rental.rent_date}</span>
                    {rental.contact_name && (
                      <span className="text-xs text-slate-500">담당: {rental.contact_name}</span>
                    )}
                  </div>
                </div>
                <table className="text-sm w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left">#</th>
                      <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left">품명</th>
                      <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-center">수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rental.items.map((item, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.item_name || '-'}</td>
                        <td className="px-3 py-2 text-xs mono text-center">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
