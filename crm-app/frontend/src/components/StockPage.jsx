import { useState, useEffect, useCallback } from 'react'
import { getItems, deleteItem } from '../api.js'
import { StatusBadge, PageHeader, Table, Spinner, Empty, Btn, fmt } from './Common.jsx'
import { Plus, RefreshCw, Trash2, Edit2, Search } from 'lucide-react'
import ItemModal from './ItemModal.jsx'
import RackCell from './RackCell.jsx'
import { usePersistedState } from '../hooks/usePersistedState.js'
import { useScrollRestore } from '../hooks/useScrollRestore.js'

function PriceBadge({ unitPrice, exchangeRate }) {
  const up = parseFloat(unitPrice) || 0
  const er = parseFloat(exchangeRate) || 0
  if (!up) return <span className="text-slate-300 text-xs">-</span>
  if (!er) return <span className="text-amber-500 text-xs font-medium">환율 입력 필요</span>
  return <span className="mono text-xs font-medium text-slate-700">₩{fmt(Math.round(up * er))}</span>
}

export default function StockPage({ itemType, categories, showDesc=false }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = usePersistedState(`stock_search_${itemType}`, '')
  const [filterCat, setFilterCat]       = usePersistedState(`stock_cat_${itemType}`, '')
  const [filterStatus, setFilterStatus] = usePersistedState(`stock_status_${itemType}`, '')
  const [showNew,  setShowNew]  = usePersistedState(`stock_showNew_${itemType}`, true)
  const [showDemo, setShowDemo] = usePersistedState(`stock_showDemo_${itemType}`, true)
  const [showAvailable, setShowAvailable] = usePersistedState(`stock_showAvailable_${itemType}`, false)
  const [editItem, setEditItem] = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)

  useScrollRestore(`stock_${itemType}`, [items])

  const load = useCallback(async (preserveScroll = false) => {
    setLoading(true)

    // 스크롤 위치 저장 (수정/삭제 등의 작업 후 리로드 시)
    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

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
    } finally { setLoading(false) }
  }, [itemType, filterCat, filterStatus, search])

  useEffect(() => { load() }, [load])

  const handleDelete = async (item) => {
    if (!confirm(`"${item.item_name}" 을(를) 삭제할까요?`)) return
    await deleteItem(item.id); load(true)
  }

  const filtered = items.filter(item => {
    if (item.status === '새제품' && !showNew)  return false
    if (item.status === '데모'   && !showDemo) return false
    // 대여가능 필터: 상태가 '데모'인 것만 (대여중이 아닌 데모 장비)
    if (showAvailable && item.status !== '데모') return false
    return true
  })

  return (
    <div className="p-6 min-h-full">
      <PageHeader title={itemType} sub={`총 ${filtered.length}개`}>
        <Btn onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/></Btn>
        <Btn onClick={()=>setShowAdd(true)} variant="primary"><Plus size={14}/> 추가</Btn>
      </PageHeader>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="품명, 시리얼, IP 검색..."
            className="bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 w-56"/>
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
            <span className="text-xs text-slate-400">({items.filter(i=>i.status==='새제품').length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showDemo} onChange={e=>setShowDemo(e.target.checked)} className="w-4 h-4 rounded accent-amber-500"/>
            <span className="text-sm text-slate-600">데모</span>
            <span className="text-xs text-slate-400">({items.filter(i=>i.status==='데모').length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showAvailable} onChange={e=>setShowAvailable(e.target.checked)} className="w-4 h-4 rounded accent-green-500"/>
            <span className="text-sm text-slate-600">대여가능</span>
            <span className="text-xs text-slate-400">({items.filter(i=>i.status==='데모').length})</span>
          </label>
        </div>

        {(filterCat||filterStatus) && (
          <button onClick={()=>{setFilterCat('');setFilterStatus('')}} className="text-xs text-slate-400 hover:text-red-500 transition-colors">초기화</button>
        )}
      </div>

      <Table headers={['위치','카테고리','품명', showDesc ? '설명' : 'Serial / IP','상태','매입일','매입금액','비고','']}>
        {loading && <Spinner/>}
        {!loading && filtered.length===0 && <Empty/>}
        {!loading && filtered.map((item, idx) => (
          <tr key={item.id} className="inv-row border-b border-slate-100"
            style={{background: idx%2===0?'#ffffff':'#f8fafc'}}>
            <td className="px-4 py-2.5"><RackCell item={item} onUpdated={() => load(true)}/></td>
            <td className="px-4 py-2.5 text-xs">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">{item.category||'-'}</span>
            </td>
            <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[180px] truncate">{item.item_name}</td>
            <td className="px-4 py-2.5 text-xs text-slate-500">
              {showDesc ? (
                <span className="text-slate-500">{item.description||'-'}</span>
              ) : (
                <>
                  {item.ip     && <div className="mono">IP: {item.ip}</div>}
                  {item.mac    && <div className="mono">MAC: {item.mac}</div>}
                  {item.serial && <div className="mono">S/N: {item.serial}</div>}
                  {!item.ip && !item.mac && !item.serial && <span className="text-slate-300">-</span>}
                </>
              )}
            </td>
            <td className="px-4 py-2.5"><StatusBadge status={item.status}/></td>
            <td className="px-4 py-2.5 mono text-xs text-slate-400 whitespace-nowrap">{item.purchase_date||'-'}</td>
            <td className="px-4 py-2.5 text-right whitespace-nowrap">
              <PriceBadge unitPrice={item.unit_price} exchangeRate={item.exchange_rate}/>
            </td>
            <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[120px] truncate">{item.note||'-'}</td>
            <td className="px-4 py-2.5">
              <div className="flex gap-1">
                <button onClick={()=>setEditItem(item)} className="p-1 text-slate-300 hover:text-blue-500 transition-colors"><Edit2 size={13}/></button>
                <button onClick={()=>handleDelete(item)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={13}/></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {showAdd   && <ItemModal defaultType={itemType} onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);load(true)}}/>}
      {editItem  && <ItemModal item={editItem} defaultType={itemType} onClose={()=>setEditItem(null)} onSaved={()=>{setEditItem(null);load(true)}}/>}
    </div>
  )
}
