import { useNavigate } from 'react-router-dom'
import { TrendingUp, Home } from 'lucide-react'

export default function SalesApp() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-4xl mx-auto p-12">
        <button
          onClick={() => navigate('/')}
          className="mb-8 flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
          <Home size={16}/>
          메인으로 돌아가기
        </button>

        <div className="bg-white rounded-2xl border-2 border-green-200 p-16 text-center shadow-xl">
          <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
            <TrendingUp size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Sales Pipeline</h1>
          <p className="text-slate-500 text-lg mb-8">영업 기회 및 파이프라인 관리 시스템</p>
          <div className="bg-green-50 rounded-xl p-6 text-slate-600">
            <p className="text-sm">영업 기회, 파이프라인 단계, 견적 관리 기능이 곧 추가됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
