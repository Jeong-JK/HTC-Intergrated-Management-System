import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInbound, updateInbound, bulkUpdateExchangeRate, deleteInbound } from '../../api.js'
import { PageHeader, Table, Spinner, Empty, Btn, Modal, Field, inputCls, fmt, NoteText } from '../../components/Common.jsx'
import { RefreshCw, Search, ChevronLeft, ChevronRight, Edit2, DollarSign, Trash2, TruckIcon } from 'lucide-react'
import dayjs from 'dayjs'
import { usePersistedState } from '../../hooks/usePersistedState.js'
import { useScrollRestore } from '../../hooks/useScrollRestore.js'

export default function InboundDetail() {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = usePersistedState('inbound_detail_search', '')
  const [year, setYear]       = usePersistedState('inbound_detail_year', dayjs().year())
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkExchangeModal, setBulkExchangeModal] = useState(false)
  const [bulkExchangeRate, setBulkExchangeRate] = useState('')

  useScrollRestore('inbound_detail', [records])

  const load = async (preserveScroll = false) => {
    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

    if (!preserveScroll) {
      setLoading(true)
    }

    try {
      const r = await getInbound({ search: search||undefined, year })
      setRecords(r.data)

      if (scrollPosition !== null && mainContainer) {
        requestAnimationFrame(() => {
          mainContainer.scrollTop = scrollPosition
        })
      }
    } finally {
      if (!preserveScroll) {
        setLoading(false)
      }
    }
  }

  useEffect(() => { load() }, [year, search])

  const openEdit = (record) => {
    setEditModal(record)
    setEditForm({
      quantity: record.quantity || 1,
      inbound_date: record.inbound_date,
      unit_price: record.unit_price ?? 0,
      exchange_rate: record.exchange_rate ?? 0,
      note: record.note || ''
    })
  }

  const handleEdit = async () => {
    setSaving(true)
    try {
      await updateInbound(editModal.id, editForm)
      setEditModal(null)
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '수정에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const set = k => e => setEditForm(f => ({...f, [k]: e.target.value}))

  const handleDelete = async (id, itemName) => {
    if (!confirm(`"${itemName}" 입고 기록을 삭제하시겠습니까?`)) return
    setSaving(true)
    try {
      await deleteInbound(id)
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDateGroup = async (date, dateRecords) => {
    if (!confirm(`${date} 입고 기록 ${dateRecords.length}건을 모두 삭제하시겠습니까?`)) return
    setSaving(true)
    try {
      for (const record of dateRecords) {
        await deleteInbound(record.id)
      }
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  // 날짜별로 그룹화
  const groupedByDate = records.reduce((acc, record) => {
    const date = record.inbound_date
    if (!acc[date]) acc[date] = []
    acc[date].push(record)
    return acc
  }, {})

  // 총합 계산
  const totalAmount = records.reduce((sum, r) => {
    const total = (parseFloat(r.unit_price)||0) * (parseFloat(r.exchange_rate)||0) * (parseInt(r.quantity)||1)
    return sum + total
  }, 0)

  // 체크박스 토글
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 날짜별 전체 선택/해제
  const toggleDateGroup = (dateRecords) => {
    const dateIds = dateRecords.map(r => r.id)
    const allSelected = dateIds.every(id => selectedIds.has(id))

    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        dateIds.forEach(id => next.delete(id))
      } else {
        dateIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(records.map(r => r.id)))
    }
  }

  // 환율 일괄 적용
  const handleBulkExchangeRate = async () => {
    if (!bulkExchangeRate || selectedIds.size === 0) {
      alert('환율을 입력하고 항목을 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      await bulkUpdateExchangeRate({
        ids: Array.from(selectedIds),
        exchange_rate: parseFloat(bulkExchangeRate)
      })
      setBulkExchangeModal(false)
      setBulkExchangeRate('')
      setSelectedIds(new Set())
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '환율 업데이트에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  // 납품 등록으로 이동
  const handleMoveToDelivery = () => {
    if (selectedIds.size === 0) {
      alert('납품 등록할 항목을 선택해주세요.')
      return
    }

    // 선택된 항목들의 데이터 추출
    const selectedRecords = records.filter(r => selectedIds.has(r.id))

    // 납품 등록 페이지로 전달할 데이터 구성
    const deliveryItems = selectedRecords.map(r => ({
      item_id: r.item_id || null,
      item_name: r.item_name,
      description: r.description || '',
      serial_ip: r.ip || r.serial || '',
      quantity: r.quantity || 1,
      note: r.note || ''
    }))

    // 납품 등록 페이지로 이동하면서 데이터 전달
    navigate('/inventory/out/delivery', { state: { prefilledItems: deliveryItems } })
  }

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="입고 상세" sub={`총 ${records.length}건`}>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
          <button onClick={()=>setYear(y=>y-1)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><ChevronLeft size={14}/></button>
          <span className="text-sm font-semibold text-slate-700 w-12 text-center">{year}</span>
          <button onClick={()=>setYear(y=>y+1)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><ChevronRight size={14}/></button>
        </div>
        <Btn onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/></Btn>
      </PageHeader>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&load()}
            placeholder="품명 검색..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400"/>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">{selectedIds.size}개 선택됨</span>
            <Btn onClick={() => setBulkExchangeModal(true)} variant="blue">
              <DollarSign size={14}/>
              환율 일괄 적용
            </Btn>
            <Btn onClick={handleMoveToDelivery} variant="yellow">
              <TruckIcon size={14}/>
              납품 등록으로 이동
            </Btn>
          </div>
        )}
      </div>

      {/* 총합 표시 */}
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">총 금액</span>
          <span className="text-2xl font-bold text-blue-600 mono">₩{fmt(Math.round(totalAmount))}</span>
        </div>
      </div>

      {loading && <Spinner/>}
      {!loading && records.length === 0 && <Empty/>}
      {!loading && records.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dateRecords]) => {
            const dateTotal = dateRecords.reduce((sum, r) => {
              const total = (parseFloat(r.unit_price)||0) * (parseFloat(r.exchange_rate)||0) * (parseInt(r.quantity)||1)
              return sum + total
            }, 0)
            const allDateSelected = dateRecords.every(r => selectedIds.has(r.id))

            return (
              <div key={date} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                {/* 날짜별 헤더 */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={allDateSelected}
                      onChange={() => toggleDateGroup(dateRecords)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-700 mono">{date}</span>
                    <span className="text-xs text-slate-500">({dateRecords.length}건)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-blue-600 mono">₩{fmt(Math.round(dateTotal))}</span>
                    <button
                      onClick={() => handleDeleteDateGroup(date, dateRecords)}
                      disabled={saving}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title={`${date} 전체 삭제`}
                    >
                      <Trash2 size={13}/>
                      <span>전체삭제</span>
                    </button>
                  </div>
                </div>

                {/* 날짜별 테이블 */}
                <Table headers={['', '카테고리','품명','Serial / IP','수량','비고','라이센스','시리얼','MAC','단가','환율','총금액','','']}>
                  {dateRecords.map((r, idx) => {
                    const total = (parseFloat(r.unit_price)||0) * (parseFloat(r.exchange_rate)||0) * (parseInt(r.quantity)||1)
                    const isSelected = selectedIds.has(r.id)

                    return (
                      <tr key={r.id} className={`border-b border-slate-100 ${isSelected ? 'bg-blue-50' : idx%2===0?'bg-white':'bg-slate-50'}`}>
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(r.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">{r.category||'-'}</span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{r.item_name}</td>
                        <td className="px-4 py-2.5 mono text-xs text-slate-500">{r.ip||'-'}</td>
                        <td className="px-4 py-2.5 mono text-center text-slate-700">{r.quantity}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[120px] truncate"><NoteText text={r.note}/></td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[100px] truncate">{r.license_key||'-'}</td>
                        <td className="px-4 py-2.5 mono text-xs text-slate-500">{r.serial||'-'}</td>
                        <td className="px-4 py-2.5 mono text-xs text-slate-500">{r.mac||'-'}</td>
                        <td className="px-4 py-2.5 mono text-xs text-right whitespace-nowrap">{r.unit_price?`$${fmt(r.unit_price)}`:'-'}</td>
                        <td className="px-4 py-2.5 mono text-xs text-right whitespace-nowrap">
                          {parseFloat(r.unit_price) > 0 && parseFloat(r.exchange_rate) === 0 ? (
                            <span className="text-orange-600 font-bold tracking-wide" style={{fontSize: '13px'}}>환율입력필요</span>
                          ) : parseFloat(r.exchange_rate) > 0 ? (
                            fmt(r.exchange_rate)
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-2.5 mono text-xs text-right text-blue-600 font-semibold whitespace-nowrap">
                          {total>0?`₩${fmt(Math.round(total))}`:'-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => openEdit(r)} className="p-1 text-slate-400 hover:text-blue-500 transition-colors">
                            <Edit2 size={14}/>
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => handleDelete(r.id, r.item_name)} disabled={saving} className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50">
                            <Trash2 size={14}/>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </Table>
              </div>
            )
          })}
        </div>
      )}

      {/* 전체 선택 버튼 */}
      {!loading && records.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={toggleSelectAll}
            className="text-sm text-slate-600 hover:text-blue-600 underline"
          >
            {selectedIds.size === records.length ? '전체 선택 해제' : '전체 선택'}
          </button>
        </div>
      )}

      {/* 수정 모달 */}
      {editModal && (
        <Modal title={`입고 수정 - ${editModal.item_name}`} onClose={() => setEditModal(null)}
          footer={<>
            <Btn onClick={() => setEditModal(null)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleEdit} variant="blue" disabled={saving} className="flex-1 justify-center">
              {saving ? '저장 중...' : '수정'}
            </Btn>
          </>}>
          <div className="space-y-3">
            <Field label="입고일 *">
              <input type="date" value={editForm.inbound_date} onChange={set('inbound_date')} className={inputCls}/>
            </Field>
            <Field label="수량 *">
              <input type="text" inputMode="numeric" value={editForm.quantity} onChange={set('quantity')} className={inputCls}/>
            </Field>
            <Field label="단가 ($)">
              <input type="text" inputMode="decimal" value={editForm.unit_price} onChange={set('unit_price')} className={inputCls} placeholder="예: 100.50"/>
            </Field>
            <Field label="환율">
              <input type="text" inputMode="decimal" value={editForm.exchange_rate} onChange={set('exchange_rate')} className={inputCls} placeholder="예: 1300.50"/>
            </Field>
            <Field label="비고">
              <textarea value={editForm.note} onChange={set('note')} className={inputCls} rows={3} placeholder="비고"/>
            </Field>
          </div>
        </Modal>
      )}

      {/* 환율 일괄 적용 모달 */}
      {bulkExchangeModal && (
        <Modal title={`환율 일괄 적용 (${selectedIds.size}개 항목)`} onClose={() => setBulkExchangeModal(false)}
          footer={<>
            <Btn onClick={() => setBulkExchangeModal(false)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleBulkExchangeRate} variant="blue" disabled={saving} className="flex-1 justify-center">
              {saving ? '적용 중...' : '적용'}
            </Btn>
          </>}>
          <div className="space-y-3">
            <Field label="환율">
              <input
                type="text"
                inputMode="decimal"
                value={bulkExchangeRate}
                onChange={e => setBulkExchangeRate(e.target.value)}
                placeholder="예: 1300.50"
                className={inputCls}
                autoFocus
              />
            </Field>
            <p className="text-xs text-slate-500">선택한 {selectedIds.size}개 항목에 동일한 환율이 적용됩니다.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
