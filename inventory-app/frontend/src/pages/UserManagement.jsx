import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, createUser, updateUser, deleteUser } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Plus, Edit2, Trash2, Shield, User, X, Check, ArrowLeft, Mail, Phone } from 'lucide-react'

export default function UserManagement() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({
    user_id: '', password: '', name: '', position: '', email: '', phone: '', is_admin: false,
    // 권한 필드
    can_delete: false,
    can_access_sales: false,
    can_edit_purchase: false,
    can_delete_purchase: false,
    can_edit_project: false,
    can_delete_project: false,
    can_edit_weekly: false,
    can_delete_weekly: false,
    can_add_company: false,
    can_edit_company: false,
    can_delete_company: false,
    can_view_meeting: false,
    can_add_meeting: false,
    can_delete_meeting: false,
    can_edit_contact: false,
    can_transfer_contact: false,
    can_access_worklog: false,
    can_write_worklog: false,
    can_edit_worklog: false,
    can_delete_worklog: false,
    can_manage_worklog: false
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/')
      return
    }
    loadUsers()
  }, [user, navigate])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await getUsers()
      setUsers(res.data.users)
    } catch (e) {
      console.error('Failed to load users:', e)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditUser(null)
    setForm({
      user_id: '', password: '', name: '', position: '', email: '', phone: '', is_admin: false,
      can_delete: false,
      can_access_sales: false,
      can_edit_purchase: false,
      can_delete_purchase: false,
      can_edit_project: false,
      can_delete_project: false,
      can_edit_weekly: false,
      can_delete_weekly: false,
      can_add_company: false,
      can_edit_company: false,
      can_delete_company: false,
      can_view_meeting: false,
      can_add_meeting: false,
      can_delete_meeting: false,
      can_edit_contact: false,
      can_transfer_contact: false,
      can_access_worklog: false,
      can_write_worklog: false,
      can_edit_worklog: false,
      can_delete_worklog: false,
      can_manage_worklog: false
    })
    setError('')
    setShowModal(true)
  }

  const openEditModal = (u) => {
    setEditUser(u)
    setForm({
      user_id: u.user_id,
      password: '',
      name: u.name,
      position: u.position || '',
      email: u.email || '',
      phone: u.phone || '',
      is_admin: u.is_admin,
      // 권한 필드
      can_delete: !!u.can_delete,
      can_access_sales: !!u.can_access_sales,
      can_edit_purchase: !!u.can_edit_purchase,
      can_delete_purchase: !!u.can_delete_purchase,
      can_edit_project: !!u.can_edit_project,
      can_delete_project: !!u.can_delete_project,
      can_edit_weekly: !!u.can_edit_weekly,
      can_delete_weekly: !!u.can_delete_weekly,
      can_add_company: !!u.can_add_company,
      can_edit_company: !!u.can_edit_company,
      can_delete_company: !!u.can_delete_company,
      can_view_meeting: !!u.can_view_meeting,
      can_add_meeting: !!u.can_add_meeting,
      can_delete_meeting: !!u.can_delete_meeting,
      can_edit_contact: !!u.can_edit_contact,
      can_transfer_contact: !!u.can_transfer_contact,
      can_access_worklog: !!u.can_access_worklog,
      can_write_worklog: !!u.can_write_worklog,
      can_edit_worklog: !!u.can_edit_worklog,
      can_delete_worklog: !!u.can_delete_worklog,
      can_manage_worklog: !!u.can_manage_worklog
    })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      if (editUser) {
        // Update user
        const updateData = {
          name: form.name,
          position: form.position,
          email: form.email,
          phone: form.phone,
          is_admin: form.is_admin,
          // 권한 필드
          can_delete: form.can_delete,
          can_access_sales: form.can_access_sales,
          can_edit_purchase: form.can_edit_purchase,
          can_delete_purchase: form.can_delete_purchase,
          can_edit_project: form.can_edit_project,
          can_delete_project: form.can_delete_project,
          can_edit_weekly: form.can_edit_weekly,
          can_delete_weekly: form.can_delete_weekly,
          can_add_company: form.can_add_company,
          can_edit_company: form.can_edit_company,
          can_delete_company: form.can_delete_company,
          can_view_meeting: form.can_view_meeting,
          can_add_meeting: form.can_add_meeting,
          can_delete_meeting: form.can_delete_meeting,
          can_edit_contact: form.can_edit_contact,
          can_transfer_contact: form.can_transfer_contact,
          can_access_worklog: form.can_access_worklog,
          can_write_worklog: form.can_write_worklog,
          can_edit_worklog: form.can_edit_worklog,
          can_delete_worklog: form.can_delete_worklog,
          can_manage_worklog: form.can_manage_worklog
        }
        if (form.password) {
          updateData.password = form.password
        }
        await updateUser(editUser.id, updateData)
      } else {
        // Create user
        if (!form.password) {
          setError('비밀번호를 입력하세요')
          return
        }
        await createUser(form)
      }
      setShowModal(false)
      loadUsers()
    } catch (e) {
      setError(e.response?.data?.detail || '저장에 실패했습니다')
    }
  }

  const handleDelete = async (u) => {
    if (!confirm(`"${u.name}" 사용자를 삭제하시겠습니까?`)) return

    try {
      await deleteUser(u.id)
      loadUsers()
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">사용자 관리</h1>
                <p className="text-slate-500 text-sm">User Management</p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus size={18} />
              <span>사용자 추가</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-slate-500">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">아이디</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">이름</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">직급</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">연락처</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">권한</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">생성일</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${u.is_admin ? 'bg-amber-100' : 'bg-slate-100'}`}>
                          {u.is_admin ? <Shield size={16} className="text-amber-600" /> : <User size={16} className="text-slate-500" />}
                        </div>
                        <span className="font-medium text-slate-700">{u.user_id}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">{u.name}</td>
                    <td className="px-5 py-4 text-slate-600 text-sm">{u.position || '-'}</td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {u.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Mail size={12} />
                            <span>{u.email}</span>
                          </div>
                        )}
                        {u.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={12} />
                            <span>{u.phone}</span>
                          </div>
                        )}
                        {!u.email && !u.phone && <span className="text-xs text-slate-400">-</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          <Shield size={12} /> 관리자
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                          <User size={12} /> 일반
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center text-sm text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Edit2 size={16} />
                        </button>
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-800">
                {editUser ? '사용자 수정' : '사용자 추가'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">아이디</label>
                <input
                  type="text"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  disabled={!!editUser}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  비밀번호 {editUser && <span className="text-slate-400 font-normal">(변경 시에만 입력)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editUser}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">이름</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">직급</label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="예: 대리, 과장"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">전화번호</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_admin}
                    onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
                <span className="text-sm text-slate-700">관리자 권한 <span className="text-xs text-slate-400">(모든 권한 자동 부여)</span></span>
              </div>

              {/* 권한 설정 섹션 - 관리자가 아닐 때만 표시 */}
              {!form.is_admin && (
                <div className="border-t border-slate-200 pt-4 mt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">세부 권한 설정</h3>

                  {/* 공통 삭제 권한 */}
                  <div className="bg-red-50 rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.can_delete}
                        onChange={(e) => setForm({ ...form, can_delete: e.target.checked })}
                        className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-red-700">삭제 권한</span>
                      <span className="text-xs text-red-500">(재고, 대여이력, 납품이력 등 모든 삭제)</span>
                    </label>
                  </div>

                  {/* Sales Pipeline 권한 */}
                  <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                    <div className="text-sm font-medium text-blue-700 mb-2">Sales Pipeline</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.can_access_sales}
                        onChange={(e) => setForm({ ...form, can_access_sales: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">접근 권한</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_edit_purchase} onChange={(e) => setForm({ ...form, can_edit_purchase: e.target.checked })} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                        <span className="text-xs text-slate-600">매입 수정</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_delete_purchase} onChange={(e) => setForm({ ...form, can_delete_purchase: e.target.checked })} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                        <span className="text-xs text-slate-600">매입 삭제</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_edit_project} onChange={(e) => setForm({ ...form, can_edit_project: e.target.checked })} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                        <span className="text-xs text-slate-600">프로젝트 수정</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_delete_project} onChange={(e) => setForm({ ...form, can_delete_project: e.target.checked })} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                        <span className="text-xs text-slate-600">프로젝트 삭제</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_edit_weekly} onChange={(e) => setForm({ ...form, can_edit_weekly: e.target.checked })} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                        <span className="text-xs text-slate-600">Weekly 수정</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_delete_weekly} onChange={(e) => setForm({ ...form, can_delete_weekly: e.target.checked })} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                        <span className="text-xs text-slate-600">Weekly 삭제</span>
                      </label>
                    </div>
                  </div>

                  {/* CRM 권한 */}
                  <div className="bg-green-50 rounded-lg p-3 space-y-2">
                    <div className="text-sm font-medium text-green-700 mb-2">CRM</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_add_company} onChange={(e) => setForm({ ...form, can_add_company: e.target.checked })} className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                        <span className="text-xs text-slate-600">업체 추가</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_edit_company} onChange={(e) => setForm({ ...form, can_edit_company: e.target.checked, can_edit_contact: e.target.checked })} className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                        <span className="text-xs text-slate-600">업체,담당자 수정</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_delete_company} onChange={(e) => setForm({ ...form, can_delete_company: e.target.checked })} className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                        <span className="text-xs text-slate-600">업체 삭제</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_view_meeting} onChange={(e) => setForm({ ...form, can_view_meeting: e.target.checked })} className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                        <span className="text-xs text-slate-600">미팅 조회</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_add_meeting} onChange={(e) => setForm({ ...form, can_add_meeting: e.target.checked })} className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                        <span className="text-xs text-slate-600">미팅 추가</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_delete_meeting} onChange={(e) => setForm({ ...form, can_delete_meeting: e.target.checked })} className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                        <span className="text-xs text-slate-600">미팅 삭제</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer col-span-2">
                        <input type="checkbox" checked={form.can_transfer_contact} onChange={(e) => setForm({ ...form, can_transfer_contact: e.target.checked })} className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                        <span className="text-xs text-slate-600">이직 처리</span>
                      </label>
                    </div>
                  </div>

                  {/* 업무일지 권한 */}
                  <div className="bg-orange-50 rounded-lg p-3 space-y-2">
                    <div className="text-sm font-medium text-orange-700 mb-2">업무일지</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.can_access_worklog} onChange={(e) => setForm({ ...form, can_access_worklog: e.target.checked })} className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                      <span className="text-sm text-slate-700">접근 권한</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_write_worklog} onChange={(e) => setForm({ ...form, can_write_worklog: e.target.checked })} className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                        <span className="text-xs text-slate-600">업무일지 작성</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_edit_worklog} onChange={(e) => setForm({ ...form, can_edit_worklog: e.target.checked })} className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                        <span className="text-xs text-slate-600">업무일지 수정</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.can_delete_worklog} onChange={(e) => setForm({ ...form, can_delete_worklog: e.target.checked })} className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                        <span className="text-xs text-slate-600">업무일지 삭제</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer col-span-2">
                        <input type="checkbox" checked={form.can_manage_worklog} onChange={(e) => setForm({ ...form, can_manage_worklog: e.target.checked })} className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                        <span className="text-xs text-slate-600">업무일지관리자 <span className="text-slate-400">(타인 열람만)</span></span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  {editUser ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
