import { useState, useEffect, useRef } from 'react'
import { getItems, getSalesCompanies } from '../../api.js'
import { PageHeader, Btn, Field, inputCls } from '../../components/Common.jsx'
import { Plus, Trash2, Save } from 'lucide-react'
import { useScrollRestore } from '../../hooks/useScrollRestore.js'
import dayjs from 'dayjs'
import axios from 'axios'

const TODAY = dayjs().format('YYYY-MM-DD')

const EMPTY_ROW = () => ({
  item_id: null,
  item_name: '',
  description: '',
  serial_ip: '',
  quantity: 1,
  note: ''
})

const COLS = [
  { key:'item_name',    label:'품명 *',      w:180, type:'autocomplete' },
  { key:'description',  label:'설명',        w:300, type:'text' },
  { key:'serial_ip',    label:'Serial / IP', w:140, type:'ip_select' },
  { key:'quantity',     label:'수량',        w:55,  type:'text' },
  { key:'note',         label:'비고',        w:120, type:'text' },
]

const cellCls = "w-full h-full bg-transparent text-xs text-slate-700 focus:outline-none px-2"

// 품명 자동완성 셀
function AutocompleteCell({ value, onChange, onSelectItem, allItems, dataCell, onKeyDown }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const ref = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { setQuery(value) }, [value])

  const filtered = query.length >= 1
    ? [...new Map(allItems.filter(i => i.item_name.toLowerCase().includes(query.toLowerCase())).map(i => [i.item_name, i])).values()].slice(0, 10)
    : []

  useEffect(() => {
    if (open && filtered.length > 0) {
      setSelectedIndex(0)
    }
  }, [open, filtered.length])

  useEffect(() => {
    if (listRef.current && open) {
      const selected = listRef.current.children[selectedIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, open])

  const handleSelect = (item) => {
    onChange(item.item_name)
    onSelectItem(item)
    setQuery(item.item_name)
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSelect(filtered[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
    }
    onKeyDown(e)
  }

  return (
    <div className="relative w-full h-full" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => query.length >= 1 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        data-cell={dataCell}
        className={cellCls}
        placeholder="품명 입력..."
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[200px] max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <div key={i} onMouseDown={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-3 py-2 text-xs cursor-pointer border-b border-slate-50 last:border-0 ${
                i === selectedIndex ? 'bg-blue-100 text-slate-900' : 'text-slate-700 hover:bg-blue-50'
              }`}>
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
function IPSelectCell({ value, onChange, allItems, currentItemName, dataCell, onKeyDown }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const ref = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { setQuery(value) }, [value])

  // 현재 품명과 일치하는 아이템들의 IP만 추출
  const itemsForCurrentName = currentItemName
    ? allItems.filter(i => i.item_name === currentItemName && i.ip && i.ip.trim())
    : []

  const ipList = [...new Set(itemsForCurrentName.map(i => i.ip))]

  const filtered = query.length >= 1
    ? ipList.filter(ip => ip.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : ipList.slice(0, 10)

  useEffect(() => {
    if (open && filtered.length > 0) {
      setSelectedIndex(0)
    }
  }, [open, filtered.length])

  useEffect(() => {
    if (listRef.current && open) {
      const selected = listRef.current.children[selectedIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, open])

  const handleSelect = (ip) => {
    onChange(ip)
    setQuery(ip)
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSelect(filtered[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
    }
    onKeyDown(e)
  }

  return (
    <div className="relative w-full h-full" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        data-cell={dataCell}
        className={cellCls}
        placeholder="Serial/IP 입력..."
      />
      {open && filtered.length > 0 && (
        <div ref={listRef} className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[140px] max-h-48 overflow-y-auto">
          {filtered.map((ip, i) => (
            <div key={i} onMouseDown={() => handleSelect(ip)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-3 py-1.5 text-xs cursor-pointer border-b border-slate-50 last:border-0 font-mono ${
                i === selectedIndex ? 'bg-blue-100 text-slate-900' : 'text-slate-700 hover:bg-blue-50'
              }`}>
              {ip}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OutRental() {
  const [rows, setRows] = useState(() => Array.from({length:20}, EMPTY_ROW))
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [allItems, setAllItems] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const tableRef = useRef(null)

  // 공통 정보
  const [header, setHeader] = useState({
    borrower: '',
    contact_name: '',
    contact_phone: '',
    purpose: '',
    rent_date: TODAY,
    expected_return: ''
  })

  useScrollRestore('out_rental', [rows])

  useEffect(() => {
    getItems({}).then(r => setAllItems(r.data))
    getSalesCompanies().then(r => setCompanies(r.data)).catch(console.error)
  }, [])

  const setCell = (i, k, v) => setRows(prev => prev.map((r, idx) => idx===i ? {...r, [k]: v} : r))

  const handleSelectItem = (rowIdx, item) => {
    setRows(prev => prev.map((r, idx) => idx===rowIdx ? {
      ...r,
      item_id: item.id,
      item_name: item.item_name,
      description: item.description || r.description,
      serial_ip: r.serial_ip, // Serial/IP는 자동으로 채우지 않음
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

  const addRows = (n=5) => setRows(prev => [...prev, ...Array.from({length:n}, EMPTY_ROW)])
  const removeRow = (i) => setRows(prev => prev.filter((_,idx)=>idx!==i))

  const clearAll = () => {
    if (!confirm('전체 초기화할까요?')) return
    setRows(Array.from({length:20}, EMPTY_ROW))
    setHeader({ borrower: '', contact_name: '', contact_phone: '', purpose: '', rent_date: TODAY, expected_return: '' })
    setResult(null)
  }

  // 업체명 선택
  const handleCompanySelect = (e) => {
    const companyName = e.target.value
    const company = companies.find(c => c.company_name === companyName)

    if (company) {
      setSelectedCompany(company)
      setHeader(h => ({...h, borrower: company.company_name, contact_name: '', contact_phone: ''}))
    } else {
      setSelectedCompany(null)
      setHeader(h => ({...h, borrower: companyName, contact_name: '', contact_phone: ''}))
    }
  }

  // 담당자 선택
  const handleContactSelect = (contactName) => {
    if (!selectedCompany) return

    const contact = selectedCompany.contacts.find(c => c.name === contactName)
    if (contact) {
      setHeader(h => ({...h, contact_name: contact.name, contact_phone: contact.phone || ''}))
    } else {
      setHeader(h => ({...h, contact_name: contactName}))
    }
  }

  const handleSave = async () => {
    if (!header.borrower.trim()) { alert('업체명을 입력하세요'); return }

    const filled = rows.filter(r => r.item_name.trim())
    if (filled.length === 0) { alert('품명을 입력하세요'); return }

    setSaving(true)
    setResult(null)

    try {
      // 각 품목마다 대여 등록
      for (const row of filled) {
        await axios.post('/api/rentals', {
          item_id: row.item_id,
          borrower: header.borrower,
          contact_name: header.contact_name,
          contact_phone: header.contact_phone,
          purpose: header.purpose,
          quantity: parseInt(row.quantity) || 1,
          rent_date: header.rent_date,
          expected_return: header.expected_return || null,
          note: row.note
        })
      }

      setResult({ ok: true, count: filled.length })
      setRows(Array.from({length:20}, EMPTY_ROW))
      setHeader({ borrower: '', contact_name: '', contact_phone: '', purpose: '', rent_date: TODAY, expected_return: '' })
      setSelectedCompany(null)
      getItems({}).then(r => setAllItems(r.data))
    } catch(e) {
      setResult({ ok: false, msg: e.response?.data?.detail || '저장 실패' })
    } finally { setSaving(false) }
  }

  const filledCount = rows.filter(r => r.item_name.trim()).length

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="대여 등록" sub={filledCount > 0 ? `${filledCount}개 입력됨` : '업체명과 품명을 입력하세요'}>
        <Btn onClick={clearAll} variant="red">초기화</Btn>
        <Btn onClick={()=>addRows(10)}>행 추가 (+10)</Btn>
        <Btn onClick={handleSave} variant="yellow" disabled={saving||filledCount===0||!header.borrower.trim()}>
          <Save size={14}/> {saving?'저장 중...':`${filledCount}개 대여등록`}
        </Btn>
      </PageHeader>

      {result && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${result.ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-600'}`}>
          {result.ok ? `✓ ${result.count}개 대여등록 완료` : `✗ ${result.msg}`}
        </div>
      )}

      {/* 공통 정보 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">대여 정보</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="업체명 *">
            <input
              type="text"
              list="company-list"
              value={header.borrower}
              onChange={handleCompanySelect}
              placeholder="업체명을 입력하거나 선택하세요"
              className={inputCls}
            />
            <datalist id="company-list">
              {companies.map(c => (
                <option key={c.id} value={c.company_name} />
              ))}
            </datalist>
          </Field>

          <Field label="담당자명">
            <input
              type="text"
              list="contact-list"
              value={header.contact_name}
              onChange={(e) => {
                const val = e.target.value
                setHeader(h => ({...h, contact_name: val}))
                handleContactSelect(val)
              }}
              placeholder="담당자명을 입력하거나 선택하세요"
              className={inputCls}
            />
            {selectedCompany && selectedCompany.contacts && selectedCompany.contacts.length > 0 && (
              <datalist id="contact-list">
                {selectedCompany.contacts.map((contact, idx) => (
                  <option key={idx} value={contact.name}>
                    {contact.position && `${contact.position}`}
                  </option>
                ))}
              </datalist>
            )}
          </Field>

          <Field label="전화번호">
            <input
              type="text"
              value={header.contact_phone}
              onChange={e => setHeader(h => ({...h, contact_phone: e.target.value}))}
              placeholder="전화번호"
              className={inputCls}
            />
          </Field>

          <Field label="대여사유">
            <input
              type="text"
              value={header.purpose}
              onChange={e => setHeader(h => ({...h, purpose: e.target.value}))}
              placeholder="대여사유"
              className={inputCls}
            />
          </Field>

          <Field label="대여일 *">
            <input
              type="date"
              value={header.rent_date}
              onChange={e => setHeader(h => ({...h, rent_date: e.target.value}))}
              className={inputCls}
            />
          </Field>

          <Field label="반납예정일">
            <div className="flex gap-2">
              <input
                type="date"
                value={header.expected_return}
                onChange={e => setHeader(h => ({...h, expected_return: e.target.value}))}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setHeader(h => ({...h, expected_return: ''}))}
                className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                미정
              </button>
            </div>
          </Field>
        </div>
      </div>

      {/* 품목 테이블 */}
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
                return (
                  <tr key={i} className={`border-b border-slate-100 h-9 ${filled?'bg-yellow-50/30':i%2===0?'bg-white':'bg-slate-50/50'}`}>
                    <td className="text-center text-xs text-slate-300 border-r border-slate-100 w-8">{i+1}</td>
                    {COLS.map((col, ci) => (
                      <td key={col.key} className="border-r border-slate-100 p-0 h-9" style={{minWidth:col.w}}>
                        {col.type==='autocomplete' && (
                          <AutocompleteCell
                            value={row.item_name}
                            onChange={v=>setCell(i,'item_name',v)}
                            onSelectItem={item=>handleSelectItem(i,item)}
                            allItems={allItems}
                            dataCell={`${i}-${ci}`}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                          />
                        )}
                        {col.type==='ip_select' && (
                          <IPSelectCell
                            value={row.serial_ip}
                            onChange={v=>setCell(i,'serial_ip',v)}
                            allItems={allItems}
                            currentItemName={row.item_name}
                            dataCell={`${i}-${ci}`}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                          />
                        )}
                        {col.type==='text' && (
                          <input type="text" value={row[col.key]}
                            onChange={e=>setCell(i,col.key,e.target.value)}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                            data-cell={`${i}-${ci}`}
                            className={cellCls}
                            inputMode={col.key==='quantity'?'decimal':'text'}
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
        <span>· 비어있는 행은 저장 시 무시</span>
      </div>
    </div>
  )
}
