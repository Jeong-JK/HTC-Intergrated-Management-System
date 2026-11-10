import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Package, TrendingUp, Users, LogOut, Settings, Shield, UserCog, X, Check, Mail, Phone, Lock, MessageSquare, Clock, Banknote, HardDrive, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { updateProfile, getUnreadPostCount, getUnreadCommentNotificationCount } from '../api.js'
import logoImg from '../assets/HTC_logo.png'

const SYSTEMS = [
  {
    id: 'inventory',
    title: '재고관리',
    description: '장비 재고, 입출고, 대여/납품 관리',
    icon: Package,
    color: 'from-blue-500 to-blue-600',
    borderColor: 'border-blue-200 hover:border-blue-400',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    path: '/inventory',
    subdomain: 'inv',
    isExternal: false,
  },
  {
    id: 'sales',
    title: 'Sales Pipeline',
    description: '영업 기회 및 파이프라인 관리',
    icon: TrendingUp,
    color: 'from-green-500 to-green-600',
    borderColor: 'border-green-200 hover:border-green-400',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    subdomain: 'sales',
    port: 8001,
    isExternal: true,
  },
  {
    id: 'crm',
    title: 'CRM',
    description: '업체, 팀, 담당자 관리',
    icon: Users,
    color: 'from-purple-500 to-purple-600',
    borderColor: 'border-purple-200 hover:border-purple-400',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    subdomain: 'crm',
    port: 8002,
    isExternal: true,
  },
  {
    id: 'worklog',
    title: '업무일지 캘린더',
    description: '일일/기간별 업무일지 작성 및 공유',
    icon: CalendarDays,
    color: 'from-orange-500 to-orange-600',
    borderColor: 'border-orange-200 hover:border-orange-400',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    path: '/work-log',
    subdomain: 'cal',
    isExternal: false,
    permission: 'can_access_worklog', // 사용자 관리에서 부여
  },
]

