import { useState, useEffect, useCallback } from 'react'
import { getItems, deleteItem, getSettings, updateItemsLicense, updateItemsLocation } from '../api.js'
import { StatusBadge, PageHeader, Table, Spinner, Empty, Btn, fmt, NoteText } from './Common.jsx'
import { Plus, RefreshCw, Trash2, Edit2, Search, MapPin, X, Key } from 'lucide-react'
import ItemModal from './ItemModal.jsx'
import RackCell from './RackCell.jsx'
import { usePersistedState } from '../hooks/usePersistedState.js'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import ScrollToTop from './ScrollToTop.jsx'

function PriceBadge({ unitPrice, exchangeRate }) {
  const up = parseFloat(unitPrice) || 0
  const er = parseFloat(exchangeRate) || 0
  if (!up) return <span className="text-slate-300 text-xs">-</span>
  if (!er) {
    return (
      <div className="text-xs">
        <div className="mono text-slate-600">${fmt(up)}</div>
        <div className="text-orange-600 font-semibold text-sm mt-0.5">환율입력필요</div>
      </div>
    )
  }
  return <span className="mono text-sm font-semibold text-blue-600">₩{fmt(Math.round(up * er))}</span>
}

export default function StockPage({ itemType, categories, showDesc=false, showQuantity=false }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [filterCat, setFilterCat]       = usePersistedState(`stock_cat_${itemType}`, '')
  const [filterStatus, setFilterStatus] = usePersistedState(`stock_status_${itemType}`, '')
  const [showNew,  setShowNew]  = useState(true)
  const [showDemo, setShowDemo] = useState(true)
  const [showAvailable, setShowAvailable] = usePersistedState(`stock_showAvailable_${itemType}`, false)
  const [editItem, setEditItem] = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())  // 일괄 선택
  const [showLocationModal, setShowLocationModal] = useState(false)  // 위치 일괄변경 모달
  const [showLicenseModal, setShowLicenseModal] = useState(false)  // 라이센스 일괄변경 모달

  useScrollRestore(`stock_${itemType}`, [items])

  const load = useCallback(async (preserveScroll = false) => {
    // 스크롤 위치 저장 (수정/삭제 등의 작업 후 리로드 시)
    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

    // 스크롤 유지 시에는 로딩 상태 변경 안 함 (테이블 유지)
    if (!preserveScroll) {
      setLoading(true)
    }

    try {
      const r = await getItems({
        item_type: itemType,
        category:  filterCat    || undefined,
        status:    filterStatus || undefined,
        search:    search       || undefined,
      })
      setItems(r.data)

      // 스크롤 위치 복원
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
  }, [itemType, filterCat, filterStatus, search])

  useEffect(() => { load() }, [load])

  const handleDelete = async (item) => {
    if (!confirm(`"${item.item_name}" 을(를) 삭제할까요?`)) return
    try {
      await deleteItem(item.id)
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    }
  }

  // 체크박스 토글
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)))
    }
  }

  const filtered = items.filter(item => {
    // 1. 대여가능 필터가 켜져있으면 순수 데모만
    if (showAvailable) {
      return item.status === '데모' && item.actual_status === '데모'
    }

    // 2. 새제품도 데모도 안 체크하면 아무것도 안 보임
    if (!showNew && !showDemo) {
      return false
    }

    // 3. 새제품 그룹: status='새제품' OR actual_status='납품예정'
    const isNewGroup = item.status === '새제품' || item.actual_status === '납품예정'

    // 4. 데모 그룹: status='데모' OR actual_status='대여중' OR status='파손' OR status='분실'
    const isDemoGroup = item.status === '데모' || item.actual_status === '대여중' || item.status === '파손' || item.status === '분실'

    // 5. 필터링
    if (showNew && isNewGroup) return true
    if (showDemo && isDemoGroup) return true

    return false
  })

  return (
    <div className="p-6 min-h-full">
      <PageHeader title={itemType} sub={
          <span className="text-slate-500 text-sm">
            총 <span className="text-blue-600 text-xl font-bold">{filtered.length}</span>개 ·
            새제품 <span className="text-emerald-500 text-xl font-bold">{items.filter(i=>i.status==='새제품').length}</span> ·
            데모 <span className="text-amber-500 text-xl font-bold">{items.filter(i=>i.status==='데모').length}</span> ·
            대여중 <span className="text-orange-500 text-xl font-bold">{items.filter(i=>i.actual_status==='대여중').length}</span>
          </span>
        }>
        {selectedIds.size > 0 && (
          <>
            <Btn onClick={() => setShowLocationModal(true)} variant="secondary">
              <MapPin size={14}/> 위치 일괄변경 ({selectedIds.size}개)
            </Btn>
            <Btn onClick={() => setShowLicenseModal(true)} variant="green">
              <Key size={14}/> 라이센스 일괄변경
            </Btn>
          </>
        )}
        <Btn onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/></Btn>
        <Btn onClick={()=>setShowAdd(true)} variant="primary"><Plus size={14}/> 추가</Btn>
      </PageHeader>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="품명, 시리얼, IP, 라이센스, 비고 검색..."
            className="bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 w-56"/>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14}/>
            </button>
          )}
        </div>
        {categories && (
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-blue-400">
            <option value="">카테고리 전체</option>
            {categories.map(c=><option key={c}>{c}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-blue-400">
          <option value="">상태 전체</option>
          {['새제품','데모','분실','파손'].map(s=><option key={s}>{s}</option>)}
        </select>

        <div className="flex items-center gap-4 ml-2 border-l border-slate-200 pl-4">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showNew} onChange={e=>setShowNew(e.target.checked)} className="w-4 h-4 rounded accent-blue-500"/>
            <span className="text-sm text-slate-600">새제품</span>
            <span className="text-xs text-slate-400">({items.filter(i=>i.status==='새제품' || i.actual_status==='납품예정').length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showDemo} onChange={e=>setShowDemo(e.target.checked)} className="w-4 h-4 rounded accent-amber-500"/>
            <span className="text-sm text-slate-600">데모</span>
            <span className="text-xs text-slate-400">({items.filter(i=>i.status==='데모' || i.actual_status==='대여중' || i.status==='파손' || i.status==='분실').length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showAvailable} onChange={e=>setShowAvailable(e.target.checked)} className="w-4 h-4 rounded accent-green-500"/>
            <span className="text-sm text-slate-600">대여가능</span>
            <span className="text-xs text-slate-400">({items.filter(i=>i.status==='데모' && i.actual_status==='데모').length})</span>
          </label>
        </div>

        {(filterCat||filterStatus) && (
          <button onClick={()=>{setFilterCat('');setFilterStatus('')}} className="text-xs text-slate-400 hover:text-red-500 transition-colors">초기화</button>
        )}
      </div>

      <Table headers={[
          <input key="chk" type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
            onChange={toggleSelectAll} className="w-4 h-4 rounded accent-blue-500"/>,
          '위치','카테고리','품명', showDesc ? '설명' : 'Serial / IP', showQuantity ? '총 수량' : null, showQuantity ? '대여가능/대여중' : null,'상태','매입일','단가 / 환율','비고',''
        ].filter(h => h !== null)}>
        {loading && <Spinner/>}
        {!loading && filtered.length===0 && <Empty/>}
        {!loading && filtered.map((item, idx) => (
          <tr key={item.id} className="inv-row border-b border-slate-100"
            style={{background: idx%2===0?'#ffffff':'#f8fafc'}}>
            <td className="px-4 py-2.5">
              <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                className="w-4 h-4 rounded accent-blue-500"/>
            </td>
            <td className="px-4 py-2.5"><RackCell item={item} onUpdated={() => load(true)}/></td>
            <td className="px-4 py-2.5 text-xs">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">{item.category||'-'}</span>
            </td>
            <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[180px] truncate">{item.item_name}</td>
            <td className={`px-4 py-2.5 text-xs text-slate-500 ${showDesc ? 'max-w-[100px] truncate' : ''}`}>
              {showDesc ? (
                <span className="text-slate-500" title={item.description}>{item.description||'-'}</span>
              ) : (
                <>
                  {item.ip     && <div className="mono">IP: {item.ip}</div>}
                  {item.mac    && <div className="mono">MAC: {item.mac}</div>}
                  {item.serial && <div className="mono">S/N: {item.serial}</div>}
                  {!item.ip && !item.mac && !item.serial && <span className="text-slate-300">-</span>}
                </>
              )}
            </td>
            {showQuantity && (
              <td className="px-4 py-2.5 text-center font-medium text-slate-700">
                {item.quantity || 1}
              </td>
            )}
            {showQuantity && (
              <td className="px-4 py-2.5 text-center font-medium text-slate-700 whitespace-nowrap">
                {item.status !== '새제품' ? (
                  <span>
                    <span className="text-green-600">{item.available_quantity ?? item.quantity}</span>
                    <span className="text-slate-400 mx-0.5">/</span>
                    <span className="text-orange-500">{item.rental_qty || 0}</span>
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
            )}
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <StatusBadge status={item.actual_status || item.status}/>
                {item.actual_status === '대여중' && item.rental_company && (
                  <span className="text-xs text-orange-600 font-medium truncate max-w-[80px]" title={item.rental_company}>
                    → {item.rental_company}
                  </span>
                )}
                {item.actual_status === '납품예정' && item.delivery_company && (
                  <span className="text-xs text-blue-600 font-medium truncate max-w-[80px]" title={item.delivery_company}>
                    → {item.delivery_company}
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-2.5 mono text-xs text-slate-400 whitespace-nowrap">{item.purchase_date||'-'}</td>
            <td className="px-4 py-2.5 text-right whitespace-nowrap">
              <PriceBadge unitPrice={item.unit_price} exchangeRate={item.exchange_rate}/>
            </td>
            <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[120px] truncate"><NoteText text={item.note}/></td>
            <td className="px-4 py-2.5">
              <div className="flex gap-1">
                <button onClick={()=>setEditItem(item)} className="p-1 text-slate-300 hover:text-blue-500 transition-colors" title="수정"><Edit2 size={13}/></button>
                <button onClick={()=>handleDelete(item)} className="p-1 text-slate-300 hover:text-red-500 transition-colors" title="삭제"><Trash2 size={13}/></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {showAdd   && <ItemModal defaultType={itemType} onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);load(true)}}/>}
      {editItem  && <ItemModal item={editItem} defaultType={itemType} onClose={()=>setEditItem(null)} onSaved={()=>{setEditItem(null);load(true)}}/>}
      {showLocationModal && (
        <LocationBulkModal
          selectedIds={selectedIds}
          onClose={() => setShowLocationModal(false)}
          onSaved={() => { setShowLocationModal(false); setSelectedIds(new Set()); load(true) }}
        />
      )}
      {showLicenseModal && (
        <LicenseBulkModal
          selectedIds={selectedIds}
          onClose={() => setShowLicenseModal(false)}
          onSaved={() => { setShowLicenseModal(false); setSelectedIds(new Set()); load(true) }}
        />
      )}

      {/* 하단 플로팅 액션바 - 체크박스 선택 시 표시 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <div className="bg-slate-800 text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-4">
            <span className="text-sm font-medium">
              <span className="text-blue-400">{selectedIds.size}개</span> 선택됨
            </span>
            <div className="w-px h-5 bg-slate-600"/>
            <button
              onClick={() => setShowLocationModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-full text-sm font-medium transition-colors"
            >
              <MapPin size={14}/> 위치 일괄변경
            </button>
            <button
              onClick={() => setShowLicenseModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-500 hover:bg-green-600 rounded-full text-sm font-medium transition-colors"
            >
              <Key size={14}/> 라이센스 일괄변경
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 hover:bg-slate-700 rounded-full transition-colors"
              title="선택 해제"
            >
              <X size={16}/>
            </button>
          </div>
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}

// 라이센스 일괄변경 모달
function LicenseBulkModal({ selectedIds, onClose, onSaved }) {
  const [licenseKey, setLicenseKey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateItemsLicense({
        ids: Array.from(selectedIds),
        license_key: licenseKey
      })
      onSaved()
    } catch (e) {
      alert(e.response?.data?.detail || '라이센스 변경에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          라이센스 일괄 변경 <span className="text-green-500">({selectedIds.size}개)</span>
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">라이센스 키 (펌웨어 버전)</label>
            <input
              type="text"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder="예: FW v2.5.1, License: XXXX-XXXX"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
          </div>
          <p className="text-xs text-slate-400">선택된 {selectedIds.size}개 항목의 라이센스가 동일하게 변경됩니다</p>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {saving ? '변경 중...' : `${selectedIds.size}개 변경`}
          </button>
        </div>
      </div>
    </div>
  )
}

// 위치 일괄변경 모달
function LocationBulkModal({ selectedIds, onClose, onSaved }) {
  const [rackNo, setRackNo] = useState('')
  const [boxNo, setBoxNo] = useState('')
  const [racks, setRacks] = useState([])
  const [boxes, setBoxes] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings().then(r => {
      setRacks(r.data.rack || [])
      setBoxes(r.data.box || [])
    })
  }, [])

  const handleSave = async () => {
    if (!rackNo && !boxNo) {
      alert('렉 또는 박스 중 하나는 입력해주세요')
      return
    }
    setSaving(true)
    try {
      await updateItemsLocation({
        ids: Array.from(selectedIds),
        rack_no: rackNo || undefined,
        box_no: boxNo || undefined
      })
      onSaved()
    } catch (e) {
      alert(e.response?.data?.detail || '위치 변경에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          위치 일괄 변경 <span className="text-blue-500">({selectedIds.size}개)</span>
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">렉 선반번호</label>
            <input
              type="text"
              list="bulk-rack-list"
              value={rackNo}
              onChange={e => setRackNo(e.target.value)}
              placeholder="선택 또는 직접 입력"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <datalist id="bulk-rack-list">
              {racks.map(r => <option key={r} value={r}/>)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">박스</label>
            <input
              type="text"
              list="bulk-box-list"
              value={boxNo}
              onChange={e => setBoxNo(e.target.value)}
              placeholder="선택 또는 직접 입력"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <datalist id="bulk-box-list">
              {boxes.map(b => <option key={b} value={b}/>)}
            </datalist>
          </div>
          <p className="text-xs text-slate-400">빈 칸은 변경되지 않습니다</p>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? '변경 중...' : `${selectedIds.size}개 변경`}
          </button>
        </div>
      </div>
    </div>
  )
}
