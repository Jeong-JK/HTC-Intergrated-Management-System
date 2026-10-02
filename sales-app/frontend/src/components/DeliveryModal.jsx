import { useState } from 'react'
import { createDelivery } from '../api.js'
import { Modal, Field, inputCls, Btn } from './Common.jsx'
import dayjs from 'dayjs'

export default function DeliveryModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    client:'', quantity:1, unit_price:'',
    delivery_date: dayjs().format('YYYY-MM-DD'), status:'납품완료', note:''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const totalPreview = (parseFloat(form.unit_price)||0) * (parseInt(form.quantity)||1)

  const handleSave = async () => {
    if (!form.client.trim()) { setError('납품처를 입력하세요'); return }
    setSaving(true)
    try {
      await createDelivery({ ...form, item_id: item.id, quantity: parseInt(form.quantity)||1 })
      onSaved()
    } catch(e) { setError(e.response?.data?.detail||'저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="납품 등록" sub={`${item.item_name} · ${item.serial||item.ip||''}`} onClose={onClose}
      footer={<>
        <Btn onClick={onClose} className="flex-1 justify-center">취소</Btn>
        <Btn onClick={handleSave} variant="blue" disabled={saving} className="flex-1 justify-center">
          {saving?'저장 중...':'납품 등록'}
        </Btn>
      </>}>
      <div className="space-y-3">
        {[
          {k:'client',        l:'납품처 *',   t:'text'},
          {k:'quantity',      l:'수량',        t:'number'},
          {k:'unit_price',    l:'단가 (₩)',   t:'number'},
          {k:'delivery_date', l:'납품일',      t:'date'},
        ].map(({k,l,t})=>(
          <Field key={k} label={l}>
            <input type={t} value={form[k]} onChange={set(k)} className={inputCls}/>
          </Field>
        ))}
        <Field label="납품 상태">
          <select value={form.status} onChange={set('status')} className={inputCls}>
            <option>납품예정</option>
            <option>납품완료</option>
          </select>
        </Field>
        <Field label="비고">
          <input value={form.note} onChange={set('note')} className={inputCls}/>
        </Field>
        {totalPreview > 0 && (
          <div className="p-2 bg-card border border-border rounded text-xs">
            <span className="text-dim">납품금액: </span>
            <span className="text-accent2 mono font-semibold">₩{totalPreview.toLocaleString()}</span>
          </div>
        )}
        {error && <p className="text-red text-xs">{error}</p>}
      </div>
    </Modal>
  )
}
