import { useState, useEffect } from 'react'
import { inboundBulk, getConstants } from '../api.js'
import { Modal, Field, inputCls, Btn } from './Common.jsx'
import { Plus, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'

const EMPTY_ITEM = () => ({
  item_type:'라디오', category:'', item_name:'', description:'',
  serial:'', ip:'', mac:'', status:'새제품', rack_no:'', box_no:'',
  unit_price:'', exchange_rate:'1', purchase_date:'',
  supplier:'', inbound_date: dayjs().format('YYYY-MM-DD'), quantity:1, note:''
})

export default function InboundBulkModal({ onClose, onSaved }) {
  const [rows, setRows]           = useState([EMPTY_ITEM()])
  const [constants, setConstants] = useState({ categories:{}, statuses:[], item_types:[] })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { getConstants().then(r => setConstants(r.data)) }, [])

  const setRow = (i, k) => e => setRows(prev => prev.map((r, idx) => idx===i ? {...r, [k]: e.target.value} : r))
  const addRow    = () => setRows(prev => [...prev, EMPTY_ITEM()])
  const removeRow = (i) => setRows(prev => prev.filter((_,idx) => idx!==i))
  const copyRow   = (i) => setRows(prev => [...prev, {...prev[i]}])

  const handleSave = async () => {
    if (rows.some(r => !r.item_name.trim())) { setError('품명은 필수입니다'); return }
    setSaving(true); setError('')
    try {
      await inboundBulk({ items: rows.map(r => ({...r, quantity: parseInt(r.quantity)||1})) })
      onSaved()
    } catch(e) { setError(e.response?.data?.detail || '저장 실패') }
    finally { setSaving(false) }
  }

  const getCats = (item_type) => constants.categories?.[item_type] || []

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-border rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text">입고처리</h2>
            <p className="text-xs text-dim mt-0.5">여러 품목을 한번에 등록합니다</p>
          </div>
          <button onClick={onClose} className="text-dim hover:text-text text-xl">×</button>
        </div>

        <div className="overflow-auto flex-1 px-6 py-4">
          {/* 헤더 */}
          <div className="grid gap-1 mb-2 text-xs text-dim" style={{gridTemplateColumns:'120px 120px 1fr 80px 100px 90px 80px 80px 80px 80px 90px 40px'}}>
            <span>품목유형</span><span>카테고리</span><span>품명 *</span><span>상태</span>
            <span>Serial</span><span>IP</span><span>렉</span><span>박스</span>
            <span>단가($)</span><span>입고일</span><span>공급처</span><span></span>
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid gap-1 items-center" style={{gridTemplateColumns:'120px 120px 1fr 80px 100px 90px 80px 80px 80px 80px 90px 40px'}}>
                <select value={row.item_type} onChange={e=>{setRow(i,'item_type')(e);setRows(prev=>prev.map((r,idx)=>idx===i?{...r,category:''}:r))}} className={inputCls+" py-1.5 text-xs"}>
                  {(constants.item_types||['라디오','안테나','악세사리']).map(t=><option key={t}>{t}</option>)}
                </select>
                <select value={row.category} onChange={setRow(i,'category')} className={inputCls+" py-1.5 text-xs"}>
                  <option value="">선택</option>
                  {getCats(row.item_type).map(c=><option key={c}>{c}</option>)}
                </select>
                <input value={row.item_name} onChange={setRow(i,'item_name')} placeholder="품명" className={inputCls+" py-1.5 text-xs"}/>
                <select value={row.status} onChange={setRow(i,'status')} className={inputCls+" py-1.5 text-xs"}>
                  {(constants.statuses||['새제품','데모','분실','파손']).map(s=><option key={s}>{s}</option>)}
                </select>
                <input value={row.serial} onChange={setRow(i,'serial')} placeholder="Serial" className={inputCls+" py-1.5 text-xs"}/>
                <input value={row.ip}     onChange={setRow(i,'ip')}     placeholder="IP"     className={inputCls+" py-1.5 text-xs"}/>
                <input value={row.rack_no} onChange={setRow(i,'rack_no')} placeholder="렉" className={inputCls+" py-1.5 text-xs"}/>
                <input value={row.box_no}  onChange={setRow(i,'box_no')}  placeholder="박스" className={inputCls+" py-1.5 text-xs"}/>
                <input type="number" value={row.unit_price} onChange={setRow(i,'unit_price')} placeholder="0" className={inputCls+" py-1.5 text-xs"}/>
                <input type="date" value={row.inbound_date} onChange={setRow(i,'inbound_date')} className={inputCls+" py-1.5 text-xs"}/>
                <input value={row.supplier} onChange={setRow(i,'supplier')} placeholder="공급처" className={inputCls+" py-1.5 text-xs"}/>
                <div className="flex gap-0.5">
                  <button onClick={()=>copyRow(i)} title="복사" className="p-1 text-dim hover:text-accent transition-colors text-xs">⧉</button>
                  {rows.length > 1 && <button onClick={()=>removeRow(i)} className="p-1 text-dim hover:text-red transition-colors"><Trash2 size={12}/></button>}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addRow} className="mt-3 flex items-center gap-1.5 text-xs text-dim hover:text-accent transition-colors">
            <Plus size={13}/> 행 추가
          </button>

          {error && <p className="text-red text-xs mt-3">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <Btn onClick={onClose} className="flex-1 justify-center">취소</Btn>
          <Btn onClick={handleSave} variant="primary" disabled={saving} className="flex-1 justify-center">
            {saving?'저장 중...':`${rows.length}개 입고처리`}
          </Btn>
        </div>
      </div>
    </div>
  )
}
