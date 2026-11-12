import { useState, useEffect, useRef } from 'react'
import { getItemNames, getItemsByName } from '../api.js'
import { PageHeader, Table, Spinner, Empty, Btn } from '../components/Common.jsx'
import { RefreshCw, Search, X } from 'lucide-react'
import ScrollToTop from '../components/ScrollToTop.jsx'

function StatusBadge({ status }) {
  const COLORS = {
    '대여가능': 'bg-yellow-50 text-yellow-700 border-yellow-400',
    '대여중': 'bg-orange-50 text-orange-700 border-orange-400',
    '납품예정': 'bg-green-50 text-green-700 border-green-400',
    '새제품': 'bg-blue-50 text-blue-700 border-blue-400',
    '분실': 'bg-red-50 text-red-700 border-red-400',
    '파손': 'bg-red-50 text-red-700 border-red-400',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-300'}`}>
      {status}
    </span>
  )
}

// 품명 자동완성 컴포넌트
function ItemNameAutocomplete({ value, onChange, itemNames }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const ref = useRef(null)

  useEffect(() => { setQuery(value) }, [value])

  // 외부 클릭 감지
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = query.length >= 1
    ? itemNames.filter(name => name.toLowerCase().includes(query.toLowerCase())).slice(0, 15)
    : itemNames.slice(0, 15)

  const handleSelect = (name) => {
    onChange(name)
    setQuery(name)
    setOpen(false)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && filtered.length > 0) {
        // 드롭다운에서 선택한 항목이 있으면 그것 선택
        handleSelect(filtered[selectedIndex])
      } else if (filtered.length > 0) {
        // 없으면 첫 번째 항목 선택
        handleSelect(filtered[0])
      } else if (query.trim()) {
        // 드롭다운에 없어도 입력값으로 검색
        onChange(query.trim())
        setOpen(false)
      }
      return
    }
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
      }
    }
  }

  return (
    <div className="relative w-full" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setSelectedIndex(-1) }}
        onFocus={() => { setOpen(true); setSelectedIndex(-1) }}
        onKeyDown={handleKeyDown}
        placeholder="품명을 입력하세요..."
        className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400"
      />
      {query && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onChange(''); setQuery(''); setOpen(false) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X size={14}/>
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-full max-h-64 overflow-y-auto mt-1">
          {filtered.map((name, i) => (
            <div key={i} onMouseDown={() => handleSelect(name)}
              className={`px-3 py-2 text-sm text-slate-700 cursor-pointer border-b border-slate-50 last:border-0 ${i === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StockDetail() {
  const [itemNames, setItemNames] = useState([])
  const [selectedName, setSelectedName] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadItemNames()
    // 활동 로그 '화면 열기': ?name=품명&q=시리얼
    const p = new URLSearchParams(window.location.search)
    if (p.get('name')) { setSelectedName(p.get('name')); setSearch(p.get('q') || '') }
  }, [])

  const loadItemNames = async () => {
    try {
      const res = await getItemNames(true)  // 악세사리 제외
      setItemNames(res.data || [])
    } catch (err) {
      console.error('Failed to load item names:', err)
    }
  }

  useEffect(() => {
    if (selectedName) {
      loadItems()
    }
  }, [selectedName])

  const loadItems = async () => {
    if (!selectedName) return
    setLoading(true)
    try {
      const res = await getItemsByName(selectedName)
      setItems(res.data || [])
    } catch (err) {
      console.error('Failed to load items:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(item => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (item.serial || '').toLowerCase().includes(q) ||
      (item.ip || '').toLowerCase().includes(q) ||
      (item.mac || '').toLowerCase().includes(q) ||
      (item.rack_no || '').toLowerCase().includes(q) ||
      (item.box_no || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="재고상세" sub={`총 ${filtered.length}개`}>
        <Btn onClick={loadItems}><RefreshCw size={14} className={loading?'animate-spin':''}/></Btn>
      </PageHeader>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="w-[350px]">
          <ItemNameAutocomplete
            value={selectedName}
            onChange={setSelectedName}
            itemNames={itemNames}
          />
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Serial, IP, MAC, 위치 검색..."
            className="bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 w-64"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14}/>
            </button>
          )}
        </div>
      </div>

      <Table headers={['Serial/IP', '상태', '업체명', '비고']}>
        {loading && <Spinner/>}
        {!loading && filtered.length === 0 && <Empty/>}
        {!loading && filtered.map((item, idx) => {
          // 업체명: 대여중이면 rental_company, 납품예정이면 delivery_company
          const companyName = item.actual_status === '대여중' ? item.rental_company
            : item.actual_status === '납품예정' ? item.delivery_company
            : null

          return (
            <tr key={item.id} className="inv-row border-b border-slate-100"
              style={{background: idx%2===0?'#ffffff':'#f8fafc'}}>
              <td className="px-4 py-2.5 mono text-sm font-semibold text-slate-700">{item.ip || '-'}</td>
              <td className="px-4 py-2.5"><StatusBadge status={item.actual_status || item.status}/></td>
              <td className="px-4 py-2.5 text-sm font-medium text-orange-600">{companyName || '-'}</td>
              <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[200px]">{item.note || '-'}</td>
            </tr>
          )
        })}
      </Table>

      <ScrollToTop />
    </div>
  )
}
