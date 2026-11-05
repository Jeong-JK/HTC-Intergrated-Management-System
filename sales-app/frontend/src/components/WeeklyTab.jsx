import { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, GripVertical, Plus, Trash2, X, ChevronUp } from 'lucide-react'
import { getWeeklySchedules, updateWeeklySchedule, createWeeklySchedule, deleteWeeklySchedule } from '../api'
import { PROJECT_COLORS } from '../utils/projectCommon'

// 2026년도 월별 주차 정보
const WEEKS_2026 = {
  1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 4, 10: 5, 11: 5, 12: 5
}

const getProjectColor = (projectNo) => {
  if (!projectNo) return PROJECT_COLORS[0]
  // 프로젝트 번호에서 숫자 추출 (예: "26-01" -> "01")
  const match = projectNo.match(/\d+$/)
  if (match) {
    const num = parseInt(match[0], 10)
    return PROJECT_COLORS[num % PROJECT_COLORS.length]
  }
  // 숫자가 없으면 문자열 해시로 색상 결정 (customer_project용)
  let hash = 0
  for (let i = 0; i < projectNo.length; i++) {
    hash = ((hash << 5) - hash) + projectNo.charCodeAt(i)
    hash = hash & hash
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length]
}

// 발주서 번호에서 날짜 추출 (HPP260109YS-01 -> 2026-01-09)
const extractDateFromPO = (poNumber) => {
  if (!poNumber) return null
  // YYMMDD 패턴 추출 (숫자 6자리)
  const match = poNumber.match(/\d{6}/)
  if (!match) return null

  const dateStr = match[0]
  const yy = dateStr.substring(0, 2) // 26
  const mm = dateStr.substring(2, 4) // 01
  const dd = dateStr.substring(4, 6) // 09

  // 2026-01-09 형식으로 변환
  return `20${yy}-${mm}-${dd}`
}

// 날짜가 속한 월과 주차 계산
const getMonthAndWeek = (dateStr) => {
  if (!dateStr) return { month: -1, week: -1 }
  const date = new Date(dateStr)
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()

  // 해당 월의 몇 주차인지 계산 (1일~7일: 1주차, 8일~14일: 2주차...)
  const week = Math.ceil(day / 7)

  return { month, week }
}

// 월과 주차를 기준으로 테이블 인덱스 계산
const getWeekTableIndex = (month, week) => {
  let index = 0
  // 해당 월 이전까지의 모든 주차를 더함
  for (let m = 1; m < month; m++) {
    index += WEEKS_2026[m] || 0
  }
  // 해당 월의 주차 추가 (1주차 = 인덱스 0)
  index += week - 1
  return index
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  // YYYY-MM-DD 형식이면 yy.mm.dd로 변환, 아니면 원본 그대로 반환
  const fullDate = String(dateStr).split('T')[0]
  const parts = fullDate.split('-')
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts
    return `${year.slice(2)}.${month}.${day}`
  }
  return fullDate
}

// 주차 인덱스를 날짜(월, 주)로 변환
const getMonthWeekFromIndex = (weekIndex) => {
  let remaining = weekIndex
  for (let m = 1; m <= 12; m++) {
    const weeksInMonth = WEEKS_2026[m] || 0
    if (remaining < weeksInMonth) {
      return { month: m, week: remaining + 1 }
    }
    remaining -= weeksInMonth
  }
  return { month: 12, week: 5 }
}

// 월/주차를 날짜 문자열로 변환 (해당 주차의 첫째 날 기준)
const weekIndexToDate = (weekIndex) => {
  const { month, week } = getMonthWeekFromIndex(weekIndex)
  // 해당 월의 n주차 첫째 날 계산 (대략적)
  const day = (week - 1) * 7 + 1
  const paddedMonth = String(month).padStart(2, '0')
  const paddedDay = String(Math.min(day, 28)).padStart(2, '0')
  return `2026-${paddedMonth}-${paddedDay}`
}

