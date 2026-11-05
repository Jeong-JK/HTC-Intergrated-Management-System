import { useState, useEffect, useRef } from 'react'
import { getItems, getSalesCompanies } from '../../api.js'
import { PageHeader, Btn, Field, inputCls } from '../../components/Common.jsx'
import { Plus, Trash2, Save, RefreshCw, Printer, RotateCcw } from 'lucide-react'
import { useScrollRestore } from '../../hooks/useScrollRestore.js'
import { usePersistedState } from '../../hooks/usePersistedState.js'
import EditableRentalReceipt from '../../components/EditableRentalReceipt.jsx'
import dayjs from 'dayjs'
import axios from 'axios'
import { CompanyAutocomplete } from '../../components/CompanyAutocomplete.jsx'
import { cellCls, AutocompleteCell, IPSelectCell } from './ItemCells.jsx'

const TODAY = dayjs().format('YYYY-MM-DD')

const EMPTY_ROW = () => ({
  item_id: null,
  item_name: '',
  item_description: '',
  serial_ip: '',
  quantity: 1,
  note: ''
})

const COLS = [
  { key:'item_name',        label:'품명 *',      w:250, type:'autocomplete' },
  { key:'item_description', label:'설명',        w:450, type:'text' },
  { key:'serial_ip',        label:'Serial / IP', w:180, type:'ip_select' },
  { key:'quantity',         label:'수량',        w:28,  type:'text' },
  { key:'note',             label:'비고',        w:250, type:'text' },
]

// 품명/IP 자동완성에 띄울 재고 (대여: 데모 + 새제품)
const isAvailable = i => i.status === '데모' || i.status === '새제품'

const DEFAULT_HEADER = {
  borrower: '',
  contact_name: '',
  contact_position: '',
  contact_phone: '',
  purpose: '',
  rent_date: TODAY,
  expected_return: ''
}

