import { useState, useEffect } from 'react'
import { createRental, getSalesCompanies } from '../api.js'
import { Modal, Field, inputCls, Btn } from './Common.jsx'
import dayjs from 'dayjs'

export default function RentalModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    borrower:'', contact_name:'', contact_phone:'', purpose:'', quantity:1,
    rent_date: dayjs().format('YYYY-MM-DD'), expected_return:'', note:''
  })
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  // htc_sales DB에서 업체 목록 로드
  useEffect(() => {
    getSalesCompanies().then(res => setCompanies(res.data)).catch(console.error)
  }, [])

  // 업체 선택
  const handleCompanySelect = (e) => {
    const companyName = e.target.value
    const company = companies.find(c => c.company_name === companyName)

    if (company) {
      setSelectedCompany(company)
      setForm(f => ({...f, borrower: company.company_name, contact_name: '', contact_phone: ''}))
    } else {
      setSelectedCompany(null)
      setForm(f => ({...f, borrower: companyName, contact_name: '', contact_phone: ''}))
    }
  }

  // 담당자 선택
  const handleContactSelect = (contactName) => {
    if (!selectedCompany) return

    const contact = selectedCompany.contacts.find(c => c.name === contactName)
    if (contact) {
      setForm(f => ({...f, contact_name: contact.name, contact_phone: contact.phone || ''}))
    } else {
      setForm(f => ({...f, contact_name: contactName}))
    }
  }

  const handleSave = async () => {
    if (!form.borrower.trim()) { setError('대여처를 입력하세요'); return }
    setSaving(true)
    try {
      await createRental({ ...form, item_id: item.id, quantity: parseInt(form.quantity)||1 })
      onSaved()
    } catch(e) { setError(e.response?.data?.detail||'저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="대여 등록" sub={`${item.item_name} · ${item.serial||item.ip||''}`} onClose={onClose}
      footer={<>
        <Btn onClick={onClose} className="flex-1 justify-center">취소</Btn>
        <Btn onClick={handleSave} variant="yellow" disabled={saving} className="flex-1 justify-center">
          {saving?'저장 중...':'대여 등록'}
        </Btn>
      </>}>
      <div className="space-y-3">
        {/* 업체명 입력 (자동완성) */}
        <Field label="업체명 *">
          <input
            type="text"
            list="company-list"
            value={form.borrower}
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

        {/* 담당자명 입력 (자동완성) */}
        <Field label="담당자명">
          <input
            type="text"
            list="contact-list"
            value={form.contact_name}
            onChange={(e) => {
              const val = e.target.value
              setForm(f => ({...f, contact_name: val}))
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

        {/* 전화번호 입력 */}
        <Field label="전화번호">
          <input
            type="text"
            value={form.contact_phone}
            onChange={set('contact_phone')}
            placeholder="전화번호를 입력하세요"
            className={inputCls}
          />
        </Field>

        {[
          {k:'purpose', l:'목적',         t:'text'},
          {k:'quantity',l:'수량',         t:'number'},
          {k:'rent_date',l:'대여일',      t:'date'},
          {k:'expected_return',l:'반납예정일',t:'date'},
          {k:'note',l:'비고',             t:'text'},
        ].map(({k,l,t})=>(
          <Field key={k} label={l}>
            <input type={t} value={form[k]} onChange={set(k)} className={inputCls}/>
          </Field>
        ))}
        {error && <p className="text-red text-xs">{error}</p>}
      </div>
    </Modal>
  )
}