export default function MainHub() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showProfile, setShowProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ email: '', phone: '', password: '', passwordConfirm: '' })
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadCommentCount, setUnreadCommentCount] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [salesStats, setSalesStats] = useState(null)

  useEffect(() => {
    document.title = 'HTC 통합관리시스템'
    loadUnreadCount()
    loadUnreadCommentCount()
    loadSalesStats()
  }, [])

  // Sales Pipeline 통계 로드
  const loadSalesStats = async () => {
    try {
      const res = await fetch('/api/sales-stats?year=2026')
      const data = await res.json()
      setSalesStats(data)
    } catch (error) {
      console.error('Sales stats 로드 실패:', error)
    }
  }

  // 시간 업데이트 (1초마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 한국 시간 포맷
  const formatKoreanTime = (date) => {
    const krDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const yy = String(krDate.getFullYear()).slice(2)
    const mm = String(krDate.getMonth() + 1).padStart(2, '0')
    const dd = String(krDate.getDate()).padStart(2, '0')
    const hh = String(krDate.getHours()).padStart(2, '0')
    const mi = String(krDate.getMinutes()).padStart(2, '0')
    const ss = String(krDate.getSeconds()).padStart(2, '0')
    return `${yy}년 ${mm}월 ${dd}일 ${hh}:${mi}:${ss}`
  }

  // 미국 LA 시간 포맷 (Pacific Time)
  const formatUSTime = (date) => {
    const laDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const yy = String(laDate.getFullYear()).slice(2)
    const mm = String(laDate.getMonth() + 1).padStart(2, '0')
    const dd = String(laDate.getDate()).padStart(2, '0')
    const hh = String(laDate.getHours()).padStart(2, '0')
    const mi = String(laDate.getMinutes()).padStart(2, '0')
    const ss = String(laDate.getSeconds()).padStart(2, '0')
    return `${yy}년 ${mm}월 ${dd}일 ${hh}:${mi}:${ss}`
  }

  const loadUnreadCount = async () => {
    try {
      const res = await getUnreadPostCount()
      const count = res.data.unread_count || 0
      setUnreadCount(count)
    } catch (error) {
      console.error('Failed to load unread count:', error)
    }
  }

  const loadUnreadCommentCount = async () => {
    try {
      const res = await getUnreadCommentNotificationCount()
      const count = res.data.unread_count || 0
      setUnreadCommentCount(count)
    } catch (error) {
      console.error('Failed to load comment notification count:', error)
    }
  }

  // Poll unread count every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadUnreadCount()
      loadUnreadCommentCount()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleSystemClick = (system) => {
    if (system.permission && !user?.is_admin && !user?.[system.permission]) {
      alert('권한이 없습니다. 관리자에게 문의하세요.')
      return
    }
    const { protocol, hostname } = window.location
    // 도메인 환경: 서브도메인 사용, 로컬 환경: 포트(별도 앱) 또는 경로(같은 앱)
    if (system.subdomain && hostname.includes('hltac.com')) {
      window.location.href = `${protocol}//${system.subdomain}.hltac.com`
    } else if (system.isExternal) {
      window.location.href = `${protocol}//${hostname}:${system.port}`
    } else {
      navigate(system.path)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const openProfileModal = () => {
    setProfileForm({ email: '', phone: '', password: '', passwordConfirm: '' })
    setProfileError('')
    setProfileSuccess('')
    setShowProfile(true)
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    // Validate password confirmation
    if (profileForm.password && profileForm.password !== profileForm.passwordConfirm) {
      setProfileError('비밀번호가 일치하지 않습니다')
      return
    }

    const updateData = {}
    if (profileForm.email) updateData.email = profileForm.email
    if (profileForm.phone) updateData.phone = profileForm.phone
    if (profileForm.password) updateData.password = profileForm.password

    if (Object.keys(updateData).length === 0) {
      setProfileError('변경할 내용을 입력하세요')
      return
    }

    try {
      await updateProfile(updateData)
      setProfileSuccess('프로필이 수정되었습니다')
      setProfileForm({ email: '', phone: '', password: '', passwordConfirm: '' })
      setTimeout(() => setShowProfile(false), 1500)
    } catch (e) {
      setProfileError(e.response?.data?.detail || '수정에 실패했습니다')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-[100px] sm:h-[100px] bg-white flex items-center justify-center overflow-hidden p-2">
                <img src={logoImg} alt="HTC Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">HTC 통합 관리 시스템</h1>
                <p className="text-slate-500 text-sm mt-1">Integrated Management System</p>
              </div>
            </div>

            {/* 사용자 정보 및 메뉴 */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {/* 사용자 정보 */}
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user?.is_admin ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  {user?.is_admin ? <Shield size={16} className="text-amber-600" /> : <Users size={16} className="text-blue-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.is_admin ? '관리자' : '일반 사용자'}</p>
                </div>
              </div>

              {/* 게시판 */}
              <button
                onClick={() => window.open('/board', '_blank')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  color: '#7c3aed',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3e8ff'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#faf5ff'}
              >
                <MessageSquare size={18} />
                <span>게시판</span>
                {(unreadCount + unreadCommentCount) > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '700',
                    borderRadius: '9999px',
                    minWidth: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px'
                  }}>
                    {(unreadCount + unreadCommentCount) > 9 ? '9+' : (unreadCount + unreadCommentCount)}
                  </span>
                )}
              </button>

              {/* 내 정보 수정 (모든 사용자) */}
              <button
                onClick={openProfileModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <UserCog size={18} />
                <span className="text-sm font-medium">내 정보</span>
              </button>

              {/* 관리자 메뉴 */}
              {user?.is_admin && (
                <>
                  <button
                    onClick={() => navigate('/users')}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <Settings size={18} />
                    <span className="text-sm font-medium">사용자 관리</span>
                  </button>
                  <button
                    onClick={() => navigate('/admin-drive')}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <HardDrive size={18} />
                    <span className="text-sm font-medium">Drive</span>
                  </button>
                </>
              )}

              {/* 로그아웃 */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
        {/* 시간 & 환율 정보 */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-4 sm:pb-6">
          <div className="flex flex-wrap gap-4">
          {/* 한국 시간 */}
          <div className="bg-slate-50 rounded-xl px-6 py-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">한국 (KST)</p>
              <p className="text-base font-bold text-slate-800 tracking-wide">{formatKoreanTime(currentTime)}</p>
            </div>
          </div>

          {/* 미국 LA 시간 */}
          <div className="bg-slate-50 rounded-xl px-6 py-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Clock size={24} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">미국 LA (PT)</p>
              <p className="text-base font-bold text-slate-800 tracking-wide">{formatUSTime(currentTime)}</p>
            </div>
          </div>

          {/* 2026년 총 수주금액 */}
          <div className="bg-slate-50 rounded-xl px-6 py-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Banknote size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-800 font-bold">2026년 총 수주금액</p>
              <p className="text-lg font-bold text-slate-800 tracking-wide">
                {salesStats?.total_order_amount != null
                  ? `₩ ${Math.round(salesStats.total_order_amount).toLocaleString()}`
                  : '로딩중...'}
              </p>
            </div>
          </div>

          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-slate-700">시스템 선택</h2>
          <p className="text-slate-500 text-sm mt-1">사용할 시스템을 선택하세요</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SYSTEMS.map((system) => (
            <button
              key={system.id}
              onClick={() => handleSystemClick(system)}
              className={`bg-white rounded-2xl border-2 ${system.borderColor} p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group text-left`}
            >
              {/* 아이콘 */}
              <div className={`w-16 h-16 bg-gradient-to-br ${system.color} rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                <system.icon className="text-white" size={32} />
              </div>

              {/* 타이틀 */}
              <h3 className="text-2xl font-bold text-slate-800 mb-3">{system.title}</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">{system.description}</p>

              {/* 진입 버튼 */}
              <div className={`mt-6 text-center py-3 rounded-lg ${system.bgColor} ${system.textColor} font-semibold text-sm transition-all group-hover:shadow-md`}>
                시스템 열기 →
              </div>
            </button>
          ))}
        </div>

        {/* 하단 정보 */}
        <div className="mt-16 text-center text-slate-400 text-sm">
          <p>© HTC 통합 관리 시스템 by. jkjeong</p>
        </div>
      </main>

      {/* 내 정보 수정 모달 */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">내 정보 수정</h2>
              <button onClick={() => setShowProfile(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
              {/* 현재 정보 표시 */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 w-16">아이디:</span>
                  <span className="text-sm font-medium text-slate-700">{user?.user_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 w-16">이름:</span>
                  <span className="text-sm font-medium text-slate-700">{user?.name}</span>
                </div>
              </div>

              {profileError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {profileError}
                </div>
              )}

              {profileSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                  {profileSuccess}
                </div>
              )}

              {user?.is_admin ? (
                <>
                  <p className="text-xs text-slate-500">변경할 항목만 입력하세요</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Mail size={14} />
                        이메일
                      </div>
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      placeholder="새 이메일 주소"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} />
                        전화번호
                      </div>
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="새 전화번호"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Mail size={14} />
                        이메일
                      </div>
                    </label>
                    <div className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600">
                      {user?.email || '-'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} />
                        전화번호
                      </div>
                    </label>
                    <div className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600">
                      {user?.phone || '-'}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 text-center">이메일/전화번호 변경은 관리자에게 문의하세요</p>
                </>
              )}

              <div className={user?.is_admin ? "border-t border-slate-200 pt-4 mt-4" : ""}>
                <p className="text-xs text-slate-500 mb-3">비밀번호 변경</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Lock size={14} />
                        새 비밀번호
                      </div>
                    </label>
                    <input
                      type="password"
                      value={profileForm.password}
                      onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                      placeholder="새 비밀번호"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호 확인</label>
                    <input
                      type="password"
                      value={profileForm.passwordConfirm}
                      onChange={(e) => setProfileForm({ ...profileForm, passwordConfirm: e.target.value })}
                      placeholder="비밀번호 다시 입력"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProfile(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
