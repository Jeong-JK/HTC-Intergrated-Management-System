import { useState, useEffect } from 'react'
import { Home, TrendingUp, MessageSquare, RefreshCw, ToggleLeft, ToggleRight, Eye, EyeOff } from 'lucide-react'
import PurchasesTab from '../components/PurchasesTab'
import ProjectsTab from '../components/ProjectsTab'
import WeeklyTab from '../components/WeeklyTab'
import GoogleSheetView from '../components/GoogleSheetView'
import axios from 'axios'

const CURRENT_YEAR = new Date().getFullYear()

// 시트 이름 매핑
const SHEET_NAMES = {
  purchases: '2026Y 매입',
  projects: '2026Y 프로젝트',
  weekly: '2026Y Weekly'
}

export default function SalesApp() {
  // 활동 로그 '화면 열기': ?tab=&year= 로 바로 그 탭/연도
  const [activeTab, setActiveTab] = useState(() => ['purchases', 'projects', 'weekly'].includes(new URLSearchParams(window.location.search).get('tab')) ? new URLSearchParams(window.location.search).get('tab') : 'projects')
  const [year, setYear] = useState(() => Number(new URLSearchParams(window.location.search).get('year')) || CURRENT_YEAR)
  const [accessChecked, setAccessChecked] = useState(false)
  const [sheetViewMode, setSheetViewMode] = useState(false)  // 시트 뷰 모드
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [hideDone, setHideDone] = useState(false)  // 완료 프로젝트 화면에서만 숨김 (통계/금액은 서버 값 그대로)

  const goToMainHub = () => {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    // 도메인 환경: ims.hltac.com, 로컬 환경: 포트 사용
    if (hostname.includes('hltac.com')) {
      window.location.href = `${protocol}//ims.hltac.com`
    } else {
      window.location.href = `${protocol}//${hostname}:8000`
    }
  }

  // 접근 권한 체크 (미들웨어에서 이미 권한 체크함, API 성공=권한있음)
  useEffect(() => {
    const checkAccess = async () => {
      try {
        await axios.get('/api/auth/me')
        setAccessChecked(true)
        // 동기화 상태 체크
        loadSyncStatus()
      } catch (err) {
        if (err.response?.status === 403) {
          alert('권한이 없습니다. 관리자에게 문의하세요.')
        }
        goToMainHub()
      }
    }
    checkAccess()
  }, [])

  const loadSyncStatus = async () => {
    try {
      const res = await axios.get('/api/sheets/status')
      setSyncStatus(res.data)
    } catch (err) {
      console.error('동기화 상태 로딩 실패:', err)
    }
  }

  const handleSyncAll = async () => {
    if (syncing) return
    try {
      setSyncing(true)
      await axios.post('/api/sheets/sync')
      await loadSyncStatus()
      alert('구글 시트 동기화 완료!')
    } catch (err) {
      console.error('동기화 실패:', err)
      alert(err.response?.data?.detail || '동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  // 권한 체크 전에는 빈 화면
  if (!accessChecked) {
    return <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100" />
  }

  const tabs = [
    { id: 'purchases', label: '매입 관리', icon: '📦' },
    { id: 'projects', label: '프로젝트', icon: '📊' },
    { id: 'weekly', label: 'Weekly', icon: '📅' }
  ]

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 bg-white border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button
              onClick={goToMainHub}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
              <Home size={16}/>
              메인으로
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Sales Pipeline</h1>
                <p className="hidden sm:block text-sm text-slate-500">영업 파이프라인 관리</p>
              </div>
            </div>
            <a
              href="/board"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 sm:px-6 sm:py-3 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg text-base font-semibold">
              <MessageSquare size={22} />
              Dashboard
            </a>
            <button
              onClick={() => setHideDone(!hideDone)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                hideDone
                  ? 'bg-slate-700 border-slate-700 text-white hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title={hideDone ? '완료된 프로젝트도 다시 표시' : '프로젝트/Weekly에서 완료된 행 숨기기'}
            >
              {hideDone ? <Eye size={16} /> : <EyeOff size={16} />}
              <span className="text-sm font-medium">{hideDone ? '전체 보기' : '완료 숨기기'}</span>
            </button>
          </div>

          {/* Right side controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* 시트 뷰 토글 */}
            <button
              onClick={() => setSheetViewMode(!sheetViewMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                sheetViewMode
                  ? 'bg-green-100 border-green-500 text-green-700'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title={sheetViewMode ? '일반 뷰로 전환' : '시트 뷰로 전환'}
            >
              {sheetViewMode ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              <span className="text-sm font-medium">
                {sheetViewMode ? '시트 뷰' : '일반 뷰'}
              </span>
            </button>

            {/* 동기화 버튼 */}
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              title="구글 시트와 동기화"
            >
              <RefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
              <span className="text-sm font-medium">
                {syncing ? '동기화 중...' : '동기화'}
              </span>
            </button>

            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">연도:</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-300 bg-white flex-shrink-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 whitespace-nowrap font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-green-600 border-green-600 bg-green-50'
                  : 'text-slate-600 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content - 전체 화면 사용 */}
        <div className="flex-1 overflow-auto p-2 bg-slate-100">
          {sheetViewMode ? (
            // 시트 뷰 모드 - 구글 시트 원본 데이터 표시
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <GoogleSheetView
                sheetName={SHEET_NAMES[activeTab]}
                onSyncComplete={loadSyncStatus}
              />
            </div>
          ) : (
            // 일반 뷰 모드
            <>
              {activeTab === 'purchases' && <PurchasesTab year={year} />}
              {activeTab === 'projects' && <ProjectsTab year={year} isActive={activeTab === 'projects'} hideDone={hideDone} />}
              {activeTab === 'weekly' && <WeeklyTab year={year} isActive={activeTab === 'weekly'} hideDone={hideDone} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