export default function WeeklyTab({ year, isActive }) {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingBarNote, setEditingBarNote] = useState(null) // { id, value }
  const [editingFirstWeek, setEditingFirstWeek] = useState(null) // { id, value } - 1월 1주차 셀 편집
  const [dragState, setDragState] = useState(null) // { id, type: 'end', initialIndex, currentIndex }
  const [dateEditPopup, setDateEditPopup] = useState(null) // { id, type: 'start'|'end', x, y, currentDate }
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ project_no: '', customer_project: '', product_name: '', quantity: 1, supplier: '' })
  const [showScrollTop, setShowScrollTop] = useState(false)
  const tableContainerRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [year])

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 탭 활성화 시 데이터 새로고침 (매입관리 연동)
  useEffect(() => {
    if (isActive) {
      loadData(true)
    }
  }, [isActive])

  const loadData = async (preserveScroll = false) => {
    // 스크롤 위치 저장
    const scrollTop = preserveScroll && tableContainerRef.current ? tableContainerRef.current.scrollTop : 0
    const scrollLeft = preserveScroll && tableContainerRef.current ? tableContainerRef.current.scrollLeft : 0

    try {
      // 스크롤 유지 시에는 로딩 상태 변경 안 함 (테이블 유지)
      if (!preserveScroll) {
        setLoading(true)
      }
      const res = await getWeeklySchedules({ year })
      // 선적비용 제외 (프로젝트번호 또는 고객_프로젝트명 있으면 표시)
      const filtered = res.data.filter(s =>
        (s.project_no || s.customer_project) &&  // 프로젝트 번호 또는 고객_프로젝트명 있는 것만
        s.customer_project !== '선적비용' &&
        !s.product_name?.includes('Shipping') &&
        !s.product_name?.includes('DHL')
      )
      setSchedules(filtered)
    } catch (error) {
      console.error('데이터 로딩 실패:', error)
    } finally {
      if (!preserveScroll) {
        setLoading(false)
      }
      // 스크롤 위치 복원
      if (preserveScroll && tableContainerRef.current) {
        requestAnimationFrame(() => {
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = scrollTop
            tableContainerRef.current.scrollLeft = scrollLeft
          }
        })
      }
    }
  }

  // 스케줄 정렬 (같은 프로젝트끼리 연속 배치되도록)
  const sortedSchedules = [...schedules].sort((a, b) => {
    const keyA = a.project_no || a.customer_project || `_id_${a.id}`
    const keyB = b.project_no || b.customer_project || `_id_${b.id}`
    return keyA.localeCompare(keyB)
  })

  // 프로젝트별 그룹화 및 rowSpan 계산
  const getGroupedSchedules = () => {
    const groups = {}
    sortedSchedules.forEach((schedule, idx) => {
      // project_no가 있으면 그걸로 그룹핑, 없으면 customer_project로 그룹핑
      const key = schedule.project_no || schedule.customer_project || `_id_${schedule.id}`
      if (!groups[key]) {
        groups[key] = { firstIndex: idx, count: 0, items: [] }
      }
      groups[key].count++
      groups[key].items.push(schedule)
    })
    return groups
  }

  const groups = getGroupedSchedules()

  // bar_note 더블클릭 편집
  const handleBarNoteDoubleClick = (id, currentValue) => {
    setEditingBarNote({ id, value: currentValue || '' })
  }

  const handleBarNoteChange = (e) => {
    setEditingBarNote(prev => ({ ...prev, value: e.target.value }))
  }

  const handleBarNoteSave = async () => {
    if (!editingBarNote) return
    try {
      await updateWeeklySchedule(editingBarNote.id, { bar_note: editingBarNote.value })
      setSchedules(prev => prev.map(s =>
        s.id === editingBarNote.id ? { ...s, bar_note: editingBarNote.value } : s
      ))
      setEditingBarNote(null)
    } catch (error) {
      console.error('bar_note 저장 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '저장에 실패했습니다')
      alert(msg)
    }
  }

  const handleBarNoteKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBarNoteSave()
    } else if (e.key === 'Escape') {
      setEditingBarNote(null)
    }
  }

  // 1월 1주차 셀 편집
  const handleFirstWeekDoubleClick = (schedule) => {
    // first_week_note 필드 사용 (week_data와 별개)
    setEditingFirstWeek({ id: schedule.id, value: schedule.first_week_note || '' })
  }

  // 막대 삭제
  const handleDeleteBar = async (id) => {
    if (!confirm('막대를 삭제하시겠습니까?')) return
    try {
      await updateWeeklySchedule(id, { week_data: {} })
      setSchedules(prev => prev.map(s =>
        s.id === id ? { ...s, week_data: {} } : s
      ))
    } catch (error) {
      console.error('막대 삭제 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '삭제에 실패했습니다')
      alert(msg)
    }
  }

  const handleFirstWeekChange = (e) => {
    setEditingFirstWeek(prev => ({ ...prev, value: e.target.value }))
  }

  const handleFirstWeekSave = async () => {
    if (!editingFirstWeek) return
    try {
      // first_week_note 필드에만 저장 (week_data는 건드리지 않음)
      await updateWeeklySchedule(editingFirstWeek.id, { first_week_note: editingFirstWeek.value })
      setSchedules(prev => prev.map(s =>
        s.id === editingFirstWeek.id ? { ...s, first_week_note: editingFirstWeek.value } : s
      ))
      setEditingFirstWeek(null)
    } catch (error) {
      console.error('1월 1주차 저장 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '저장에 실패했습니다')
      alert(msg)
    }
  }

  const handleFirstWeekKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFirstWeekSave()
    } else if (e.key === 'Escape') {
      setEditingFirstWeek(null)
    }
  }

  // week_data 업데이트 (드래그로 막대 조절)
  const handleWeekDataUpdate = async (id, newWeekData) => {
    try {
      await updateWeeklySchedule(id, { week_data: newWeekData })
      setSchedules(prev => prev.map(s =>
        s.id === id ? { ...s, week_data: newWeekData } : s
      ))
    } catch (error) {
      console.error('week_data 저장 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '저장에 실패했습니다')
      alert(msg)
    }
  }

  // 드래그 시작 (막대 끝)
  const handleDragStart = (e, id, type, currentIndex) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState({ id, type, initialIndex: currentIndex, currentIndex })
  }

  // 드래그 중 - currentIndex 업데이트 (시각적 피드백)
  const handleDragMove = useCallback((weekIndex) => {
    if (!dragState) return
    if (dragState.currentIndex !== weekIndex && weekIndex >= 0) {
      setDragState(prev => ({ ...prev, currentIndex: weekIndex }))
    }
  }, [dragState])

  // 마우스 업 이벤트 (드래그 종료 시 저장)
  useEffect(() => {
    const handleMouseUp = async () => {
      if (dragState && dragState.currentIndex !== dragState.initialIndex) {
        // week_data 업데이트: 새로운 범위로 주차 설정
        const schedule = schedules.find(s => s.id === dragState.id)
        if (schedule) {
          const oldWeekData = schedule.week_data || {}
          const oldKeys = Object.keys(oldWeekData)
          if (oldKeys.length > 0) {
            // 기존 색상 가져오기
            const color = oldWeekData[oldKeys[0]]
            // 기존 시작 인덱스 유지, 끝 인덱스만 변경
            const indices = oldKeys.map(key => {
              const [m, w] = key.split('_').map(Number)
              return getWeekTableIndex(m, w)
            }).sort((a, b) => a - b)
            const startIdx = indices[0]
            const endIdx = dragState.currentIndex

            // 새 week_data 생성
            const newWeekData = {}
            for (let idx = startIdx; idx <= endIdx; idx++) {
              const { month, week } = getMonthWeekFromIndex(idx)
              newWeekData[`${month}_${week}`] = color
            }
            await handleWeekDataUpdate(dragState.id, newWeekData)
          }
        }
      }
      setDragState(null)
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [dragState, schedules])

  // 날짜 입력 팝업 열기 (막대 더블클릭)
  const openDatePopup = (e, id, type, currentDate) => {
    e.stopPropagation()
    const rect = e.target.getBoundingClientRect()
    setDateEditPopup({
      id,
      type,
      x: rect.left,
      y: rect.bottom + 5,
      currentDate: currentDate || ''
    })
  }

  // 날짜 팝업에서 저장 (현재 비활성화 - week_data 기반)
  const handleDatePopupSave = async (newDate) => {
    if (!dateEditPopup || !newDate) return
    // week_data 기반 구조에서는 날짜 팝업 미사용
    setDateEditPopup(null)
  }

  // 수동 입력 모달 열기
  const handleOpenAddModal = () => {
    setAddForm({ project_no: '', customer_project: '', product_name: '', quantity: 1, supplier: '' })
    setShowAddModal(true)
  }

  // 수동 입력 저장
  const handleAddManual = async () => {
    if (!addForm.project_no?.trim() || !addForm.customer_project?.trim() || !addForm.product_name?.trim()) {
      alert('프로젝트 번호, 고객_프로젝트명, 품목명은 필수입니다.')
      return
    }

    try {
      await createWeeklySchedule({
        year,
        project_no: addForm.project_no.trim(),
        customer_project: addForm.customer_project.trim(),
        product_name: addForm.product_name.trim(),
        quantity: addForm.quantity || 1,
        supplier: addForm.supplier?.trim() || '',
        notes: '재고 납품'
      })
      setShowAddModal(false)
      loadData(true)
    } catch (error) {
      console.error('추가 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '추가에 실패했습니다')
      alert(msg)
    }
  }

  // 수동 입력 삭제
  const handleDeleteManual = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await deleteWeeklySchedule(id)
      loadData(true)
    } catch (error) {
      console.error('삭제 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '삭제에 실패했습니다')
      alert(msg)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      {/* Info & Add Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex-none" style={{ maxWidth: '400px' }}>
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-600" size={16} />
            <p className="text-sm text-blue-700">
              매입 품목 자동 표시. 재고 납품은 수동 추가.
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
          <Plus size={16} /> 수동 추가
        </button>
      </div>

      {/* 수동 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-green-50">
              <h2 className="text-lg font-bold text-slate-800">수동 추가 (재고 납품)</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">프로젝트 번호 *</label>
                <input
                  type="text"
                  placeholder="예: 26-01"
                  value={addForm.project_no}
                  onChange={(e) => setAddForm({ ...addForm, project_no: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">고객_프로젝트명 *</label>
                <input
                  type="text"
                  placeholder="예: 씨네이브_나노플로우 구매"
                  value={addForm.customer_project}
                  onChange={(e) => setAddForm({ ...addForm, customer_project: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">품목명 *</label>
                <input
                  type="text"
                  placeholder="예: SL4200"
                  value={addForm.product_name}
                  onChange={(e) => setAddForm({ ...addForm, product_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">수량</label>
                  <input
                    type="number"
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">공급사</label>
                  <input
                    type="text"
                    placeholder="예: Silvus"
                    value={addForm.supplier}
                    onChange={(e) => setAddForm({ ...addForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100">
                취소
              </button>
              <button
                onClick={handleAddManual}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Schedule Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
          onScroll={(e) => setShowScrollTop(e.target.scrollTop > 200)}
        >
          <table className="border-collapse text-xs min-w-max">
            <thead>
              {/* 월 행 */}
              <tr className="sticky top-0 z-[60]">
                <th rowSpan="2" className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs sticky left-0 z-[60] w-16 min-w-[64px]">
                  No.
                </th>
                <th rowSpan="2" className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs sticky left-[64px] z-[60] w-48 min-w-[192px]">
                  Project
                </th>
                <th rowSpan="2" className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs sticky left-[256px] z-[60] w-64 min-w-[256px]">
                  품목
                </th>
                <th rowSpan="2" className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs sticky left-[512px] z-[60] w-14 min-w-[56px] border-r-2 border-r-slate-500">
                  수량
                </th>
                <th rowSpan="2" className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs w-28">
                  공급사
                </th>
                {Object.entries(WEEKS_2026).map(([month, weeks]) => (
                  <th
                    key={month}
                    colSpan={weeks}
                    className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs">
                    {month}월
                  </th>
                ))}
                <th rowSpan="2" className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs w-44">
                  특이사항
                </th>
                <th rowSpan="2" className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs w-16">
                  삭제
                </th>
              </tr>

              {/* 주차 행 */}
              <tr className="sticky top-[26px] z-[45]">
                {Object.entries(WEEKS_2026).map(([month, weeks]) =>
                  Array.from({ length: weeks }, (_, i) => (
                    <th
                      key={`${month}-${i+1}`}
                      className="border border-slate-300 bg-slate-200 px-1 py-1 font-bold text-xs w-8">
                      {i + 1}
                    </th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {sortedSchedules.length === 0 ? (
                <tr>
                  <td className="border border-slate-300 px-3 py-8 text-center text-slate-400" colSpan={Object.values(WEEKS_2026).reduce((a, b) => a + b, 0) + 8}>
                    프로젝트에 매입 품목을 등록하면 여기에 자동으로 표시됩니다
                  </td>
                </tr>
              ) : (
                sortedSchedules.map((schedule, idx) => {
                  const groupKey = schedule.project_no || schedule.customer_project || `_id_${schedule.id}`
                  const group = groups[groupKey]
                  const isFirstInGroup = group?.firstIndex === idx
                  const isLastInGroup = group ? (idx - group.firstIndex) === (group.count - 1) : true
                  const projectColor = getProjectColor(schedule.project_no || schedule.customer_project)
                  const isCompleted = schedule.project_status === '완료'

                  // week_data에서 막대 범위 계산 (시작/끝 인덱스)
                  const weekData = schedule.week_data || {}
                  const weekKeys = Object.keys(weekData)
                  let barStartIndex = -1
                  let barEndIndex = -1

                  if (weekKeys.length > 0) {
                    // 주차 키를 인덱스로 변환하여 시작/끝 찾기
                    const indices = weekKeys.map(key => {
                      const [m, w] = key.split('_').map(Number)
                      return getWeekTableIndex(m, w)
                    }).sort((a, b) => a - b)
                    barStartIndex = indices[0]
                    barEndIndex = indices[indices.length - 1]
                  }

                  // 드래그 중인 경우 시각적 표시
                  const isDragging = dragState?.id === schedule.id

                  // 현재 주차 인덱스 계산 (누적)
                  let currentWeekIndex = 0

                  // 그룹 마지막 행에 굵은 하단 테두리
                  const borderClass = isLastInGroup ? 'border-b-2 border-b-slate-500' : ''
                  // 완료된 프로젝트는 회색 처리
                  const rowBgClass = isCompleted ? 'bg-gray-200' : 'hover:bg-slate-50'

                  return (
                    <tr key={schedule.id} className={`transition-colors ${rowBgClass} ${borderClass}`}>
                      {isFirstInGroup && (
                        <>
                          <td
                            rowSpan={group.count}
                            className="border border-slate-300 px-2 py-1 text-xs font-medium sticky left-0 z-40 bg-white text-center align-middle border-b-2 border-b-slate-500 min-w-[64px]"
                          >
                            <div className="font-bold">{schedule.project_no}</div>
                          </td>
                          <td
                            rowSpan={group.count}
                            className="border border-slate-300 px-2 py-1 text-xs text-center align-middle font-medium border-b-2 border-b-slate-500 sticky left-[64px] z-40 min-w-[192px]"
                            style={{ backgroundColor: isCompleted ? '#e5e7eb' : projectColor }}>
                            {schedule.customer_project && schedule.customer_project.includes('\n') ? (
                              <div>
                                <div className="font-bold">{schedule.customer_project.split('\n')[0]}</div>
                                <div className="text-[10px]">{schedule.customer_project.split('\n')[1]}</div>
                              </div>
                            ) : (
                              schedule.customer_project
                            )}
                          </td>
                        </>
                      )}
                      <td className={`border border-slate-300 px-2 py-1 text-xs text-center align-middle ${borderClass} sticky left-[256px] z-40 bg-white min-w-[256px]`}>{schedule.product_name}</td>
                      <td className={`border border-slate-300 px-2 py-1 text-xs text-center align-middle ${borderClass} sticky left-[512px] z-40 bg-white min-w-[56px] border-r-2 border-r-slate-500`}>{schedule.quantity}</td>
                      <td className={`border border-slate-300 px-2 py-1 text-xs text-center align-middle ${borderClass}`}>{schedule.supplier}</td>
                      {/* 주차별 셀 - week_data JSON 기반 색상 표시 */}
                      {Object.entries(WEEKS_2026).map(([month, weeks]) =>
                        Array.from({ length: weeks }, (_, i) => {
                          const weekIdx = currentWeekIndex++
                          const weekKey = `${month}_${i + 1}` // "1_1", "1_2", etc.
                          const cellValue = weekData[weekKey] // week_data에서 해당 주차 값 가져오기 (텍스트 또는 색상)
                          const isFirstWeekCell = weekKey === '1_1' // 1월 1주차

                          // 드래그 중이면 currentIndex를 종료 인덱스로 사용
                          const effectiveEndIndex = (isDragging && dragState.currentIndex !== undefined)
                            ? dragState.currentIndex
                            : barEndIndex
                          const isInRange = cellValue || (isDragging && weekIdx >= barStartIndex && weekIdx <= effectiveEndIndex)
                          const isStartCell = weekIdx === barStartIndex
                          const isEndCell = weekIdx === effectiveEndIndex
                          const isNextToEnd = weekIdx === effectiveEndIndex + 1 // 막대 끝 다음 칸
                          // 완료된 프로젝트는 회색, 아니면 projectColor 사용
                          const displayColor = isCompleted ? '#d1d5db' : projectColor

                          return (
                            <td
                              key={`${schedule.id}-${month}-${i+1}`}
                              className={`border border-slate-300 px-0 py-1 text-xs text-center align-middle ${borderClass} relative ${isDragging ? 'cursor-col-resize select-none' : ''} ${isFirstWeekCell ? 'cursor-text' : ''}`}
                              style={isInRange ? { backgroundColor: displayColor, overflow: 'visible' } : {}}
                              title={cellValue || ''} // 셀 값을 툴팁으로 표시
                              onMouseEnter={isDragging ? () => handleDragMove(weekIdx) : undefined}
                              onDoubleClick={
                                !isDragging ? (
                                  isFirstWeekCell ? () => handleFirstWeekDoubleClick(schedule) :
                                  isNextToEnd ? () => handleBarNoteDoubleClick(schedule.id, schedule.bar_note) :
                                  undefined
                                ) : undefined
                              }>
                              {/* 1월 1주차 셀: 항상 편집 가능 (first_week_note 사용) */}
                              {isFirstWeekCell && (
                                <>
                                  {editingFirstWeek?.id === schedule.id ? (
                                    <input
                                      type="text"
                                      value={editingFirstWeek.value}
                                      onChange={handleFirstWeekChange}
                                      onBlur={handleFirstWeekSave}
                                      onKeyDown={handleFirstWeekKeyDown}
                                      autoFocus
                                      className="w-full px-1 py-0.5 bg-white border border-blue-400 text-black outline-none text-[11px]"
                                    />
                                  ) : (
                                    <div className="text-[10px] text-slate-700 font-medium" title="더블클릭으로 입력">
                                      {schedule.first_week_note || '📝'}
                                    </div>
                                  )}
                                </>
                              )}
                              {/* 끝 드래그 핸들 + bar_note (종료일만 조절 가능) */}
                              {isEndCell && isInRange && (
                                <>
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-blue-500/30 z-30 flex items-center justify-center"
                                    onMouseDown={(e) => handleDragStart(e, schedule.id, 'end', barEndIndex)}
                                    title="드래그로 막대 조절">
                                    <div className="w-1 h-4 bg-slate-500 rounded"></div>
                                  </div>
                                  {editingBarNote?.id === schedule.id ? (
                                    <input
                                      type="text"
                                      value={editingBarNote.value}
                                      onChange={handleBarNoteChange}
                                      onBlur={handleBarNoteSave}
                                      onKeyDown={handleBarNoteKeyDown}
                                      autoFocus
                                      className="absolute top-1/2 -translate-y-1/2 bg-white border border-blue-400 px-1 font-bold text-black outline-none text-[11px] z-30"
                                      style={{ left: 'calc(100% + 8px)', minWidth: '80px', whiteSpace: 'nowrap' }}
                                    />
                                  ) : (
                                    schedule.bar_note && (
                                      <span
                                        className="absolute top-1/2 -translate-y-1/2 font-bold text-black text-[11px] cursor-pointer z-20 whitespace-nowrap"
                                        style={{ left: 'calc(100% + 8px)', pointerEvents: 'auto' }}
                                        onDoubleClick={() => handleBarNoteDoubleClick(schedule.id, schedule.bar_note)}>
                                        {schedule.bar_note}
                                      </span>
                                    )
                                  )}
                                </>
                              )}
                              {/* 막대 끝 다음 칸에도 메모 입력 힌트 표시 */}
                              {isNextToEnd && !isInRange && barEndIndex >= 0 && (
                                <div className="text-[10px] text-slate-400 cursor-text" title="더블클릭으로 메모 입력">
                                  {schedule.bar_note ? '✓' : ''}
                                </div>
                              )}
                            </td>
                          )
                        })
                      )}
                      <td className={`border border-slate-300 px-2 py-1 text-xs text-center align-middle ${borderClass}`}>{schedule.notes}</td>
                      <td className={`border border-slate-300 px-1 py-1 text-xs text-center align-middle ${borderClass}`}>
                        {/* 막대 삭제 */}
                        {barStartIndex >= 0 && barEndIndex >= 0 && (
                          <button
                            onClick={() => handleDeleteBar(schedule.id)}
                            className="px-1.5 py-0.5 bg-orange-500 text-white rounded hover:bg-orange-600 text-xs font-bold"
                            title="막대 삭제">
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 맨위로가기 버튼 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-12 h-12 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 flex items-center justify-center z-50 transition-all"
          title="맨 위로"
        >
          <ChevronUp size={24} />
        </button>
      )}

      <div className="text-sm text-slate-500 text-right">
        총 {schedules.length}건
      </div>

      {/* 날짜 입력 팝업 */}
      {dateEditPopup && (
        <div
          className="fixed z-50 bg-white border border-slate-300 rounded-lg shadow-lg p-3"
          style={{ left: dateEditPopup.x, top: dateEditPopup.y }}>
          <div className="text-xs font-bold mb-2 text-slate-700">
            도착일 설정
          </div>
          <input
            type="text"
            placeholder="YY.MM.DD"
            defaultValue={dateEditPopup.currentDate}
            className="border border-slate-300 rounded px-2 py-1 text-sm w-36"
            autoFocus
            onBlur={(e) => {
              if (e.target.value) {
                handleDatePopupSave(e.target.value)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDateEditPopup(null)
              }
            }}
          />
          <button
            onClick={() => setDateEditPopup(null)}
            className="ml-2 text-xs text-slate-500 hover:text-slate-700">
            취소
          </button>
        </div>
      )}

      {/* 팝업 배경 클릭 시 닫기 */}
      {dateEditPopup && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDateEditPopup(null)}
        />
      )}
    </div>
  )
}
