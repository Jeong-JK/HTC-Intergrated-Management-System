import { useState, useEffect } from 'react'
import { getSummary, getStats } from '../api.js'
import { Table, Spinner, Empty, fmt } from '../components/Common.jsx'
import { RefreshCw, Search } from 'lucide-react'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import ItemDetailModal from '../components/ItemDetailModal.jsx'

const TYPE_COLORS = {
  '라디오':   'text-blue-600',
  '안테나':   'text-sky-600',
  '악세사리': 'text-orange-500',
}

const STATUS_BADGE = {
  '새제품': 'bg-blue-50 text-blue-700 border border-blue-200',
  '데모':   'bg-amber-50 text-amber-700 border border-amber-200',
  '분실':   'bg-red-50 text-red-600 border border-red-200',
  '파손':   'bg-purple-50 text-purple-700 border border-purple-200',
}

export default function Dashboard() {
  const [rows, setRows]       = useState([])
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail]   = useState(null)
  const [search, setSearch]   = useState('')
  const [showTypes, setShowTypes] = useState({ '라디오': true, '안테나': true, '악세사리': true })
  const [showNew,   setShowNew]   = useState(true)
  const [showDemo,  setShowDemo]  = useState(true)

  useScrollRestore('dashboard', [rows])

  const load = async (preserveScroll = false) => {
    setLoading(true)

    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

    try {
      const [s, st] = await Promise.all([getSummary(), getStats()])
      setRows(s.data)
      setStats(st.data)

      if (scrollPosition !== null && mainContainer) {
        requestAnimationFrame(() => {
          mainContainer.scrollTop = scrollPosition
        })
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = rows.filter(r => {
    if (!showTypes[r.item_type]) return false
    if (!showNew  && r.status === '새제품') return false
    if (!showDemo && r.status === '데모')   return false
    if (search) {
      const q = search.toLowerCase()
      return r.item_name.toLowerCase().includes(q) ||
             (r.category||'').toLowerCase().includes(q) ||
             (r.description||'').toLowerCase().includes(q)
    }
    return true
  })

  const grouped = filtered.reduce((acc, r) => {
    if (!acc[r.item_type]) acc[r.item_type] = []
    acc[r.item_type].push(r)
    return acc
  }, {})

  const toggleType = (t) => setShowTypes(prev => ({ ...prev, [t]: !prev[t] }))

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">재고현황</h1>
          {stats && (
            <p className="text-slate-400 text-sm mt-0.5">
              전체 <span className="text-blue-600 font-semibold">{fmt(stats.overview?.total)}</span>개 &nbsp;·&nbsp;
              대여중 <span className="text-amber-500 font-semibold">{stats.active_rentals}</span> &nbsp;·&nbsp;
              연체 <span className="text-red-500 font-semibold">{stats.overdue}</span> &nbsp;·&nbsp;
              납품예정 <span className="text-sky-500 font-semibold">{stats.pending_delivery}</span>
            </p>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-400 hover:text-slate-700 bg-white transition-colors">
          <RefreshCw size={14} className={loading?'animate-spin':''}/>
        </button>
      </div>

      {/* 필터 바 */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-5 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="품명, 카테고리 검색..."
            className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 w-52"/>
        </div>

        <div className="h-4 w-px bg-slate-200"/>

        <span className="text-xs text-slate-400">품목</span>
        {['라디오','안테나','악세사리'].map(t => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showTypes[t]} onChange={()=>toggleType(t)} className="w-4 h-4 rounded accent-blue-500"/>
            <span className={`text-sm font-medium ${TYPE_COLORS[t]}`}>{t}</span>
            <span className="text-xs text-slate-400">({rows.filter(r=>r.item_type===t).length})</span>
          </label>
        ))}

        <div className="h-4 w-px bg-slate-200"/>

        <span className="text-xs text-slate-400">구분</span>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={showNew} onChange={e=>setShowNew(e.target.checked)} className="w-4 h-4 rounded accent-blue-500"/>
          <span className="text-sm text-slate-600">새제품</span>
          <span className="text-xs text-slate-400">({rows.filter(r=>r.status==='새제품').length})</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={showDemo} onChange={e=>setShowDemo(e.target.checked)} className="w-4 h-4 rounded accent-amber-500"/>
          <span className="text-sm text-slate-600">데모</span>
          <span className="text-xs text-slate-400">({rows.filter(r=>r.status==='데모').length})</span>
        </label>
      </div>

      {/* 품목 유형별 테이블 */}
      {['라디오','안테나','악세사리'].map(type => {
        const typeRows = grouped[type]
        if (!typeRows || typeRows.length === 0) return null
        return (
          <div key={type} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className={`text-sm font-bold ${TYPE_COLORS[type]}`}>{type}</h2>
              <span className="text-xs text-slate-400">{typeRows.length}개 항목</span>
            </div>
            <Table headers={['카테고리','품명','구분','설명','현 수량','대여중','납품예정','총 수량','비고','']}>
              {loading && <Spinner/>}
              {!loading && typeRows.map((r, idx) => (
                <tr key={idx} className="inv-row border-b border-slate-100 cursor-pointer"
                  style={{background: idx%2===0?'#ffffff':'#f8fafc'}}
                  onClick={() => setDetail(r)}>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">{r.category||'-'}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{r.item_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[r.status]||'bg-slate-100 text-slate-500'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[200px] truncate">{r.description||'-'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {(r.stock_qty||0) === 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold" style={{backgroundColor: '#ef4444', color: 'white', border: '1px solid #dc2626'}}>
                        {r.stock_qty||0}
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded font-mono font-semibold">
                        {r.stock_qty||0}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.rental_qty > 0
                      ? <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold" style={{backgroundColor: '#f97316', color: 'white', border: '1px solid #ea580c'}}>{r.rental_qty}</span>
                      : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.pending_qty > 0
                      ? <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold" style={{backgroundColor: '#22c55e', color: 'white', border: '1px solid #16a34a'}}>{r.pending_qty}</span>
                      : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="font-bold text-slate-700 mono">{r.total_qty}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[120px] truncate">{r.note||'-'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-slate-300 hover:text-blue-500 transition-colors">상세 →</span>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )
      })}

      {detail && (
        <ItemDetailModal
          itemName={detail.item_name}
          category={detail.category}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
