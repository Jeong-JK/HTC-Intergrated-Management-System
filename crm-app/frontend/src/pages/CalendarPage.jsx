import { useState, useEffect } from 'react'
import { getCalendar } from '../api.js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal, Btn } from '../components/Common.jsx'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = ['#4cc97a', '#c9a820', '#6a9aff', '#c96af0', '#f07a6a', '#6af0d0', '#f0c06a', '#a0f07a', '#ffa07a', '#7aff7a']

export default function CalendarPage() {
  const [current, setCurrent] = useState(dayjs())
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRental, setSelectedRental] = useState(null)

  useScrollRestore('calendar', [rentals])

  useEffect(() => {
    setLoading(true)
    getCalendar(current.year(), current.month() + 1)
      .then(r => setRentals(r.data))
      .finally(() => setLoading(false))
  }, [current])

  const year = current.year()
  const month = current.month()

  // 업체별로 대여 그룹화 (같은 업체의 여러 품목을 하나로 묶음)
  const groupRentalsByBorrower = () => {
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

  const groupedRentals = groupRentalsByBorrower()

  // 업체별 색상 매핑
  const companies = [...new Set(groupedRentals.map(r => r.borrower))]
  const colorMap = Object.fromEntries(companies.map((c, i) => [c, COLORS[i % COLORS.length]]))

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

  // 각 날짜에 해당하는 대여 정보 찾기 (업체 기준)
  const getRentalsForDate = (date) => {
    return groupedRentals.filter(r => {
      const rentDate = dayjs(r.rent_date)
      const returnDate = r.expected_return ? dayjs(r.expected_return) : null

      // 대여일 <= date <= 반납예정일 (또는 반납예정일이 없으면 대여중)
      const isAfterRentDate = date.isSame(rentDate, 'day') || date.isAfter(rentDate, 'day')
      const isBeforeReturnDate = !returnDate || date.isSame(returnDate, 'day') || date.isBefore(returnDate, 'day')

      // 이미 반납했으면 제외
      if (r.returned_at && dayjs(r.returned_at).isBefore(date, 'day')) {
        return false
      }

      return isAfterRentDate && isBeforeReturnDate
    })
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

  const today = dayjs()

  // 대여 상세 정보 모달 열기
  const openRentalDetail = (rental) => {
    setSelectedRental(rental)
  }

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text">대여 캘린더</h1>
          <p className="text-dim text-sm mt-0.5">{current.format('YYYY년 MM월')} · 대여중 {groupedRentals.length}건</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setCurrent(c => c.subtract(1, 'month'))} className="p-2 rounded border border-border text-dim hover:text-text transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrent(dayjs())} className="px-3 py-1.5 rounded border border-border text-dim hover:text-text text-sm transition-colors">
            오늘
          </button>
          <button onClick={() => setCurrent(c => c.add(1, 'month'))} className="p-2 rounded border border-border text-dim hover:text-text transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 범례 */}
      {companies.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-3">
          {companies.map(company => (
            <div key={company} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorMap[company] }} />
              <span className="text-sm font-medium text-text">{company}</span>
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

        {!loading && (
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
                      className={`min-h-[100px] p-2 border-r border-slate-100 last:border-r-0 ${
                        !day.isCurrentMonth ? 'bg-slate-50/50' : ''
                      } transition-colors relative`}
                    >
                      <div
                        className={`text-sm font-medium mb-1 ${
                          !day.isCurrentMonth
                            ? 'text-slate-300'
                            : isToday
                            ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center'
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
                      <div className="space-y-1 mt-2">
                        {dayRentals.slice(0, 4).map((rental, idx) => {
                          const { isStart, isEnd } = getRentalPosition(rental, day.date)

                          // 둥근 모서리 결정 (시작일과 끝일에만)
                          const roundedLeft = isStart
                          const roundedRight = isEnd

                          return (
                            <div
                              key={idx}
                              className="text-xs px-1.5 py-0.5 truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: colorMap[rental.borrower],
                                borderTopLeftRadius: roundedLeft ? '4px' : '0',
                                borderBottomLeftRadius: roundedLeft ? '4px' : '0',
                                borderTopRightRadius: roundedRight ? '4px' : '0',
                                borderBottomRightRadius: roundedRight ? '4px' : '0',
                                marginLeft: roundedLeft ? '0' : '-2px',
                                marginRight: roundedRight ? '0' : '-2px',
                                paddingLeft: roundedLeft ? '6px' : '8px',
                                paddingRight: roundedRight ? '6px' : '8px',
                              }}
                              onClick={() => openRentalDetail(rental)}
                              title={`${rental.borrower} - ${rental.items.length}개 품목 (${rental.rent_date} ~ ${rental.expected_return || '미정'})`}
                            >
                              {isStart && rental.borrower}
                            </div>
                          )
                        })}
                        {dayRentals.length > 4 && (
                          <div className="text-xs text-slate-400 pl-1">
                            +{dayRentals.length - 4}
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
    </div>
  )
}
