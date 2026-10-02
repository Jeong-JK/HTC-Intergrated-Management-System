import { useState, useEffect, useRef } from 'react'
import { Modal, Field, inputCls, Btn, fmt } from '../Common.jsx'
import { Plus, Trash2, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import {
  getCrmCompanies, getCrmCompany,
  getInventoryItemNames,
  createQuotation, updateQuotation, getQuotation
} from '../../api.js'

const EMPTY_ITEM = () => ({
  item_id: null,
  item_name: '',
  description: '',
  quantity: 1,
  unit_price: 0,
  note: ''
})

export default function QuotationModal({ quotationId, preselect, onClose, onSaved }) {
  // Form state
  const [form, setForm] = useState({
    company_id: preselect?.company_id || null,
    contact_id: preselect?.contact_id || null,
    quotation_date: dayjs().format('YYYY-MM-DD'),
    valid_until: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    vat_rate: 10,
    note: ''
  })
  const [items, setItems] = useState([EMPTY_ITEM()])

  // UI state
  const [companies, setCompanies] = useState([])
  const [teams, setTeams] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [inventoryItems, setInventoryItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!!quotationId)

  // Autocomplete state
  const [activeAutocomplete, setActiveAutocomplete] = useState(-1)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [filteredItems, setFilteredItems] = useState([])
  const autocompleteRef = useRef(null)

  // Load companies
  useEffect(() => {
    getCrmCompanies().then(r => setCompanies(r.data || [])).catch(console.error)
  }, [])

  // Load inventory items for autocomplete
  useEffect(() => {
    getInventoryItemNames().then(r => setInventoryItems(r.data || [])).catch(console.error)
  }, [])

  // Load existing quotation for edit
  useEffect(() => {
    if (quotationId) {
      setLoading(true)
      getQuotation(quotationId).then(r => {
        const q = r.data
        setForm({
          company_id: q.company_id,
          contact_id: q.contact_id,
          quotation_date: q.quotation_date,
          valid_until: q.valid_until || '',
          vat_rate: q.vat_rate || 10,
          note: q.note || ''
        })
        setItems(q.items?.length > 0 ? q.items.map(i => ({
          item_id: i.item_id,
          item_name: i.item_name || '',
          description: i.description || '',
          quantity: i.quantity || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          note: i.note || ''
        })) : [EMPTY_ITEM()])

        // Load company info
        if (q.company_id) {
          getCrmCompany(q.company_id).then(cr => {
            setSelectedCompany(cr.data)
            setTeams(cr.data.teams || [])
          }).catch(console.error)
        }
      }).catch(e => {
        setError('견적서를 불러올 수 없습니다')
        console.error(e)
      }).finally(() => setLoading(false))
    }
  }, [quotationId])

  // Load company teams
  useEffect(() => {
    if (form.company_id) {
      getCrmCompany(form.company_id).then(r => {
        setSelectedCompany(r.data)
        setTeams(r.data.teams || [])
        setContacts([])
        setSelectedTeam(null)
      }).catch(console.error)
    }
  }, [form.company_id])

  // Load team contacts
  useEffect(() => {
    if (selectedTeam) {
      const team = teams.find(t => t.id === selectedTeam)
      if (team) {
        // Fetch contacts for this team
        import('../../api.js').then(api => {
          api.getContacts({ team_id: selectedTeam }).then(r => {
            setContacts(r.data || [])
          }).catch(console.error)
        })
      }
    } else {
      setContacts([])
    }
  }, [selectedTeam, teams])

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
        setActiveAutocomplete(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Item row handlers
  const setItem = (i, k, v) => setItems(prev => prev.map((item, idx) =>
    idx === i ? { ...item, [k]: v } : item
  ))
  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM()])
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const copyItem = (i) => setItems(prev => [...prev, { ...prev[i] }])

  // Calculate amounts
  const calcAmount = (item) => (item.quantity || 0) * (parseFloat(item.unit_price) || 0)
  const subtotal = items.reduce((sum, item) => sum + calcAmount(item), 0)
  const vatAmt = subtotal * (form.vat_rate / 100)
  const total = subtotal + vatAmt

  // Autocomplete handlers
  const handleItemNameChange = (i, value) => {
    setItem(i, 'item_name', value)
    setAutocompleteQuery(value)
    setActiveAutocomplete(i)

    if (value.length > 0) {
      const filtered = inventoryItems.filter(inv =>
        inv.item_name.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10)
      setFilteredItems(filtered)
    } else {
      setFilteredItems([])
    }
  }

  const selectInventoryItem = (i, invItem) => {
    setItem(i, 'item_name', invItem.item_name)
    setItem(i, 'description', invItem.description || '')
    setItem(i, 'unit_price', parseFloat(invItem.unit_price) || 0)
    setActiveAutocomplete(-1)
    setFilteredItems([])
  }

  // Save handler
  const handleSave = async () => {
    if (!form.company_id) {
      setError('회사를 선택해주세요')
      return
    }
    if (items.every(item => !item.item_name.trim())) {
      setError('최소 1개의 품목을 입력해주세요')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        ...form,
        items: items.filter(item => item.item_name.trim()).map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          description: item.description,
          quantity: parseInt(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          note: item.note
        }))
      }

      if (quotationId) {
        await updateQuotation(quotationId, payload)
      } else {
        await createQuotation(payload)
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Modal title="견적서" onClose={onClose} size="xl">
        <div className="text-center py-8 text-dim">불러오는 중...</div>
      </Modal>
    )
  }

  return (
    <Modal
      title={quotationId ? '견적서 수정' : '견적서 작성'}
      sub={selectedCompany ? selectedCompany.name : ''}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Btn onClick={onClose} className="flex-1 justify-center">취소</Btn>
          <Btn onClick={handleSave} variant="primary" disabled={saving} className="flex-1 justify-center">
            <FileText size={14} />
            {saving ? '저장 중...' : (quotationId ? '수정' : '작성')}
          </Btn>
        </>
      }
    >
      {/* 기본 정보 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Field label="회사 *">
          <select
            value={form.company_id || ''}
            onChange={e => {
              setForm(f => ({ ...f, company_id: parseInt(e.target.value) || null, contact_id: null }))
              setSelectedTeam(null)
            }}
            className={inputCls}
          >
            <option value="">선택</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="팀">
          <select
            value={selectedTeam || ''}
            onChange={e => setSelectedTeam(parseInt(e.target.value) || null)}
            className={inputCls}
            disabled={!form.company_id}
          >
            <option value="">선택</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>

        <Field label="담당자">
          <select
            value={form.contact_id || ''}
            onChange={e => setForm(f => ({ ...f, contact_id: parseInt(e.target.value) || null }))}
            className={inputCls}
            disabled={!selectedTeam}
          >
            <option value="">선택</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.position && `(${c.position})`}</option>)}
          </select>
        </Field>

        <Field label="견적일">
          <input
            type="date"
            value={form.quotation_date}
            onChange={e => setForm(f => ({ ...f, quotation_date: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <Field label="유효기간">
          <input
            type="date"
            value={form.valid_until}
            onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <Field label="부가세율 (%)">
          <input
            type="number"
            value={form.vat_rate}
            onChange={e => setForm(f => ({ ...f, vat_rate: parseFloat(e.target.value) || 0 }))}
            className={inputCls}
            min="0"
            max="100"
          />
        </Field>

        <Field label="비고" full>
          <input
            type="text"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="견적 관련 메모"
            className={inputCls}
          />
        </Field>
      </div>

      {/* 품목 테이블 */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-dim mb-2">품목</h3>

        {/* 헤더 */}
        <div
          className="grid gap-2 mb-2 text-xs text-dim font-medium"
          style={{ gridTemplateColumns: '40px 1fr 1fr 80px 120px 120px 80px 60px' }}
        >
          <span>No</span>
          <span>품명 *</span>
          <span>설명</span>
          <span>수량</span>
          <span>단가</span>
          <span>금액</span>
          <span>비고</span>
          <span></span>
        </div>

        {/* 품목 행 */}
        <div className="space-y-2" ref={autocompleteRef}>
          {items.map((item, i) => (
            <div
              key={i}
              className="grid gap-2 items-center relative"
              style={{ gridTemplateColumns: '40px 1fr 1fr 80px 120px 120px 80px 60px' }}
            >
              <span className="text-xs text-dim text-center">{i + 1}</span>

              {/* 품명 with autocomplete */}
              <div className="relative">
                <input
                  value={item.item_name}
                  onChange={e => handleItemNameChange(i, e.target.value)}
                  onFocus={() => {
                    setActiveAutocomplete(i)
                    if (item.item_name) handleItemNameChange(i, item.item_name)
                  }}
                  placeholder="품명 입력 또는 선택"
                  className={inputCls + " py-1.5 text-xs"}
                />
                {activeAutocomplete === i && filteredItems.length > 0 && (
                  <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredItems.map((inv, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectInventoryItem(i, inv)}
                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <div className="font-medium">{inv.item_name}</div>
                        {inv.category && <div className="text-dim text-[10px]">{inv.item_type} / {inv.category}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input
                value={item.description}
                onChange={e => setItem(i, 'description', e.target.value)}
                placeholder="설명"
                className={inputCls + " py-1.5 text-xs"}
              />

              <input
                type="number"
                value={item.quantity}
                onChange={e => setItem(i, 'quantity', parseInt(e.target.value) || 1)}
                min="1"
                className={inputCls + " py-1.5 text-xs text-right"}
              />

              <input
                type="number"
                value={item.unit_price}
                onChange={e => setItem(i, 'unit_price', e.target.value)}
                placeholder="0"
                className={inputCls + " py-1.5 text-xs text-right"}
              />

              <div className="text-xs text-right font-medium text-slate-600 pr-2">
                ₩{fmt(calcAmount(item))}
              </div>

              <input
                value={item.note}
                onChange={e => setItem(i, 'note', e.target.value)}
                placeholder="비고"
                className={inputCls + " py-1.5 text-xs"}
              />

              <div className="flex gap-1 justify-center">
                <button onClick={() => copyItem(i)} title="복사" className="p-1 text-dim hover:text-blue-500 transition-colors text-xs">⧉</button>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="p-1 text-dim hover:text-red-500 transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 행 추가 버튼 */}
        <button onClick={addItem} className="mt-3 flex items-center gap-1.5 text-xs text-dim hover:text-blue-500 transition-colors">
          <Plus size={13} /> 품목 추가
        </button>
      </div>

      {/* 합계 */}
      <div className="border-t border-slate-100 pt-4 flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-dim">소계</span>
            <span className="font-medium">₩{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">부가세 ({form.vat_rate}%)</span>
            <span className="font-medium">₩{fmt(Math.round(vatAmt))}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-2">
            <span>합계</span>
            <span className="text-blue-600">₩{fmt(Math.round(total))}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
    </Modal>
  )
}
