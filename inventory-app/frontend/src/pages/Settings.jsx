import { useState, useEffect } from 'react'
import { getSettings, addSetting, deleteSetting } from '../api.js'
import { PageHeader, Btn } from '../components/Common.jsx'
import { Plus, Trash2, RefreshCw, Edit2, Check, X } from 'lucide-react'
import axios from 'axios'
import { useScrollRestore } from '../hooks/useScrollRestore.js'

const api = axios.create({ baseURL: '/api' })
const updateSetting = (type, oldVal, newVal) => api.put(`/settings/${encodeURIComponent(type)}/${encodeURIComponent(oldVal)}`, { new_value: newVal })
const reorderSetting = (type, values) => api.put(`/settings/${encodeURIComponent(type)}/order`, { values })

const SECTIONS = [
  { key: 'rack',              label: '위치',                color: 'blue'   },
  { key: 'box',               label: '박스 번호',           color: 'blue'   },
  { key: 'category_라디오',   label: '카테고리 — 라디오',   color: 'indigo' },
  { key: 'category_안테나',   label: '카테고리 — 안테나',   color: 'sky'    },
  { key: 'category_악세사리', label: '카테고리 — 악세사리', color: 'orange' },
  { key: 'status',            label: '상태',                color: 'slate'  },
]

const COLORS = {
  blue:   { tag: 'bg-blue-50 border-blue-200 text-blue-700',     btn: 'bg-blue-600 hover:bg-blue-700'     },
  indigo: { tag: 'bg-indigo-50 border-indigo-200 text-indigo-700', btn: 'bg-indigo-600 hover:bg-indigo-700' },
  sky:    { tag: 'bg-sky-50 border-sky-200 text-sky-700',         btn: 'bg-sky-600 hover:bg-sky-700'       },
  orange: { tag: 'bg-orange-50 border-orange-200 text-orange-700', btn: 'bg-orange-500 hover:bg-orange-600' },
  slate:  { tag: 'bg-slate-100 border-slate-200 text-slate-600',  btn: 'bg-slate-600 hover:bg-slate-700'  },
}

function SettingSection({ sectionKey, label, color, values, onRefresh }) {
  const [input, setInput]     = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [localVals, setLocalVals] = useState([...values])
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const c = COLORS[color] || COLORS.slate

  useEffect(() => {
    // 변경사항이 없을 때만 서버 데이터로 업데이트
    if (!hasChanges) {
      setLocalVals([...values])
    }
  }, [values, hasChanges])

  const handleAdd = async () => {
    if (!input.trim()) return
    await addSetting(sectionKey, input.trim())
    setInput(''); onRefresh()
  }

  const handleDelete = async (v) => {
    if (!confirm(`"${v}" 를 삭제할까요?`)) return
    await deleteSetting(sectionKey, v); onRefresh()
  }

  const handleEdit = async (oldVal) => {
    if (!editVal.trim() || editVal === oldVal) { setEditIdx(null); return }
    await updateSetting(sectionKey, oldVal, editVal.trim())
    setEditIdx(null); onRefresh()
  }

  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= localVals.length) return
    const newVals = [...localVals]
    ;[newVals[i], newVals[j]] = [newVals[j], newVals[i]]
    setLocalVals(newVals)
    setHasChanges(true)
  }

  const handleSaveOrder = async () => {
    setSaving(true)
    try {
      await reorderSetting(sectionKey, localVals)
      setHasChanges(false)
      // 서버에 저장 성공했으므로 저장 상태 해제
      setSaving(false)
    } catch (error) {
      console.error('순서 저장 실패:', error)
      // 에러 발생 시 원래 순서로 복구
      setLocalVals([...values])
      setSaving(false)
      setHasChanges(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        {hasChanges && (
          <button onClick={handleSaveOrder}
            className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors">
            <Check size={12}/> 순서 저장
          </button>
        )}
      </div>
      <div className="space-y-1.5 mb-4">
        {localVals.length === 0 && <p className="text-xs text-slate-300 py-2">항목이 없습니다</p>}
        {localVals.map((v, i) => (
          <div key={v} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100">
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button onClick={()=>move(i,-1)} disabled={i===0} className="text-slate-300 hover:text-slate-500 disabled:opacity-20 leading-none text-xs">▲</button>
              <button onClick={()=>move(i,1)} disabled={i===localVals.length-1} className="text-slate-300 hover:text-slate-500 disabled:opacity-20 leading-none text-xs">▼</button>
            </div>
            {editIdx === i ? (
              <input value={editVal} onChange={e=>setEditVal(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') handleEdit(v); if(e.key==='Escape') setEditIdx(null) }}
                autoFocus className="flex-1 text-xs border border-blue-300 rounded px-2 py-0.5 focus:outline-none"/>
            ) : (
              <span className={`flex-1 text-xs font-medium px-1.5 py-0.5 rounded border ${c.tag}`}>{v}</span>
            )}
            <div className="flex gap-1 flex-shrink-0">
              {editIdx === i ? (
                <>
                  <button onClick={()=>handleEdit(v)} className="p-1 text-green-500 hover:text-green-700"><Check size={13}/></button>
                  <button onClick={()=>setEditIdx(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={13}/></button>
                </>
              ) : (
                <>
                  <button onClick={()=>{ setEditIdx(i); setEditVal(v) }} className="p-1 text-slate-300 hover:text-blue-500"><Edit2 size={13}/></button>
                  <button onClick={()=>handleDelete(v)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleAdd()}
          placeholder="새 항목 입력 후 Enter"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400"/>
        <button onClick={handleAdd}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors ${c.btn}`}>
          <Plus size={14}/> 추가
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [data, setData]       = useState({})
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await getSettings()
      setData(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useScrollRestore('settings', [data])

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="드롭다운 관리" sub="드래그로 순서 변경, 클릭으로 수정/삭제">
        <Btn onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/></Btn>
      </PageHeader>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-5">
        {SECTIONS.map(s => (
          <SettingSection key={s.key} sectionKey={s.key} label={s.label} color={s.color}
            values={data[s.key]||[]} onRefresh={load}/>
        ))}
      </div>
    </div>
  )
}
