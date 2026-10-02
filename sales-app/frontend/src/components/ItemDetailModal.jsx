import { useState, useEffect } from 'react'
import { getDetail } from '../api.js'
import { StatusBadge, Modal, fmt } from './Common.jsx'

export default function ItemDetailModal({ itemName, category, onClose }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getDetail({ item_name: itemName, category })
      .then(r => setRows(r.data))
      .finally(() => setLoading(false))
  }, [itemName, category])

  return (
    <Modal
      title={itemName}
      sub={`${category} · 총 ${rows.length}개`}
      onClose={onClose}
      footer={
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 text-sm transition-colors">닫기</button>
      }
    >
      {loading ? (
        <p className="text-center text-slate-400 py-8">불러오는 중...</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-slate-400 mono w-5">{i+1}</span>
                <div className="min-w-0">
                  {r.ip     && <p className="text-xs mono text-slate-600">IP: {r.ip}</p>}
                  {r.mac    && <p className="text-xs mono text-slate-400">MAC: {r.mac}</p>}
                  {r.serial && <p className="text-xs mono text-slate-600">S/N: {r.serial}</p>}
                  {!r.ip && !r.mac && !r.serial && <p className="text-xs text-slate-400">식별정보 없음</p>}
                  {r.rack_no && <p className="text-xs text-slate-400 mt-0.5">Rack: {r.rack_no} / Box: {r.box_no}</p>}
                  {r.note    && <p className="text-xs text-slate-400 mt-0.5">{r.note}</p>}
                </div>
              </div>
              <StatusBadge status={r.status}/>
            </div>
          ))}
          {rows.length === 0 && <p className="text-center text-slate-400 py-8">데이터가 없습니다</p>}
        </div>
      )}
    </Modal>
  )
}
