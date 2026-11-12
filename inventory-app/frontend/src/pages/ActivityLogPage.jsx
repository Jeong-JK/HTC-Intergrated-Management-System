import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Table, Btn, inputCls } from '../components/Common.jsx'
import { getActivityLogs } from '../api.js'

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

// 관리자 또는 '활동 로그 조회' 권한: 사용자별 마지막 로그인 + 누가 언제 무엇을 추가/수정/삭제했는지
export default function ActivityLogPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const allowed = user?.is_admin || user?.can_view_activity_log
  const [filters, setFilters] = useState({ user_id: '', system: '', start: '', end: '' })
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

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
    if (!allowed) { navigate('/'); return }
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
            <h1 className="text-lg font-bold text-slate-800">활동 로그</h1>
            <p className="text-xs text-slate-500">추가·수정·삭제와 로그인 기록 (1년 보관)</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section>
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
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={filters.user_id} onChange={set('user_id')} className={`${inputCls} !w-auto`}>
              <option value="">전체 사용자</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
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

          <Table headers={['시간', '사용자', '시스템', '메뉴', '동작', '상세', 'IP']} cards>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{fmt(r.created_at)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800">{r.user_name}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.system_name}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.menu}</td>
                <td className={`px-4 py-2.5 whitespace-nowrap font-medium ${r.method === 'DELETE' ? 'text-red-600' : r.method === 'LOGIN' ? 'text-slate-500' : 'text-blue-700'}`}>{r.action}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400 break-all">{r.method === 'LOGIN' ? '-' : r.path.replace(/^\/api/, '')}</td>
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
    </div>
  )
}
