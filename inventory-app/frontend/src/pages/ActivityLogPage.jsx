import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Table, Btn, Modal, inputCls } from '../components/Common.jsx'
import { getActivityLogs, getActivityRecord, undoActivity } from '../api.js'

const SYSTEMS = [['', '전체 시스템'], ['hub', '메인허브'], ['inventory', '재고'], ['worklog', '업무일지'], ['sales', 'Sales'], ['crm', 'CRM']]
const fmt = (s) => (s ? s.replace('T', ' ').slice(0, 16) : '-')

function ago(s) {
  if (!s) return '기록 없음'
  const min = Math.floor((Date.now() - new Date(s)) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`
}

// 관리자/'활동 로그 조회' 권한: 전체 기록 + 마지막 로그인. 그 외 사용자: 내 활동(본인 기록)만. 30일 안의 변경은 되돌리기
export default function ActivityLogPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const seeAll = user?.is_admin || user?.can_view_activity_log
  const [filters, setFilters] = useState({ user_id: '', system: '', start: '', end: '' })
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState(null) // 상세 창으로 연 기록

  const load = async (offset = 0) => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const { data } = await getActivityLogs({ ...params, offset })
      setRows(r => (offset ? [...r, ...data.data] : data.data))
      setUsers(data.users)
      setHasMore(data.has_more)
    } catch (e) {
      alert(e.response?.data?.detail || '활동 로그를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(0)
  }, [filters])

  const set = (key) => (e) => setFilters(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="메인허브">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <History size={22} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{seeAll ? '활동 로그' : '내 활동'}</h1>
            <p className="text-xs text-slate-500">추가·수정·삭제와 로그인 기록 (6개월 보관) · 줄을 누르면 자세히 보고, 30일 안의 변경은 되돌릴 수 있습니다</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {seeAll && <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">마지막 로그인</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {users.map(u => (
              <button key={u.id} onClick={() => setFilters(f => ({ ...f, user_id: f.user_id === String(u.id) ? '' : String(u.id) }))}
                title={fmt(u.last_login_at)}
                className={`text-left bg-white rounded-lg border px-3 py-2 transition-colors ${filters.user_id === String(u.id) ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="text-sm"><span className="font-bold text-slate-800">{u.name}</span> <span className="text-xs text-slate-400">{u.position}</span></div>
                <div className={`text-xs ${u.last_login_at ? 'text-slate-500' : 'text-slate-300'}`}>{ago(u.last_login_at)}</div>
              </button>
            ))}
          </div>
        </section>}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {seeAll && (
              <select value={filters.user_id} onChange={set('user_id')} className={`${inputCls} !w-auto`}>
                <option value="">전체 사용자</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <select value={filters.system} onChange={set('system')} className={`${inputCls} !w-auto`}>
              {SYSTEMS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <input type="date" value={filters.start} onChange={set('start')} className={`${inputCls} !w-auto`} />
            <span className="text-slate-400">~</span>
            <input type="date" value={filters.end} onChange={set('end')} className={`${inputCls} !w-auto`} />
            {Object.values(filters).some(Boolean) && (
              <Btn onClick={() => setFilters({ user_id: '', system: '', start: '', end: '' })}>필터 초기화</Btn>
            )}
          </div>

          <Table headers={['시간', '사용자', '시스템', '메뉴', '동작', '내용', 'IP']} cards>
            {rows.map(r => (
              <tr key={r.id} onClick={() => r.method !== 'LOGIN' && setOpenId(r.id)}
                className={`border-b border-border last:border-0 ${r.method !== 'LOGIN' ? 'cursor-pointer hover:bg-amber-50' : ''}`}>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{fmt(r.created_at)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800">{r.user_name}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.system_name}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.menu}</td>
                <td className={`px-4 py-2.5 whitespace-nowrap font-medium ${r.method === 'DELETE' ? 'text-red-600' : r.method === 'LOGIN' ? 'text-slate-500' : r.method === 'UNDO' ? 'text-amber-600' : 'text-blue-700'}`}>
                  {r.action}
                  {r.undone_at && <span className="ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">되돌림 완료</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-700 break-all">{r.detail || '-'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-400">{r.ip || '-'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{loading ? '불러오는 중...' : '기록이 없습니다'}</td></tr>
            )}
          </Table>
          {hasMore && (
            <div className="text-center">
              <Btn onClick={() => load(rows.length)} disabled={loading} className="mx-auto">{loading ? '불러오는 중...' : '더 보기'}</Btn>
            </div>
          )}
        </section>
      </div>
      {openId && <RecordModal id={openId} onClose={() => setOpenId(null)} onChanged={() => load(0)} />}
    </div>
  )
}

// 상세 창: 이번 변경 + 그 항목의 현재 정보, [화면 열기]는 새 탭에서 그 항목으로 바로
function RecordModal({ id, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [undoing, setUndoing] = useState(false)
  useEffect(() => {
    getActivityRecord(id).then(r => setData(r.data))
      .catch(e => { alert(e.response?.data?.detail || '불러오지 못했습니다'); onClose() })
  }, [id])
  const log = data?.log

  // 되돌리기: 그 뒤에 같은 항목이 다시 바뀌었으면 서버가 409 → 한 번 더 물어봄
  const handleUndo = async () => {
    if (!confirm(`이 변경을 되돌릴까요?\n\n${log.detail || `${log.menu} ${log.action}`}`)) return
    setUndoing(true)
    const run = async (force) => {
      try {
        await undoActivity(id, force)
        alert('되돌렸습니다')
        onChanged()
        onClose()
      } catch (e) {
        if (e.response?.status === 409 && !force) {
          if (confirm(`${e.response.data.detail}\n\n그래도 되돌릴까요?`)) return run(true)
        } else {
          alert(e.response?.data?.detail || '되돌리지 못했습니다')
        }
      }
    }
    await run(false)
    setUndoing(false)
  }

  return (
    <Modal title={log ? `${log.system_name} · ${log.menu} ${log.action}` : '불러오는 중...'}
      sub={log ? `${fmt(log.created_at)} · ${log.user_name}${log.ip ? ` · ${log.ip}` : ''}` : undefined}
      onClose={onClose} size="lg"
      footer={<>
        {data?.can_undo && <Btn variant="yellow" onClick={handleUndo} disabled={undoing}>{undoing ? '되돌리는 중...' : '되돌리기'}</Btn>}
        <div className="flex-1" />
        <Btn onClick={onClose}>닫기</Btn>
        {data?.link && <Btn variant="primary" onClick={() => window.open(data.link, '_blank', 'noopener')}>화면 열기 (새 탭)</Btn>}
      </>}>
      {data && (
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">이번 기록</div>
            <div className="text-sm text-slate-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 break-all">{log.detail || `${log.menu} ${log.action}`}</div>
            {log.undone_at && <div className="text-xs text-slate-500 mt-1">{fmt(log.undone_at)}에 되돌린 기록입니다</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">현재 정보{data.name ? ` — ${data.name}` : ''}</div>
            {data.deleted ? (
              <div className="text-sm text-slate-400 px-3 py-4 text-center border border-dashed border-slate-200 rounded-lg">삭제된 항목이라 현재 정보가 없습니다</div>
            ) : data.fields.length ? (
              <dl className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm overflow-hidden">
                {data.fields.map(f => (
                  <div key={f.label} className="grid grid-cols-[7rem_1fr]">
                    <dt className="px-3 py-2 bg-slate-50 text-slate-500">{f.label}</dt>
                    <dd className="px-3 py-2 text-slate-800 break-all whitespace-pre-wrap">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="text-sm text-slate-400 px-3 py-4 text-center border border-dashed border-slate-200 rounded-lg">이 메뉴는 상세 정보를 따로 보관하지 않습니다 — [화면 열기]로 확인하세요</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