export default function OutRental() {
  const [rows, setRows] = usePersistedState('out_rental_rows', Array.from({length:20}, EMPTY_ROW))
  const [header, setHeader] = usePersistedState('out_rental_header', DEFAULT_HEADER)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [allItems, setAllItems] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const tableRef = useRef(null)

  useScrollRestore('out_rental', [rows])

  useEffect(() => {
    getItems({}).then(r => setAllItems(r.data))
    getSalesCompanies().then(r => setCompanies(r.data)).catch(console.error)
  }, [])

  const refreshDropdowns = () => {
    getItems({}).then(r => setAllItems(r.data)).catch(console.error)
    getSalesCompanies().then(r => setCompanies(r.data)).catch(console.error)
  }

  const setCell = (i, k, v) => setRows(prev => prev.map((r, idx) => idx===i ? {...r, [k]: v} : r))

  // 품명 변경 시 규격도 업데이트
  const handleItemNameChange = (rowIdx, itemName) => {
    setCell(rowIdx, 'item_name', itemName)
    // 정확히 일치하는 품명이 있으면 규격 자동 채우기
    const exactMatch = allItems.find(i => (i.status === '데모' || i.status === '새제품') && i.item_name === itemName)
    if (exactMatch) {
      setCell(rowIdx, 'item_description', exactMatch.description || '')
    } else {
      setCell(rowIdx, 'item_description', '')
    }
  }

  const handleSelectItem = (rowIdx, item) => {
    setRows(prev => prev.map((r, idx) => idx===rowIdx ? {
      ...r,
      item_id: null,  // 품명 선택 시에는 item_id 초기화 (IP 선택 시 설정)
      item_name: item.item_name,
      item_description: item.description || '',
      serial_ip: '',  // Serial/IP도 초기화
    } : r))
  }

  // Serial/IP 선택 시 해당 item의 id로 업데이트
  const handleSelectIP = (rowIdx, item) => {
    setRows(prev => prev.map((r, idx) => idx===rowIdx ? {
      ...r,
      item_id: item.id,
      serial_ip: item.ip,
    } : r))
  }

  // 이미 선택된 item_id 목록 (중복 방지)
  const usedItemIds = new Set(rows.filter(r => r.item_id).map(r => r.item_id))

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
          // 정확히 일치하는 데모/새제품 아이템 찾기
          const matched = allItems.find(i => (i.status === '데모' || i.status === '새제품') && i.item_name === pastedName)
          if (matched) {
            newRows[rowIdx] = {
              ...newRows[rowIdx],
              item_id: matched.id,
              item_description: matched.description || ''
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
    setRows(Array.from({length:20}, EMPTY_ROW))
    setHeader(DEFAULT_HEADER)
    setResult(null)
    setSelectedCompany(null)
  }

  // 업체명 선택
  const handleCompanyChange = (companyName) => {
    setHeader(h => ({...h, borrower: companyName}))
    const company = companies.find(c => c.company_name === companyName)
    if (!company) {
      setSelectedCompany(null)
      setHeader(h => ({...h, contact_name: '', contact_position: '', contact_phone: ''}))
    }
  }

  const handleCompanySelect = (company) => {
    setSelectedCompany(company)
    setHeader(h => ({...h, borrower: company.company_name, contact_name: '', contact_position: '', contact_phone: ''}))
  }

  // 담당자 선택
  const handleContactSelect = (contactName) => {
    if (!selectedCompany) return

    const contact = selectedCompany.contacts.find(c => c.name === contactName)
    if (contact) {
      setHeader(h => ({...h, contact_name: contact.name, contact_position: contact.position || '', contact_phone: contact.phone || ''}))
    } else {
      setHeader(h => ({...h, contact_name: contactName}))
    }
  }

  const handleSave = async () => {
    if (!header.borrower.trim()) { alert('업체명을 입력하세요'); return }

    const filled = rows.filter(r => r.item_name.trim())
    if (filled.length === 0) { alert('품명을 입력하세요'); return }

    // 품목 유효성 검증 및 item_id 연결
    const itemsToSave = []
    for (const row of filled) {
      // 해당 품명의 아이템 정보 조회 (데모/새제품 상태)
      const matchedItems = allItems.filter(i => (i.status === '데모' || i.status === '새제품') && i.item_name === row.item_name)

      if (matchedItems.length === 0) {
        alert(`"${row.item_name}" 품목이 재고에 없거나 대여 가능한 상태가 아닙니다.`)
        return
      }

      const itemType = matchedItems[0].item_type
      const qty = parseInt(row.quantity) || 1

      if (itemType === '악세사리') {
        // 악세사리: 품명으로 item_id 자동 연결, 수량 검증
        const accessoryItem = matchedItems[0]
        const availableQty = accessoryItem.available_quantity ?? accessoryItem.quantity

        if (qty > availableQty) {
          alert(`"${row.item_name}" 대여 가능 수량(${availableQty}개)을 초과했습니다. (요청: ${qty}개)`)
          return
        }

        itemsToSave.push({
          ...row,
          item_id: accessoryItem.id,
          item_type: itemType,
          quantity: qty
        })
      } else {
        // 라디오/안테나: item_id(IP) 필수
        if (!row.item_id) {
          alert(`"${row.item_name}"의 Serial/IP를 선택하세요. (라디오/안테나는 IP 선택 필수)`)
          return
        }

        itemsToSave.push({
          ...row,
          item_type: itemType,
          quantity: qty
        })
      }
    }

    setSaving(true)
    setResult(null)

    try {
      // 각 품목마다 대여 등록
      for (const row of itemsToSave) {
        await axios.post('/api/rentals', {
          item_id: row.item_id,
          item_name: row.item_name,
          description: '', // item_id로 연결되므로 description은 비움
          borrower: header.borrower,
          contact_name: header.contact_name,
          contact_position: header.contact_position,
          contact_phone: header.contact_phone,
          purpose: header.purpose,
          quantity: row.quantity,
          rent_date: header.rent_date,
          expected_return: header.expected_return || null,
          note: row.note
        })
      }

      setResult({ ok: true, count: filled.length })

      // 대여증 데이터 저장
      setReceiptData({
        borrower: header.borrower,
        contact_name: header.contact_name,
        contact_position: header.contact_position,
        contact_phone: header.contact_phone,
        rent_date: header.rent_date,
        expected_return: header.expected_return,
        purpose: header.purpose,
        items: filled.map(row => {
          return {
            item_name: row.item_name,
            description: row.item_description, // 품명의 규격
            serial_ip: row.serial_ip, // Serial/IP
            quantity: row.quantity,
            note: row.note
          }
        })
      })

      setRows(Array.from({length:20}, EMPTY_ROW))
      setHeader(DEFAULT_HEADER)
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
        <Btn onClick={refreshDropdowns} variant="green"><RefreshCw size={14}/> 드롭다운 새로고침</Btn>
        <Btn onClick={clearAll} variant="primary"><RotateCcw size={14}/> 초기화</Btn>
        <Btn onClick={()=>addRows(10)}>행 추가 (+10)</Btn>
        <Btn onClick={handleSave} variant="yellow" disabled={saving||filledCount===0||!header.borrower.trim()}>
          <Save size={14}/> {saving?'저장 중...':`${filledCount}개 대여등록`}
        </Btn>
      </PageHeader>

      {result && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${result.ok?'bg-green-50 border border-green-200 text-green-700':'bg-red-50 border border-red-200 text-red-600'}`}>
          <span>{result.ok ? `✓ ${result.count}개 대여등록 완료` : `✗ ${result.msg}`}</span>
          {result.ok && receiptData && (
            <Btn onClick={() => setShowReceipt(true)} variant="primary">
              <Printer size={14}/> 대여증 출력
            </Btn>
          )}
        </div>
      )}

      {showReceipt && receiptData && (
        <EditableRentalReceipt data={receiptData} onClose={() => setShowReceipt(false)} />
      )}

      {/* 공통 정보 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">대여 정보</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="업체명 *">
            <CompanyAutocomplete
              value={header.borrower}
              onChange={handleCompanyChange}
              companies={companies}
              onSelectCompany={handleCompanySelect}
            />
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
                            isAvailable={isAvailable}
                            value={row.item_name}
                            onChange={v=>handleItemNameChange(i,v)}
                            onSelectItem={item=>handleSelectItem(i,item)}
                            allItems={allItems}
                            dataCell={`${i}-${ci}`}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}
                          />
                        )}
                        {col.type==='readonly' && (
                          <input type="text" value={row[col.key]}
                            readOnly
                            data-cell={`${i}-${ci}`}
                            className={`${cellCls} bg-slate-50 text-slate-500 cursor-not-allowed`}
                            tabIndex={-1}
                          />
                        )}
                        {col.type==='ip_select' && (
                          <IPSelectCell
                            isAvailable={isAvailable}
                            value={row.serial_ip}
                            onChange={v=>setCell(i,'serial_ip',v)}
                            onSelectIP={item=>handleSelectIP(i,item)}
                            allItems={allItems}
                            currentItemName={row.item_name}
                            usedItemIds={new Set([...usedItemIds].filter(id => id !== row.item_id))}
                            dataCell={`${i}-${ci}`}
                            onKeyDown={e=>handleKeyDown(e,i,ci)}
                            onPaste={e=>handlePaste(e,i,ci)}
                          />
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
        <span>· 비어있는 행은 저장 시 무시</span>
      </div>
    </div>
  )
}
