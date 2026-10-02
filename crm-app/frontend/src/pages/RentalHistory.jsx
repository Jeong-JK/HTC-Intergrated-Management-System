import { useState, useEffect, useCallback } from 'react'
import { getRentals, returnRental, deleteRental } from '../api.js'
import { PageHeader, Table, Spinner, Empty, Btn, Modal, Field, inputCls } from '../components/Common.jsx'
import { RefreshCw, Search, CheckCircle, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { usePersistedState } from '../hooks/usePersistedState.js'
import { useScrollRestore } from '../hooks/useScrollRestore.js'

export default function RentalHistory() {
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = usePersistedState('rental_history_search', '')
  const [showRenting, setShowRenting] = usePersistedState('rental_history_show_renting_v2', true)
  const [showReturned, setShowReturned] = usePersistedState('rental_history_show_returned_v2', false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [returnModal, setReturnModal] = useState(false)
  const [returnDate, setReturnDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [returnNote, setReturnNote] = useState('')

  useScrollRestore('rental_history_page', [rentals])

  const load = useCallback(async (preserveScroll = false) => {
    setLoading(true)

    // 스크롤 위치 저장
    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

    try {
      const r = await getRentals({ active: null })

      // 상태 필터링 - 각각 체크된 항목만 보이기
      let filtered = r.data.filter(item => {
        const isReturned = !!item.returned_at
        if (isReturned) {
          return showReturned  // 반납완료된 항목은 showReturned가 true일 때만
        } else {
          return showRenting   // 대여중 항목은 showRenting이 true일 때만
        }
      })

      // 검색어 필터링
      if (search) {
        const query = search.toLowerCase()
        filtered = filtered.filter(item =>
          (item.borrower && item.borrower.toLowerCase().includes(query)) ||
          (item.item_name && item.item_name.toLowerCase().includes(query)) ||
          (item.ip && item.ip.toLowerCase().includes(query)) ||
          (item.serial && item.serial.toLowerCase().includes(query))
        )
      }

      setRentals(filtered)

      // 스크롤 위치 복원
      if (scrollPosition !== null && mainContainer) {
        requestAnimationFrame(() => {
          mainContainer.scrollTop = scrollPosition
        })
      }
    } finally { setLoading(false) }
  }, [search, showRenting, showReturned])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    const unreturned = rentals.filter(r => !r.returned_at)
    if (selectedIds.size === unreturned.length && unreturned.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unreturned.map(r => r.id)))
    }
  }

  const handleReturn = async () => {
    if (selectedIds.size === 0) {
      alert('반납할 항목을 선택하세요')
      return
    }

    try {
      for (const id of selectedIds) {
        await returnRental(id, { returned_at: returnDate, note: returnNote })
      }
      setReturnModal(false)
      setSelectedIds(new Set())
      setReturnNote('')
      load(true)
    } catch (e) {
      alert('반납 처리 실패: ' + (e.response?.data?.detail || ''))
    }
  }

  const handleDelete = async (r) => {
    if (!confirm(`대여 기록을 삭제할까요?\n업체: ${r.borrower}\n품명: ${r.item_name || '-'}`)) return
    try {
      await deleteRental(r.id)
      load(true)
    } catch (e) {
      alert('삭제 실패: ' + (e.response?.data?.detail || ''))
    }
  }

  const unreturned = rentals.filter(r => !r.returned_at)

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="대여 이력" icon={<RefreshCw onClick={load} className="cursor-pointer" />} />

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        {/* 검색 박스 - 파란색 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-400"/>
            <input
              type="text"
              placeholder="업체명, 품명, IP 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-0 pl-6 pr-2 py-0.5 text-sm text-slate-700 placeholder:text-blue-300 focus:outline-none w-56"
            />
          </div>
        </div>

        {/* 대여중 필터 박스 - 노란색 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRenting}
              onChange={e => setShowRenting(e.target.checked)}
              className="w-4 h-4 rounded border-amber-300 text-amber-500 focus:ring-2 focus:ring-amber-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-amber-700">대여중</span>
            <span className="text-xs text-amber-500">({rentals.filter(r => !r.returned_at).length})</span>
          </label>
        </div>

        {/* 반납완료 필터 박스 - 초록색 */}
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showReturned}
              onChange={e => setShowReturned(e.target.checked)}
              className="w-4 h-4 rounded border-green-300 text-green-500 focus:ring-2 focus:ring-green-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-green-700">반납완료</span>
            <span className="text-xs text-green-500">({rentals.filter(r => r.returned_at).length})</span>
          </label>
        </div>

        {/* 반납처리 박스 - 에메랄드색 (선택 시만 활성화) */}
        <div className={`rounded-lg px-4 py-2 transition-all ${
          selectedIds.size > 0
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-slate-50 border border-slate-200 opacity-50'
        }`}>
          <button
            onClick={() => setReturnModal(true)}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 text-sm font-semibold transition-all ${
              selectedIds.size > 0
                ? 'text-emerald-700 cursor-pointer hover:text-emerald-800'
                : 'text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle size={16}/>
            <span>반납처리</span>
            {selectedIds.size > 0 && (
              <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>
      </div>

      <Table headers={[
        <input type="checkbox" checked={selectedIds.size === unreturned.length && unreturned.length > 0} onChange={toggleSelectAll} />,
        '업체명', '담당자', '품명', 'IP', '수량', '대여일', '반납예정', '실제반납', '비고', ''
      ]}>
        {loading && <Spinner />}
        {!loading && rentals.length === 0 && <Empty />}
        {!loading && rentals.map((r, idx) => (
          <tr key={r.id} className="inv-row" style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
            <td className="px-3 py-2">
              {!r.returned_at && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                />
              )}
            </td>
            <td className="px-3 py-2 font-medium text-accent">{r.borrower}</td>
            <td className="px-3 py-2 text-xs">{r.contact_name || '-'}</td>
            <td className="px-3 py-2 font-medium">{r.item_name || '-'}</td>
            <td className="px-3 py-2 mono text-xs">{r.ip || r.serial || '-'}</td>
            <td className="px-3 py-2 mono text-center">{r.quantity}</td>
            <td className="px-3 py-2 mono text-xs">{r.rent_date}</td>
            <td className="px-3 py-2 mono text-xs">{r.expected_return || '-'}</td>
            <td className="px-3 py-2 mono text-xs">
              {r.returned_at ? <span className="text-green-600">{r.returned_at}</span> : <span className="text-yellow-600">대여중</span>}
            </td>
            <td className="px-3 py-2 text-xs text-dim">{r.note || '-'}</td>
            <td className="px-3 py-2">
              <button onClick={() => handleDelete(r)} className="p-1 text-dim hover:text-red-500 transition-colors">
                <Trash2 size={14}/>
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {/* 반납처리 모달 */}
      {returnModal && (
        <Modal title={`반납처리 - ${selectedIds.size}개 항목`} onClose={() => setReturnModal(false)}
          footer={<>
            <Btn onClick={() => setReturnModal(false)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleReturn} variant="green" className="flex-1 justify-center">
              <CheckCircle size={14}/> 반납처리
            </Btn>
          </>}>
          <div className="space-y-3">
            <Field label="반납일 *">
              <input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="비고">
              <textarea
                value={returnNote}
                onChange={e => setReturnNote(e.target.value)}
                className={inputCls}
                rows={3}
                placeholder="반납 관련 메모"
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
