import { useState, useEffect, useCallback } from 'react'
import { getItems, getInbound, createInbound, deleteInbound } from '../api.js'
import { GradeBadge, PageHeader, Table, Spinner, Empty, Btn, Modal, Field, inputCls } from './Common.jsx'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import dayjs from 'dayjs'

export default function InboundPage({ itemType }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [items, setItems]     = useState([])
  const [form, setForm]       = useState({ item_id:'', quantity:1, supplier:'', inbound_date:dayjs().format('YYYY-MM-DD'), unit_price:'', exchange_rate:'1', note:'' })
  const [saving, setSaving]   = useState(false)
  const [formErr, setFormErr] = useState('')

  useScrollRestore(`inbound_page_${itemType}`, [records])

  const load = useCallback(async (preserveScroll = false) => {
    setLoading(true)

    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

    try {
      const r = await getInbound({ item_type: itemType })
      setRecords(r.data)

      if (scrollPosition !== null && mainContainer) {
        requestAnimationFrame(() => {
          mainContainer.scrollTop = scrollPosition
        })
      }
    } finally { setLoading(false) }
  }, [itemType])

  useEffect(() => { load() }, [load])

  const loadItems = async () => {
    const r = await getItems({ item_type: itemType })
    setItems(r.data)
  }

  const openAdd = () => { loadItems(); setShowAdd(true) }

  const handleAdd = async () => {
    if (!form.item_id) { setFormErr('장비를 선택하세요'); return }
    setSaving(true)
    try {
      await createInbound({ ...form, item_id: parseInt(form.item_id), quantity: parseInt(form.quantity)||1 })
      setShowAdd(false)
      setForm({ item_id:'', quantity:1, supplier:'', inbound_date:dayjs().format('YYYY-MM-DD'), unit_price:'', exchange_rate:'1', note:'' })
      load(true)
    } catch(e) { setFormErr(e.response?.data?.detail||'저장 실패') }
    finally { setSaving(false) }
  }

  const handleDelete = async (r) => {
    if (!confirm('입고 기록을 삭제할까요?')) return
    await deleteInbound(r.id); load(true)
  }

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  return (
    <div className="p-6 min-h-full">
      <PageHeader title={`${itemType} 입고`} sub={`총 ${records.length}건`}>
        <Btn onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/></Btn>
        <Btn onClick={openAdd} variant="primary"><Plus size={14}/> 입고 등록</Btn>
      </PageHeader>

      <Table headers={['#','장비명','카테고리','구분','시리얼/IP','공급처','수량','단가','입고일','비고','']}>
        {loading && <Spinner/>}
        {!loading && records.length===0 && <Empty/>}
        {!loading && records.map((r, idx) => (
          <tr key={r.id} className="inv-row border-b border-border/50" style={{background:idx%2===0?'#0f150f':'#111811'}}>
            <td className="px-3 py-2 mono text-dim text-xs">{r.id}</td>
            <td className="px-3 py-2 font-medium text-text">{r.item_name}</td>
            <td className="px-3 py-2 text-xs text-dim">{r.category||'-'}</td>
            <td className="px-3 py-2"><GradeBadge grade={r.grade}/></td>
            <td className="px-3 py-2 mono text-xs text-dim">
              {r.serial && <div>S/N: {r.serial}</div>}
              {!r.serial && '-'}
            </td>
            <td className="px-3 py-2 text-accent">{r.supplier||'-'}</td>
            <td className="px-3 py-2 mono text-center">{r.quantity}</td>
            <td className="px-3 py-2 mono text-xs text-right whitespace-nowrap">
              {r.unit_price ? `₩${Number(r.unit_price).toLocaleString()}` : '-'}
            </td>
            <td className="px-3 py-2 mono text-xs whitespace-nowrap">{r.inbound_date}</td>
            <td className="px-3 py-2 text-xs text-dim max-w-[120px] truncate">{r.note||'-'}</td>
            <td className="px-3 py-2">
              <button onClick={()=>handleDelete(r)} className="p-1 text-dim hover:text-red transition-colors"><Trash2 size={13}/></button>
            </td>
          </tr>
        ))}
      </Table>

      {showAdd && (
        <Modal title={`${itemType} 입고 등록`} onClose={()=>setShowAdd(false)}
          footer={<>
            <Btn onClick={()=>setShowAdd(false)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleAdd} variant="primary" disabled={saving} className="flex-1 justify-center">{saving?'저장 중...':'등록'}</Btn>
          </>}>
          <div className="space-y-3">
            <Field label="장비 선택 *">
              <select value={form.item_id} onChange={set('item_id')} className={inputCls}>
                <option value="">-- 장비 선택 --</option>
                {items.map(i=>(
                  <option key={i.id} value={i.id}>
                    [{i.category}] {i.item_name} {i.serial?`S/N:${i.serial}`:''} ({i.grade})
                  </option>
                ))}
              </select>
            </Field>
            {[
              {k:'supplier',     l:'공급처',   t:'text'},
              {k:'quantity',     l:'수량',      t:'number'},
              {k:'unit_price',   l:'단가 (₩)', t:'number'},
              {k:'exchange_rate',l:'환율',      t:'number'},
              {k:'inbound_date', l:'입고일',    t:'date'},
              {k:'note',         l:'비고',      t:'text'},
            ].map(({k,l,t})=>(
              <Field key={k} label={l}><input type={t} value={form[k]} onChange={set(k)} className={inputCls}/></Field>
            ))}
            {formErr && <p className="text-red text-xs">{formErr}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
