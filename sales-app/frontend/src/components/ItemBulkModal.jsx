import { useState, useEffect } from 'react'
import { createBulkItem, getConstants } from '../api.js'
import { Modal, Field, inputCls, Btn } from './Common.jsx'
import { Plus, Trash2 } from 'lucide-react'

const DEFAULTS = {
  rack_no:'', box_no:'', item_type:'라디오', category:'', item_name:'',
  description:'', status:'데모', license_key:'', purchase_date:'', unit_price:'', exchange_rate:'1', note:''
}

export default function ItemBulkModal({ defaultType, onClose, onSaved }) {
  const [form, setForm]           = useState({ ...DEFAULTS, item_type: defaultType||'라디오' })
  const [entries, setEntries]     = useState([{ serial:'', ip:'', mac:'', note:'' }])
  const [constants, setConstants] = useState({ categories:{}, statuses:[] })
  const [customCat, setCustomCat] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { getConstants().then(r => setConstants(r.data)) }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const cats = constants.categories?.[form.item_type] || []

  const setEntry = (i, k) => e => setEntries(prev => prev.map((en, idx) => idx===i ? {...en, [k]: e.target.value} : en))
  const addEntry    = () => setEntries(prev => [...prev, { serial:'', ip:'', mac:'', note:'' }])
  const removeEntry = (i) => setEntries(prev => prev.filter((_,idx) => idx!==i))

  const handleSave = async () => {
    if (!form.item_name.trim()) { setError('품명은 필수입니다'); return }
    setSaving(true); setError('')
    try {
      await createBulkItem({ ...form, entries })
      onSaved()
    } catch(e) { setError(e.response?.data?.detail || '저장 실패') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="여러개 추가" onClose={onClose}
      footer={<>
        <Btn onClick={onClose} className="flex-1 justify-center">취소</Btn>
        <Btn onClick={handleSave} variant="primary" disabled={saving} className="flex-1 justify-center">
          {saving?'저장 중...':`${entries.length}개 추가`}
        </Btn>
      </>}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="매입일">
          <input type="date" value={form.purchase_date||''} onChange={set('purchase_date')} className={inputCls}/>
        </Field>
        <Field label="상태">
          <select value={form.status} onChange={set('status')} className={inputCls}>
            {(constants.statuses||['새제품','데모','분실','파손']).map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="품목 유형">
          <select value={form.item_type} onChange={e=>{set('item_type')(e);setForm(f=>({...f,category:''}))}} className={inputCls}>
            {(constants.item_types||['라디오','안테나','악세사리']).map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="카테고리">
          <div className="flex gap-1">
            {!customCat ? (
              <>
                <select value={form.category} onChange={set('category')} className={inputCls}>
                  <option value="">선택</option>
                  {cats.map(c=><option key={c}>{c}</option>)}
                </select>
                <button onClick={()=>setCustomCat(true)} className="px-2 bg-card border border-border rounded text-dim hover:text-accent text-xs">직접</button>
              </>
            ) : (
              <>
                <input value={form.category} onChange={set('category')} placeholder="직접 입력" className={inputCls}/>
                <button onClick={()=>setCustomCat(false)} className="px-2 bg-card border border-border rounded text-dim hover:text-accent text-xs">목록</button>
              </>
            )}
          </div>
        </Field>
        <Field label="품명 *" full>
          <input value={form.item_name} onChange={set('item_name')} className={inputCls}/>
        </Field>
        <Field label="렉 선반번호">
          <input value={form.rack_no} onChange={set('rack_no')} className={inputCls}/>
        </Field>
        <Field label="박스">
          <input value={form.box_no} onChange={set('box_no')} className={inputCls}/>
        </Field>
        <Field label="단가 ($)">
          <input type="number" value={form.unit_price} onChange={set('unit_price')} className={inputCls}/>
        </Field>
        <Field label="환율">
          <input type="number" value={form.exchange_rate} onChange={set('exchange_rate')} className={inputCls}/>
        </Field>
        <Field label="설명" full>
          <textarea value={form.description} onChange={set('description')} rows={2} className={inputCls+" resize-none"}/>
        </Field>
      </div>

      {/* Serial / IP 여러줄 */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-dim font-medium">Serial / IP 목록</p>
          <Btn onClick={addEntry} variant="primary" className="text-xs py-1"><Plus size={12}/> 추가</Btn>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs text-dim px-1 mb-1">
            <span>Serial</span><span>IP</span><span>MAC</span><span>비고</span>
          </div>
          {entries.map((en, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="grid grid-cols-4 gap-2 flex-1">
                {['serial','ip','mac','note'].map(k=>(
                  <input key={k} value={en[k]} onChange={setEntry(i,k)} placeholder={k.toUpperCase()}
                    className={inputCls+" py-1.5 text-xs"}/>
                ))}
              </div>
              {entries.length > 1 && (
                <button onClick={()=>removeEntry(i)} className="text-dim hover:text-red transition-colors flex-shrink-0">
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red text-xs mt-3">{error}</p>}
    </Modal>
  )
}
