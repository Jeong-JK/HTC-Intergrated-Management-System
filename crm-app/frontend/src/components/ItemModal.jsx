import { useState, useEffect } from 'react'
import { createBulkItem, getConstants, getSettings } from '../api.js'
import { Modal, Field, inputCls, Btn } from './Common.jsx'
import { Plus, Trash2 } from 'lucide-react'
import DatePicker from './DatePicker.jsx'

const EMPTY_DEVICE = () => ({ ip:'', mac:'', serial:'', note:'' })

const DEFAULTS = {
  rack_no:'', box_no:'', item_type:'라디오', category:'', item_name:'',
  description:'', status:'데모', license_key:'', purchase_date:null,
  unit_price:0, exchange_rate:1, note:''
}

export default function ItemModal({ item, defaultType, onClose, onSaved }) {
  const isNew = !item?.id
  const [form, setForm]           = useState({ ...DEFAULTS, item_type: defaultType||'라디오', ...(item||{}) })
  const [devices, setDevices]     = useState([EMPTY_DEVICE()])
  const [constants, setConstants] = useState({ categories:{}, statuses:[], item_types:[] })
  const [customCat, setCustomCat] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const [settingCats, setSettingCats] = useState({})

  useEffect(() => {
    getConstants().then(r => setConstants(r.data))
    getSettings().then(r => setSettingCats(r.data))
    if (item?.id) {
      setDevices([{ ip: item.ip||'', mac: item.mac||'', serial: item.serial||'', note: item.note||'' }])
    }
  }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setDev = (i, k) => e => setDevices(prev => prev.map((d, idx) => idx===i ? {...d, [k]: e.target.value} : d))
  const addDev    = () => setDevices(prev => [...prev, EMPTY_DEVICE()])
  const removeDev = (i) => setDevices(prev => prev.filter((_,idx) => idx!==i))

  const cats = settingCats[`category_${form.item_type}`] || constants.categories?.[form.item_type] || []

  const handleSave = async () => {
    if (!form.item_name.trim()) { setError('품명은 필수입니다'); return }
    setSaving(true); setError('')
    try {
      // 데이터 변환: 빈 문자열을 적절한 기본값으로 변환
      const payload = {
        ...form,
        unit_price: form.unit_price === '' || form.unit_price === null ? 0 : parseFloat(form.unit_price) || 0,
        exchange_rate: form.exchange_rate === '' || form.exchange_rate === null ? 1 : parseFloat(form.exchange_rate) || 1,
        purchase_date: (form.purchase_date && form.purchase_date.trim()) ? form.purchase_date : null
      }

      if (isNew) {
        const result = await createBulkItem({ ...payload, entries: devices })
        console.log('✅ 장비 추가 성공:', result)
      } else {
        const { updateItem } = await import('../api.js')
        const result = await updateItem(item.id, {
          ...payload,
          ip: devices[0]?.ip||'',
          mac: devices[0]?.mac||'',
          serial: devices[0]?.serial||'',
          note: devices[0]?.note||''
        })
        console.log('✅ 장비 수정 성공:', result)
      }
      onSaved()
    } catch(e) {
      console.error('❌ 저장 실패:', e)
      const errorMsg = e.response?.data?.detail
        ? (Array.isArray(e.response.data.detail)
          ? e.response.data.detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ')
          : e.response.data.detail)
        : e.message || '저장 실패'
      setError(errorMsg)
    }
    finally { setSaving(false) }
  }

  return (
    <Modal
      title={isNew ? '장비 추가' : '장비 수정'}
      sub={isNew && devices.length > 1 ? `${devices.length}개 장비 등록` : ''}
      onClose={onClose}
      footer={<>
        <Btn onClick={onClose} className="flex-1 justify-center">취소</Btn>
        <Btn onClick={handleSave} variant="primary" disabled={saving} className="flex-1 justify-center">
          {saving ? '저장 중...' : isNew ? `${devices.length}개 추가` : '수정'}
        </Btn>
      </>}
    >
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* 매입일 맨 위 */}
        <Field label="매입일">
          <DatePicker value={form.purchase_date||''} onChange={v=>setForm(f=>({...f,purchase_date:v}))}/>
        </Field>
        <Field label="상태">
          <select value={form.status} onChange={set('status')} className={inputCls}>
            {['새제품','데모','분실','파손'].map(s=><option key={s}>{s}</option>)}
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
                <button onClick={()=>setCustomCat(true)} className="px-2 bg-card border border-border rounded text-dim hover:text-accent text-xs whitespace-nowrap">직접입력</button>
              </>
            ) : (
              <>
                <input value={form.category} onChange={set('category')} placeholder="카테고리" className={inputCls}/>
                <button onClick={()=>setCustomCat(false)} className="px-2 bg-card border border-border rounded text-dim hover:text-accent text-xs whitespace-nowrap">목록</button>
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

        <Field label="라이센스" full>
          <input value={form.license_key} onChange={set('license_key')} className={inputCls}/>
        </Field>
        <Field label="설명" full>
          <textarea value={form.description} onChange={set('description')} rows={2} className={inputCls+" resize-none"}/>
        </Field>
      </div>

      {/* IP / MAC / Serial 목록 */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-dim font-medium">IP / MAC / Serial</p>
          {isNew && <Btn onClick={addDev} variant="primary" className="text-xs py-1"><Plus size={12}/> 행 추가</Btn>}
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs text-dim px-1">
            <span>Serial / IP</span><span>MAC</span><span>S/N</span><span>비고</span>
          </div>
          {devices.map((dev, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="grid grid-cols-4 gap-2 flex-1">
                {['ip','mac','serial','note'].map(k=>(
                  <input key={k} value={dev[k]} onChange={setDev(i,k)} placeholder={k==='ip'?'Serial / IP':k==='serial'?'S/N':k.toUpperCase()}
                    className={inputCls+" py-1.5 text-xs"}/>
                ))}
              </div>
              {isNew && devices.length > 1 && (
                <button onClick={()=>removeDev(i)} className="text-dim hover:text-red transition-colors flex-shrink-0">
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
