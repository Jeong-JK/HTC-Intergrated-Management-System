import { useState, useEffect, useRef, useCallback } from 'react'
import { inboundBulk, getConstants, getItems, getSettings, addSetting } from '../api.js'
import { PageHeader, Btn } from './Common.jsx'
import { Plus, Trash2, Save, Search } from 'lucide-react'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import dayjs from 'dayjs'

const TYPES    = ['라디오','안테나','악세사리']
const STATUSES = ['새제품','데모','분실','파손']
const TODAY    = dayjs().format('YYYY-MM-DD')

const EMPTY_ROW = () => ({
  item_type:'라디오', category:'', item_name:'', description:'',
  serial_ip:'', mac:'', serial:'', status:'새제품', quantity:1,
  unit_price:'', exchange_rate:'', note:''
})

const COLS = [
  { key:'item_type',    label:'품목유형',    w:90,  type:'select_type'   },
  { key:'category',     label:'카테고리',    w:140, type:'select_cat'    },
  { key:'item_name',    label:'품명 *',      w:180, type:'autocomplete'  },
  { key:'description',  label:'설명',        w:180, type:'text'          },
  { key:'serial_ip',    label:'Serial / IP', w:130, type:'text'          },
  { key:'mac',          label:'MAC',         w:110, type:'text'          },
  { key:'serial',       label:'S/N',         w:110, type:'text'          },
  { key:'status',       label:'상태',        w:80,  type:'select_status' },
  { key:'quantity',     label:'수량',        w:55,  type:'text'          },
  { key:'unit_price',   label:'단가($)',      w:80,  type:'number'        },
  { key:'exchange_rate',label:'환율',        w:65,  type:'number'        },
  { key:'note',         label:'비고',        w:120, type:'text'          },
]

const cellCls = "w-full h-full bg-transparent text-xs text-slate-700 focus:outline-none px-2"
const selCls  = "w-full h-full bg-transparent text-xs text-slate-700 focus:outline-none px-1 cursor-pointer"

