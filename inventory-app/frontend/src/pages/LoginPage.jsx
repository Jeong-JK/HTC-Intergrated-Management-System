import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Lock, User, AlertCircle } from 'lucide-react'
import logoImg from '../assets/HTC_logo.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await apiLogin({ user_id: userId, password })
      login(res.data.user)
      navigate('/')
    } catch (e) {
      setError(e.response?.data?.detail || '로그인에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-8 text-center">
          <div className="w-24 h-24 mx-auto bg-white rounded-xl flex items-center justify-center mb-4 shadow-lg">
            <img src={logoImg} alt="HTC Logo" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">HTC 통합 관리 시스템</h1>
          <p className="text-blue-100 text-sm mt-1">Integrated Management System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3 text-red-700">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">아이디</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">비밀번호</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                로그인 중...
              </span>
            ) : '로그인'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 text-center border-t border-slate-200">
          <p className="text-xs text-slate-500">계정 발급 문의 - jkjeong@hlpuritech.com</p>
        </div>
      </div>
    </div>
  )
}
