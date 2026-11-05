import { useState, useRef, useEffect } from 'react'
import { inputCls } from './Common.jsx'

// 업체명 자동완성 컴포넌트
export function CompanyAutocomplete({ value, onChange, companies, onSelectCompany }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const ref = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    if (dropdownRef.current && open && selectedIndex >= 0) {
      const selected = dropdownRef.current.children[selectedIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, open])

  // 외부 클릭 감지
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = query.length >= 0
    ? companies.filter(c => c.company_name.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : companies.slice(0, 10)

  const handleSelect = (company) => {
    onChange(company.company_name)
    onSelectCompany(company)
    setQuery(company.company_name)
    setOpen(false)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        handleSelect(filtered[selectedIndex])
        return
      }
    }
  }

  return (
    <div className="relative w-full" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setSelectedIndex(-1) }}
        onFocus={() => { setOpen(true); setSelectedIndex(-1) }}
        onClick={(e) => { e.target.select(); setQuery(''); setOpen(true); setSelectedIndex(-1) }}
        onKeyDown={handleKeyDown}
        placeholder="업체명을 입력하거나 선택하세요"
        className={inputCls}
      />
      {open && filtered.length > 0 && (
        <div ref={dropdownRef} className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[200px] max-h-48 overflow-y-auto mt-1">
          {filtered.map((company, i) => (
            <div key={company.id} onMouseDown={() => handleSelect(company)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-3 py-2 text-xs text-slate-700 cursor-pointer border-b border-slate-50 last:border-0 ${i === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
              <div className="font-medium">{company.company_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
