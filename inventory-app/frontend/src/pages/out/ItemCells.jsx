import { useState, useRef, useEffect } from 'react'

export const cellCls = "w-full h-full bg-transparent text-xs text-slate-700 focus:outline-none px-2"

// 품명 자동완성 셀
export function AutocompleteCell({ isAvailable, value, onChange, onSelectItem, allItems, dataCell, onKeyDown, onPaste }) {
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
    ? [...new Map(allItems.filter(i => isAvailable(i) && i.item_name.toLowerCase().includes(query.toLowerCase())).map(i => [i.item_name, i])).values()].slice(0, 10)
    : []

  const handleSelect = (item) => {
    onChange(item.item_name)
    onSelectItem(item)
    setQuery(item.item_name)
    setOpen(false)
    setSelectedIndex(-1)
  }

  const handleChange = (newValue) => {
    setQuery(newValue)
    onChange(newValue)
    setOpen(true)
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
    onKeyDown(e)
  }

  return (
    <div className="relative w-full h-full" ref={ref}>
      <input
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { setOpen(true); setSelectedIndex(-1) }}
        onClick={(e) => { e.target.select(); setOpen(true); setSelectedIndex(-1) }}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        data-cell={dataCell}
        className={cellCls}
        placeholder="품명 입력..."
      />
      {open && filtered.length > 0 && (
        <div ref={dropdownRef} className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[200px] max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <div key={i} onMouseDown={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-3 py-2 text-xs text-slate-700 cursor-pointer border-b border-slate-50 last:border-0 ${i === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
              <div className="font-medium">{item.item_name}</div>
              {item.description && <div className="text-slate-400 truncate">{item.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// IP 자동완성 셀 (품명에 따라 필터링)
export function IPSelectCell({ isAvailable, value, onChange, onSelectIP, allItems, currentItemName, usedItemIds, dataCell, onKeyDown, onPaste }) {
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

  // 현재 품명과 일치하는 아이템들 (데모/새제품, 이미 선택된 것 제외)
  const itemsForCurrentName = currentItemName
    ? allItems.filter(i => isAvailable(i) && i.item_name === currentItemName && i.ip && i.ip.trim() && !usedItemIds.has(i.id))
    : []

  const filtered = query.length >= 0
    ? itemsForCurrentName.filter(i => i.ip.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : itemsForCurrentName.slice(0, 10)

  const handleSelect = (item) => {
    onChange(item.ip)
    onSelectIP(item)  // item_id도 업데이트
    setQuery(item.ip)
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
    onKeyDown(e)
  }

  return (
    <div className="relative w-full h-full" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setSelectedIndex(-1) }}
        onFocus={() => { setOpen(true); setSelectedIndex(-1) }}
        onClick={(e) => { e.target.select(); setQuery(''); setOpen(true); setSelectedIndex(-1) }}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        data-cell={dataCell}
        className={cellCls}
        placeholder="Serial/IP 입력..."
      />
      {open && filtered.length > 0 && (
        <div ref={dropdownRef} className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[140px] max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <div key={item.id} onMouseDown={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-3 py-1.5 text-xs text-slate-700 cursor-pointer border-b border-slate-50 last:border-0 font-mono ${i === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
              {item.ip}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
