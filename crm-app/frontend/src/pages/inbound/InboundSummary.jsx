import { useState, useEffect } from 'react'
import { getInbound } from '../../api.js'
import { PageHeader, Table, Spinner, Empty, Btn } from '../../components/Common.jsx'
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { usePersistedState } from '../../hooks/usePersistedState.js'
import { useScrollRestore } from '../../hooks/useScrollRestore.js'

const RADIO_CATS = ["BB","EB","OEM","GCS","SBST","SBRT","LBST","LBRT","SL4210","IVAS","SM","KCMVP일체형","MockUp"]
const ANTENNA_CATS = ["Antennas"]

function getItemType(row) {
  if (row.item_type && row.item_type !== '') return row.item_type
  const cat = (row.category||'').toLowerCase()
  if (RADIO_CATS.some(c => c.toLowerCase() === cat)) return '라디오'
  if (ANTENNA_CATS.some(c => c.toLowerCase() === cat)) return '안테나'
  if (cat === 'antennas' || cat.includes('antenna')) return '안테나'
  return '악세사리'
}

export default function InboundSummary() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = usePersistedState('inbound_summary_search', '')
  const [year, setYear]       = usePersistedState('inbound_summary_year', dayjs().year())

  useScrollRestore('inbound_summary', [rows])

  const load = async () => {
    setLoading(true)
    try {
      const r = await getInbound({ year })
      // 날짜 + 품명 기준으로 수량 합산
      const merged = {}
      const order  = []
      for (const row of r.data) {
        const key = `${row.inbound_date}__${row.item_name}`
        if (merged[key]) {
          merged[key].quantity += parseInt(row.quantity) || 0
        } else {
          merged[key] = {
            inbound_date: row.inbound_date,
            item_type:    getItemType(row),
            category:     row.category,
            item_name:    row.item_name,
            quantity:     parseInt(row.quantity) || 0,
          }
          order.push(key)
        }
      }
      setRows(order.map(k => merged[k]))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [year])

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (r.item_name||'').toLowerCase().includes(q) ||
           (r.category||'').toLowerCase().includes(q) ||
           (r.item_type||'').toLowerCase().includes(q)
  })

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="입고 요약" sub={`총 ${filtered.length}건`}>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
          <button onClick={()=>setYear(y=>y-1)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><ChevronLeft size={14}/></button>
          <span className="text-sm font-semibold text-slate-700 w-12 text-center">{year}</span>
          <button onClick={()=>setYear(y=>y+1)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><ChevronRight size={14}/></button>
        </div>
        <Btn onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/></Btn>
      </PageHeader>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="품명, 카테고리 검색..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400"/>
        </div>
      </div>

      <Table headers={['날짜','구분','카테고리','품명','수량']}>
        {loading && <Spinner/>}
        {!loading && filtered.length===0 && <Empty/>}
        {!loading && filtered.map((r, idx) => (
          <tr key={idx} className="border-b border-slate-100" style={{background:idx%2===0?'#ffffff':'#f8fafc'}}>
            <td className="px-4 py-2.5 mono text-xs text-slate-500 whitespace-nowrap">{r.inbound_date}</td>
            <td className="px-4 py-2.5 text-xs text-slate-600">{r.item_type||'-'}</td>
            <td className="px-4 py-2.5 text-xs">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">{r.category||'-'}</span>
            </td>
            <td className="px-4 py-2.5 font-medium text-slate-700">{r.item_name}</td>
            <td className="px-4 py-2.5 mono text-center font-semibold text-blue-600">{r.quantity}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}