// 품명 자동완성 셀
function AutocompleteCell({ value, onChange, onSelectItem, allItems, dataCell, onKeyDown, onPaste }) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState(value)
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

  const filtered = query.length >= 1
    ? [...new Map(allItems.filter(i => i.item_name.toLowerCase().includes(query.toLowerCase())).map(i => [i.item_name, i])).values()].slice(0, 10)
    : []

  const handleSelect = (item) => {
    onChange(item.item_name)
    onSelectItem(item)
    setQuery(item.item_name)
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
        onFocus={() => { if (query.length >= 1) { setOpen(true); setSelectedIndex(-1) } }}
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

// 카테고리 셀 — 자동완성 + 직접입력
function CategoryCell({ value, onChange, cats, dataCell, onKeyDown, onPaste }) {
  const [open, setOpen]   = useState(false)
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

  const filtered = cats.filter(c => c.toLowerCase().includes((query||'').toLowerCase())).slice(0, 10)

  const handleSelect = (c) => { onChange(c); setQuery(c); setOpen(false); setSelectedIndex(-1) }

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
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        data-cell={dataCell}
        className={cellCls}
        placeholder="카테고리..."
      />
      {open && (filtered.length > 0) && (
        <div ref={dropdownRef} className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[160px] max-h-40 overflow-y-auto">
          {filtered.map((c, i) => (
            <div key={i} onMouseDown={() => handleSelect(c)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-3 py-1.5 text-xs text-slate-700 cursor-pointer border-b border-slate-50 last:border-0 ${i === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InboundSheetPage() {
  const [rows, setRows]       = useState(() => Array.from({length:20}, EMPTY_ROW))
  const [saving, setSaving]   = useState(false)
  const [result, setResult]   = useState(null)
  const [constants, setConstants] = useState({ categories:{} })
  const [settings, setSettings]   = useState({})
  const [allItems, setAllItems]   = useState([])
  const [inboundDate, setInboundDate] = useState(TODAY)
  const tableRef = useRef(null)

  useScrollRestore('inbound_sheet', [rows])

  useEffect(() => {
    getConstants().then(r => setConstants(r.data))
    getSettings().then(r => setSettings(r.data))
    getItems({}).then(r => setAllItems(r.data))
  }, [])

  const setCell = (i, k, v) => setRows(prev => prev.map((r, idx) => idx===i ? {...r, [k]: v} : r))

  const handleSelectItem = (rowIdx, item) => {
    setRows(prev => prev.map((r, idx) => idx===rowIdx ? {
      ...r,
      item_name:   item.item_name,
      description: item.description || r.description,
      category:    item.category    || r.category,
      item_type:   item.item_type   || r.item_type,
    } : r))
  }

  const handleKeyDown = (e, i, colIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const next = tableRef.current?.querySelector(`[data-cell="${i+1}-${colIdx}"]`)
      if (next) next.focus()
      else addRows(1)
    }
  }

  const handlePaste = (e, startRow, startCol) => {
    e.preventDefault()
    const pasteData = e.clipboardData.getData('text')
    if (!pasteData) return

    // 탭과 줄바꿈으로 파싱
    const lines = pasteData.split('\n').map(line => line.split('\t'))

    // 필요한 행 수 계산 및 추가
    const neededRows = startRow + lines.length
    let newRows = [...rows]
    if (neededRows > newRows.length) {
      newRows = [...newRows, ...Array.from({length: neededRows - newRows.length}, EMPTY_ROW)]
    }

    // 데이터 채우기
    lines.forEach((cells, lineIdx) => {
      const rowIdx = startRow + lineIdx
      if (rowIdx >= newRows.length) return

      cells.forEach((value, cellIdx) => {
        const colIdx = startCol + cellIdx
        if (colIdx >= COLS.length) return

        const colKey = COLS[colIdx].key
        newRows[rowIdx] = { ...newRows[rowIdx], [colKey]: value.trim() }
      })

      // 품명이 붙여넣기 되었으면 자동 매칭
      const itemNameColIdx = COLS.findIndex(c => c.key === 'item_name')
      if (startCol <= itemNameColIdx && itemNameColIdx < startCol + cells.length) {
        const pastedName = newRows[rowIdx].item_name
        if (pastedName) {
          // 정확히 일치하는 아이템 찾기 (설명 자동 채움)
          const matched = allItems.find(i => i.item_name === pastedName)
          if (matched) {
            newRows[rowIdx] = {
              ...newRows[rowIdx],
              description: matched.description || '',
              item_type: matched.item_type || newRows[rowIdx].item_type,
              category: matched.category || newRows[rowIdx].category
            }
          }
        }
      }
    })

    setRows(newRows)
  }

  const addRows = (n=5) => setRows(prev => [...prev, ...Array.from({length:n}, EMPTY_ROW)])
  const removeRow = (i) => setRows(prev => prev.filter((_,idx)=>idx!==i))

  const clearAll = () => {
    if (!confirm('전체 초기화할까요?')) return
    setRows(Array.from({length:20}, EMPTY_ROW)); setResult(null)
  }

  const handleSave = async () => {
    if (saving) return // 중복 호출 방지
    const filled = rows.filter(r => r.item_name.trim())
    if (filled.length === 0) { alert('품명을 입력하세요'); return }
    setSaving(true); setResult(null)

    try {
      // 새 카테고리 있으면 설정에 추가
      for (const r of filled) {
        if (r.category && r.item_type) {
          const key = `category_${r.item_type}`
          const existing = settings[key] || []
          if (!existing.includes(r.category)) {
            await addSetting(key, r.category)
          }
        }
      }

      const items = filled.map(r => {
        const unitPrice = r.unit_price && r.unit_price.trim() !== '' ? parseFloat(r.unit_price) : 0
        const exchangeRate = r.exchange_rate && r.exchange_rate.trim() !== '' ? parseFloat(r.exchange_rate) : 0

        console.log('[입고등록] 품명:', r.item_name, '| 단가:', r.unit_price, '->', unitPrice, '| 환율:', r.exchange_rate, '->', exchangeRate)

        return {
          item_type:     r.item_type,
          category:      r.category,
          item_name:     r.item_name.trim(),
          description:   r.description,
          ip:            r.serial_ip,
          mac:           r.mac,
          serial:        r.serial,
          status:        r.status,
          rack_no:       '',
          box_no:        '',
          unit_price:    unitPrice,
          exchange_rate: exchangeRate,
          supplier:      '',
          inbound_date:  inboundDate,
          note:          r.note,
          quantity:      parseInt(r.quantity) || 1,
          license_key:   '',
        }
      })
      console.log('[입고등록] 전송할 데이터:', items)
      await inboundBulk({ items })
      setResult({ ok: true, count: filled.length })
      setRows(Array.from({length:20}, EMPTY_ROW))
      // allItems 갱신
      getItems({}).then(r => setAllItems(r.data))
    } catch(e) {
      setResult({ ok: false, msg: e.response?.data?.detail || '저장 실패' })
    } finally { setSaving(false) }
  }

  const filledCount = rows.filter(r => r.item_name.trim()).length

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="제품 입고" sub={filledCount > 0 ? `${filledCount}개 입력됨` : '품명을 입력하면 자동 인식됩니다'}>
        <Btn onClick={clearAll} variant="red">초기화</Btn>
        <Btn onClick={()=>addRows(10)}>행 추가 (+10)</Btn>
        <Btn onClick={handleSave} variant="primary" disabled={saving||filledCount===0}>
          <Save size={14}/> {saving?'저장 중...':`${filledCount}개 입고처리`}
        </Btn>
      </PageHeader>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">입고일:</label>
        <input
          type="date"
          value={inboundDate}
          onChange={e => setInboundDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
        />
        <span className="text-xs text-slate-400 ml-2">모든 행에 적용됩니다</span>
      </div>

      {result && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${result.ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-600'}`}>
          {result.ok ? `✓ ${result.count}개 입고처리 완료` : `✗ ${result.msg}`}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse" ref={tableRef}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-2 py-2.5 text-xs text-slate-400 font-semibold w-8 border-r border-slate-200">#</th>
                {COLS.map(c => (
                  <th key={c.key} className="px-2 py-2.5 text-xs text-slate-500 font-semibold whitespace-nowrap border-r border-slate-200 text-left uppercase tracking-wide" style={{minWidth:c.w}}>
                    {c.label}
                  </th>
                ))}
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const filled = !!row.item_name.trim()
                const cats = settings[`category_${row.item_type}`] || constants.categories?.[row.item_type] || []
                return (
                  <tr key={i} className={`border-b border-slate-100 h-9 ${filled?'bg-blue-50/30':i%2===0?'bg-white':'bg-slate-50/50'}`}>
                    <td className="text-center text-xs text-slate-300 border-r border-slate-100 w-8">{i+1}</td>
                    {COLS.map((col, ci) => (
                      <td key={col.key} className="border-r border-slate-100 p-0 h-9" style={{minWidth:col.w}}>
                        {col.type==='select_type' && (
                          <select value={row.item_type} onChange={e=>{ setCell(i,'item_type',e.target.value); setCell(i,'category','') }}
                            className={selCls} data-cell={`${i}-${ci}`} onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}>
                            {TYPES.map(t=><option key={t}>{t}</option>)}
                          </select>
                        )}
                        {col.type==='select_cat' && (
                          <CategoryCell value={row.category} onChange={v=>setCell(i,'category',v)}
                            cats={cats} dataCell={`${i}-${ci}`} onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}/>
                        )}
                        {col.type==='autocomplete' && (
                          <AutocompleteCell
                            value={row.item_name}
                            onChange={v=>setCell(i,'item_name',v)}
                            onSelectItem={item=>handleSelectItem(i,item)}
                            allItems={allItems}
                            dataCell={`${i}-${ci}`}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}
                          />
                        )}
                        {col.type==='select_status' && (
                          <select value={row.status} onChange={e=>setCell(i,'status',e.target.value)}
                            className={selCls} data-cell={`${i}-${ci}`} onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}>
                            {STATUSES.map(s=><option key={s}>{s}</option>)}
                          </select>
                        )}
                        {col.type==='text' && (
                          <input type="text" value={row[col.key]}
                            onChange={e=>setCell(i,col.key,e.target.value)}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}
                            data-cell={`${i}-${ci}`}
                            className={cellCls}
                            inputMode={col.key==='quantity'?'decimal':'text'}
                          />
                        )}
                        {col.type==='number' && (
                          <input type="text" value={row[col.key]}
                            onChange={e=>{
                              const val = e.target.value
                              // 숫자, 소수점만 허용 (빈 값도 허용)
                              if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                setCell(i,col.key,val)
                              }
                            }}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}
                            data-cell={`${i}-${ci}`}
                            className={cellCls}
                            inputMode="decimal"
                            placeholder="0"
                          />
                        )}
                      </td>
                    ))}
                    <td className="w-8 text-center">
                      {filled && (
                        <button onClick={()=>removeRow(i)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={12}/>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span>· 품명 입력 시 자동완성 제공</span>
        <span>· Enter키로 다음 행 이동</span>
        <span>· <strong className="text-blue-600">데이터 복사 후 첫 셀에 붙여넣기 가능</strong></span>
        <span>· 새 카테고리 입력 시 자동 등록</span>
        <span>· 비어있는 행은 저장 시 무시</span>
      </div>
    </div>
  )
}
