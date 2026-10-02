import { useState, useEffect, useRef } from 'react'
import { getSettings, updateItemRack, addSetting } from '../api.js'
import { Settings, Plus, X, Check } from 'lucide-react'

// 렉/박스 관리 팝업
function RackManager({ racks, boxes, onClose, onSaved }) {
  const [newRack, setNewRack] = useState('')
  const [newBox,  setNewBox]  = useState('')
  const [localRacks, setLocalRacks] = useState([...racks])
  const [localBoxes, setLocalBoxes] = useState([...boxes])

  const handleAddRack = async () => {
    if (!newRack.trim()) return
    await addSetting('rack', newRack.trim())
    setLocalRacks(p => [...new Set([...p, newRack.trim()])])
    setNewRack('')
    onSaved()
  }

  const handleAddBox = async () => {
    if (!newBox.trim()) return
    await addSetting('box', newBox.trim())
    setLocalBoxes(p => [...new Set([...p, newBox.trim()])])
    setNewBox('')
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-sm">Rack / Box 관리</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* 렉 목록 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">위치</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {localRacks.map(r => (
                <span key={r} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-lg">
                  {r}
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input value={newRack} onChange={e=>setNewRack(e.target.value)}
                placeholder="새 위치" onKeyDown={e=>{ if(e.key==='Enter') handleAddRack() }}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"/>
              <button onClick={handleAddRack}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><Plus size={12}/></button>
            </div>
          </div>

          {/* 박스 목록 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">박스 번호</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {localBoxes.map(b => (
                <span key={b} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-lg">
                  {b}
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input value={newBox} onChange={e=>setNewBox(e.target.value)}
                placeholder="새 박스 번호" onKeyDown={e=>{ if(e.key==='Enter') handleAddBox() }}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"/>
              <button onClick={handleAddBox}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><Plus size={12}/></button>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">확인</button>
        </div>
      </div>
    </div>
  )
}

// 인라인 위치 셀
export default function RackCell({ item, onUpdated }) {
  const [open, setOpen]       = useState(false)
  const [racks, setRacks]     = useState([])
  const [boxes, setBoxes]     = useState([])
  const [rack, setRack]       = useState(item.rack_no||'')
  const [box,  setBox]        = useState(item.box_no||'')
  const [saving, setSaving]   = useState(false)
  const [showMgr, setShowMgr] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, openUp: false })
  const ref = useRef(null)
  const btnRef = useRef(null)

  const loadRacksBoxes = () => {
    getSettings().then(r => { setRacks(r.data.rack||[]); setBoxes(r.data.box||[]) })
  }

  // 드롭다운 열 때 위치 계산
  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const dropdownHeight = 200 // 대략적인 드롭다운 높이
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight

      setDropdownPos({
        top: openUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        openUp
      })
    }
    setOpen(!open)
  }

  useEffect(() => {
    if (open) loadRacksBoxes()
  }, [open])

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSave = async () => {
    if (saving) return // 중복 호출 방지
    setSaving(true)
    try {
      await updateItemRack(item.id, { rack_no: rack, box_no: box })
      onUpdated()
      setOpen(false)
    } finally { setSaving(false) }
  }

  const display = [item.rack_no, item.box_no].filter(Boolean).join(' / ') || '미지정'

  return (
    <div className="relative" ref={ref}>
      <button ref={btnRef} onClick={handleOpen}
        className={`flex items-center gap-1.5 text-left text-xs mono px-2 py-1 rounded-md border transition-colors whitespace-nowrap
          ${open
            ? 'bg-blue-50 border-blue-300 text-blue-600'
            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
          }`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        {display}
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-64 p-3"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}>
          <div className="space-y-2 mb-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">위치 (직접 입력 가능)</label>
              <input
                type="text"
                list="rack-list"
                value={rack}
                onChange={e=>setRack(e.target.value)}
                placeholder="위치 입력 또는 선택"
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
              />
              <datalist id="rack-list">
                {racks.map(r=><option key={r} value={r}/>)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">박스 (직접 입력 가능)</label>
              <input
                type="text"
                list="box-list"
                value={box}
                onChange={e=>setBox(e.target.value)}
                placeholder="박스 입력 또는 선택"
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400"
              />
              <datalist id="box-list">
                {boxes.map(b=><option key={b} value={b}/>)}
              </datalist>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={()=>setShowMgr(true)}
              className="flex items-center gap-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50">
              <Settings size={11}/> 관리
            </button>
            <button onClick={()=>setOpen(false)}
              className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50">
              {saving ? '저장...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {showMgr && (
        <RackManager
          racks={racks} boxes={boxes}
          onSaved={loadRacksBoxes}
          onClose={() => setShowMgr(false)}
        />
      )}
    </div>
  )
}
