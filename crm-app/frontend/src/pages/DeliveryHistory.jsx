import { useState, useEffect, useCallback } from 'react'
import { getDeliveries, deleteDelivery, confirmDelivery } from '../api.js'
import { PageHeader, Table, Spinner, Empty, Btn, Modal } from '../components/Common.jsx'
import { RefreshCw, Search, Trash2, CheckCircle } from 'lucide-react'
import { usePersistedState } from '../hooks/usePersistedState.js'
import { useScrollRestore } from '../hooks/useScrollRestore.js'

export default function DeliveryHistory() {
  const [deliveries, setDeliveries] = useState([])
  const [allDeliveries, setAllDeliveries] = useState([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = usePersistedState('delivery_search', '')
  const [showPending, setShowPending] = usePersistedState('delivery_show_pending_v2', true)
  const [showCompleted, setShowCompleted] = usePersistedState('delivery_show_completed_v2', false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmModal, setConfirmModal] = useState(false)

  useScrollRestore('delivery_history', [deliveries])

  const load = useCallback(async (preserveScroll = false) => {
    setLoading(true)

    // 스크롤 위치 저장
    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

    try {
      const r = await getDeliveries({})
      setAllDeliveries(r.data)

      // 상태 필터링
      let filtered = r.data.filter(item => {
        const isPending = item.status === '납품예정'
        if (isPending) {
          return showPending
        } else {
          return showCompleted
        }
      })

      // 검색어 필터링
      if (search) {
        const query = search.toLowerCase()
        filtered = filtered.filter(item =>
          (item.client && item.client.toLowerCase().includes(query)) ||
          (item.project_name && item.project_name.toLowerCase().includes(query)) ||
          (item.item_name && item.item_name.toLowerCase().includes(query)) ||
          (item.ip && item.ip.toLowerCase().includes(query)) ||
          (item.serial && item.serial.toLowerCase().includes(query))
        )
      }

      setDeliveries(filtered)

      // 스크롤 위치 복원
      if (scrollPosition !== null && mainContainer) {
        requestAnimationFrame(() => {
          mainContainer.scrollTop = scrollPosition
        })
      }
    } finally { setLoading(false) }
  }, [search, showPending, showCompleted])

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
    const pending = deliveries.filter(d => d.status === '납품예정')
    if (selectedIds.size === pending.length && pending.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pending.map(d => d.id)))
    }
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      alert('납품처리할 항목을 선택하세요')
      return
    }

    try {
      for (const id of selectedIds) {
        await confirmDelivery(id)
      }
      setConfirmModal(false)
      setSelectedIds(new Set())
      load(true)
    } catch (e) {
      alert('납품처리 실패: ' + (e.response?.data?.detail || ''))
    }
  }

  const handleDelete = async (d) => {
    if (!confirm(`납품 기록을 삭제할까요?\n업체: ${d.client}\n품명: ${d.item_name}`)) return
    try {
      await deleteDelivery(d.id)
      load(true)
    } catch (e) {
      alert('삭제 실패: ' + (e.response?.data?.detail || ''))
    }
  }

  const pending = deliveries.filter(d => d.status === '납품예정')

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="납품 이력" sub={`총 ${deliveries.length}건`} icon={<RefreshCw onClick={load} className="cursor-pointer" />} />

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        {/* 검색 박스 - 파란색 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-400"/>
            <input
              type="text"
              placeholder="업체명, 프로젝트, 품명 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-0 pl-6 pr-2 py-0.5 text-sm text-slate-700 placeholder:text-blue-300 focus:outline-none w-64"
            />
          </div>
        </div>

        {/* 납품예정 필터 박스 - 오렌지색 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPending}
              onChange={e => setShowPending(e.target.checked)}
              className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-2 focus:ring-orange-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-orange-700">납품예정</span>
            <span className="text-xs text-orange-500">({allDeliveries.filter(d => d.status === '납품예정').length})</span>
          </label>
        </div>

        {/* 납품완료 필터 박스 - 초록색 */}
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={e => setShowCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-green-300 text-green-500 focus:ring-2 focus:ring-green-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-green-700">납품완료</span>
            <span className="text-xs text-green-500">({allDeliveries.filter(d => d.status === '납품완료').length})</span>
          </label>
        </div>

        {/* 납품처리 박스 - 에메랄드색 (선택 시만 활성화) */}
        <div className={`rounded-lg px-4 py-2 transition-all ${
          selectedIds.size > 0
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-slate-50 border border-slate-200 opacity-50'
        }`}>
          <button
            onClick={() => setConfirmModal(true)}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 text-sm font-semibold transition-all ${
              selectedIds.size > 0
                ? 'text-emerald-700 cursor-pointer hover:text-emerald-800'
                : 'text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle size={16}/>
            <span>납품처리</span>
            {selectedIds.size > 0 && (
              <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>
      </div>

      <Table headers={[
        <input type="checkbox" checked={selectedIds.size === pending.length && pending.length > 0} onChange={toggleSelectAll} />,
        '업체명', '프로젝트', '담당자', '품명', 'IP', '수량', '상태', '비고', ''
      ]}>
        {loading && <Spinner/>}
        {!loading && deliveries.length===0 && <Empty/>}
        {!loading && deliveries.map((d, idx) => (
          <tr key={d.id} className="inv-row" style={{background:idx%2===0?'#ffffff':'#f8fafc'}}>
            <td className="px-3 py-2">
              {d.status === '납품예정' && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(d.id)}
                  onChange={() => toggleSelect(d.id)}
                />
              )}
            </td>
            <td className="px-3 py-2 font-medium text-accent">{d.client}</td>
            <td className="px-3 py-2 text-xs text-slate-600">{d.project_name || '-'}</td>
            <td className="px-3 py-2 text-xs">{d.contact_name || '-'}</td>
            <td className="px-3 py-2 font-medium">{d.item_name}</td>
            <td className="px-3 py-2 mono text-xs">{d.ip || d.serial || '-'}</td>
            <td className="px-3 py-2 mono text-center">{d.quantity}</td>
            <td className="px-3 py-2">
              {d.status === '납품예정' ? (
                <span className="text-orange-600 text-xs font-medium">납품예정</span>
              ) : (
                <span className="text-green-600 text-xs font-medium">납품완료</span>
              )}
            </td>
            <td className="px-3 py-2 text-xs text-dim max-w-[120px] truncate">{d.note||'-'}</td>
            <td className="px-3 py-2">
              <button onClick={() => handleDelete(d)} className="p-1 text-dim hover:text-red-500 transition-colors">
                <Trash2 size={14}/>
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {/* 납품처리 모달 */}
      {confirmModal && (
        <Modal title={`납품처리 - ${selectedIds.size}개 항목`} onClose={() => setConfirmModal(false)}
          footer={<>
            <Btn onClick={() => setConfirmModal(false)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleConfirm} variant="green" className="flex-1 justify-center">
              <CheckCircle size={14}/> 납품완료 처리
            </Btn>
          </>}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              선택한 {selectedIds.size}개 항목을 납품완료로 처리하시겠습니까?
            </p>
            <p className="text-xs text-slate-500">
              · 납품완료 처리 시 재고에서 해당 수량만큼 차감됩니다.<br/>
              · 재고 수량이 0이 되면 해당 품목은 재고에서 제거됩니다.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
