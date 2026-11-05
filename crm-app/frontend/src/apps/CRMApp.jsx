import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import {
  Building2, Users, Calendar, Search, Plus, Phone, Mail,
  Clock, Edit, Trash2, Home, AlertTriangle, TrendingUp, Activity, User, X, Download, FileText
} from 'lucide-react'
import * as api from '../api'
import * as gdrive from '../utils/googleDrive'
import Combobox from '../components/Combobox'
import QuotationModal from '../components/quotation/QuotationModal'
import QuotationListModal from '../components/quotation/QuotationListModal'

// 클립보드 복사 유틸리티 함수 (fallback 포함)
const copyToClipboard = async (text, label = '내용') => {
  try {
    // 최신 Clipboard API 사용
    await navigator.clipboard.writeText(text)
    alert(`${label}이(가) 복사되었습니다.`)
  } catch (err) {
    // fallback: execCommand 사용
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (successful) {
        alert(`${label}이(가) 복사되었습니다.`)
      } else {
        alert('복사에 실패했습니다.')
      }
    } catch (fallbackErr) {
      console.error('복사 실패:', fallbackErr)
      alert('복사에 실패했습니다. 브라우저가 지원하지 않습니다.')
    }
  }
}

export default function CRMApp() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<MainView navigate={navigate} />} />
    </Routes>
  )
}

function MainView({ navigate }) {
  const [companies, setCompanies] = useState([])
  const [teams, setTeams] = useState([])
  const [contacts, setContacts] = useState([])
  const [meetings, setMeetings] = useState([])

  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedContact, setSelectedContact] = useState(null)

  const [staleBoard, setStaleBoard] = useState([])
  const [loading, setLoading] = useState(false)
  const [companySearch, setCompanySearch] = useState('')
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false)
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false)
  const [showDeleteCompanyModal, setShowDeleteCompanyModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showRecentMeetingsModal, setShowRecentMeetingsModal] = useState(false)
  const [showCompanyTimelineModal, setShowCompanyTimelineModal] = useState(false)
  const [showEditContactModal, setShowEditContactModal] = useState(false)
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [showDashboardPopup, setShowDashboardPopup] = useState(false)

  // 견적서 상태
  const [showQuotationList, setShowQuotationList] = useState(false)
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [editingQuotationId, setEditingQuotationId] = useState(null)

  const [driveAuthorized, setDriveAuthorized] = useState(false)
  const [driveInitializing, setDriveInitializing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null) // { fileName: string, percent: number }

  useEffect(() => {
    loadCompanies()
    loadStaleBoard()
  }, [])

  useEffect(() => {
    const initDrive = async () => {
      try {
        setDriveInitializing(true)
        await gdrive.initializeGoogleDrive()
        setDriveAuthorized(gdrive.isAuthorized())
      } catch (error) {
        console.error('Google Drive initialization failed:', error)
      } finally {
        setDriveInitializing(false)
      }
    }
    initDrive()
  }, [])

  const loadCompanies = async () => {
    try {
      setLoading(true)
      const res = await api.getCrmCompanies()
      setCompanies(res.data || [])
    } catch (err) {
      console.error('업체 로드 실패:', err)
      alert(err.response?.data?.detail || '업체 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadStaleBoard = async () => {
    try {
      const res = await api.getStaleCompaniesDashboard()
      const data = res.data
      console.log('=== Dashboard API Response ===')
      console.log('90일 초과:', data.contacts?.over_90_days?.length || 0)
      console.log('60일 초과:', data.contacts?.over_60_days?.length || 0)
      console.log('30일 초과:', data.contacts?.over_30_days?.length || 0)

      // 30일, 60일, 90일 초과 담당자를 하나의 배열로 합침
      const allStale = [
        ...(data.contacts?.over_90_days || []),
        ...(data.contacts?.over_60_days || []),
        ...(data.contacts?.over_30_days || []),
        ...(data.contacts?.no_meetings || [])
      ]

      console.log('=== 합친 데이터 샘플 ===')
      allStale.slice(0, 3).forEach(contact => {
        console.log(`${contact.company_name} - ${contact.contact_name}: status="${contact.status}"`)
      })

      setStaleBoard(allStale)
    } catch (err) {
      console.error('장기 미활동 담당자 로드 실패:', err)
    }
  }

  const onCompanySelect = async (company) => {
    setSelectedCompanyId(company.id)
    setSelectedTeamId(null)
    setSelectedContact(null)
    setTeams([])
    setContacts([])
    setMeetings([])

    try {
      const res = await api.getCrmCompany(company.id)
      setTeams(res.data.teams || [])
    } catch (err) {
      console.error('팀 로드 실패:', err)
    }
  }

  const onTeamSelect = async (team) => {
    setSelectedTeamId(team.id)
    setSelectedContact(null)
    setContacts([])
    setMeetings([])

    try {
      const res = await api.getContacts({ team_id: team.id })
      setContacts(res.data || [])
    } catch (err) {
      console.error('담당자 로드 실패:', err)
    }
  }

  const onContactSelect = async (contact) => {
    setSelectedContact(contact)

    try {
      // 이직 이력 포함한 상세 정보 로드
      const contactRes = await api.getContact(contact.id)
      setSelectedContact(contactRes.data)

      const res = await api.getMeetings({ contact_id: contact.id })
      setMeetings(res.data || [])
    } catch (err) {
      console.error('담당자/미팅 로드 실패:', err)
    }
  }

  const handleHomeClick = () => {
    setSelectedCompanyId(null)
    setSelectedTeamId(null)
    setSelectedContact(null)
    setTeams([])
    setContacts([])
    setMeetings([])
  }

  const navigateToContact = async (companyId, teamId, contactId) => {
    // 업체 선택
    const company = companies.find(c => c.id === companyId)
    if (!company) return

    setSelectedCompanyId(companyId)
    setSelectedTeamId(null)
    setSelectedContact(null)

    try {
      // 팀 로드
      const companyRes = await api.getCrmCompany(companyId)
      const loadedTeams = companyRes.data.teams || []
      setTeams(loadedTeams)

      // 팀 선택
      const team = loadedTeams.find(t => t.id === teamId)
      if (!team) return

      setSelectedTeamId(teamId)

      // 담당자 로드
      const contactsRes = await api.getContacts({ team_id: teamId })
      const loadedContacts = contactsRes.data || []
      setContacts(loadedContacts)

      // 담당자 선택 (이력 포함한 상세 정보 로드)
      const contactDetailRes = await api.getContact(contactId)
      setSelectedContact(contactDetailRes.data)

      // 미팅 로드
      const meetingsRes = await api.getMeetings({ contact_id: contactId })
      setMeetings(meetingsRes.data || [])
    } catch (err) {
      console.error('담당자 이동 실패:', err)
    }
  }

  const handleEditContact = () => {
    if (!selectedContact) return
    setShowEditContactModal(true)
  }

  const handleDeleteContactFromDetail = async () => {
    if (!selectedContact) return

    if (!confirm(`'${selectedContact.name}'을 삭제하시겠습니까?\n미팅 내역도 모두 삭제됩니다.`)) return

    try {
      await api.deleteContact(selectedContact.id)

      // 담당자 목록 새로고침
      const contactsRes = await api.getContacts({ team_id: selectedTeamId })
      setContacts(contactsRes.data || [])

      // 선택 해제
      setSelectedContact(null)
      setMeetings([])

      alert('담당자가 삭제되었습니다.')
    } catch (err) {
      console.error('담당자 삭제 실패:', err)
      alert(err.response?.data?.detail || '담당자 삭제에 실패했습니다')
    }
  }

  const handleEditMeeting = (meeting) => {
    setEditingMeeting(meeting)
    setShowEditMeetingModal(true)
  }

  const handleDeleteMeeting = async (meeting) => {
    if (!confirm(`${new Date(meeting.meeting_date).toLocaleString('ko-KR')} 미팅을 삭제하시겠습니까?`)) return

    try {
      await api.deleteMeeting(meeting.id)

      // 미팅 목록 새로고침
      const meetingsRes = await api.getMeetings({ contact_id: selectedContact.id })
      setMeetings(meetingsRes.data || [])

      // 대시보드 새로고침
      loadStaleBoard()

      alert('미팅 내역이 삭제되었습니다.')
    } catch (err) {
      console.error('미팅 삭제 실패:', err)
      alert(err.response?.data?.detail || '미팅 삭제에 실패했습니다')
    }
  }

  const handleDriveLogin = async () => {
    try {
      console.log('🔵 Starting Google Drive login...')
      await gdrive.requestAuthorization()
      setDriveAuthorized(gdrive.isAuthorized())
      console.log('✅ Google Drive login successful')
      alert('Google Drive에 로그인되었습니다.')
    } catch (error) {
      console.error('❌ Google Drive login failed:', error)
      alert(`Google Drive 로그인에 실패했습니다.\n\n에러: ${error.message}\n\n개발자 도구(F12) 콘솔을 확인해주세요.`)
    }
  }

  const handleUploadFile = async () => {
    if (!selectedContact) return
    if (!gdrive.isAuthorized()) {
      alert('Google Drive에 로그인이 필요합니다.')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async (e) => {
      const files = Array.from(e.target.files)
      if (files.length === 0) return

      try {
        // Get company, team, contact names
        const company = companies.find(c => c.id === selectedCompanyId)
        const team = teams.find(t => t.id === selectedTeamId)

        for (const file of files) {
          // Show progress
          setUploadProgress({ fileName: file.name, percent: 0 })

          // Upload to Google Drive with progress callback
          const result = await gdrive.uploadFileToDrive(
            file,
            company.name,
            team.name,
            selectedContact.name,
            (percent) => {
              setUploadProgress({ fileName: file.name, percent })
            }
          )

          // Save metadata to backend
          await api.createContactFile({
            contact_id: selectedContact.id,
            file_name: result.file_name,
            drive_file_id: result.file_id,
            web_view_link: result.web_view_link
          })
        }

        setUploadProgress(null)
        alert('파일 업로드가 완료되었습니다.')
      } catch (error) {
        console.error('File upload error:', error)
        setUploadProgress(null)
        alert('파일 업로드 중 오류가 발생했습니다: ' + error.message)
      }
    }
    input.click()
  }

  const handleOpenDriveFolder = async () => {
    if (!selectedContact) return
    if (!gdrive.isAuthorized()) {
      alert('Google Drive에 로그인이 필요합니다.')
      return
    }

    try {
      const company = companies.find(c => c.id === selectedCompanyId)
      const team = teams.find(t => t.id === selectedTeamId)

      const url = await gdrive.getContactFolderUrl(
        company.name,
        team.name,
        selectedContact.name
      )

      if (url) {
        gdrive.openDriveFolderInBrowser(url)
      } else {
        alert('드라이브에 해당 담당자 폴더가 없습니다.\n파일을 먼저 업로드하면 폴더가 생성됩니다.')
      }
    } catch (error) {
      console.error('Error opening folder:', error)
      alert('폴더 열기 중 오류가 발생했습니다.')
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">로딩중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={goToMainHub}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
              <Home size={16}/>
              메인으로
            </button>
            <button
              onClick={handleHomeClick}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-colors border border-blue-200">
              <Home size={16}/>
              홈
            </button>
            <div className="h-6 w-px bg-slate-300"></div>
            {/* 메인허브 카드와 같은 마크 */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">HTC Partner CRM</h1>
                <p className="text-sm text-slate-500">업체, 팀, 담당자 관리</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {driveInitializing ? (
              <button
                disabled
                className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed flex items-center gap-2 shadow-sm">
                Drive 초기화중...
              </button>
            ) : driveAuthorized ? (
              <button
                disabled
                className="px-4 py-2 bg-green-100 text-green-800 rounded-lg cursor-default flex items-center gap-2 shadow-sm border border-green-300">
                🟢 Drive 연결됨
              </button>
            ) : (
              <button
                onClick={handleDriveLogin}
                className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2 shadow-sm border border-red-300">
                🔴 Drive 로그인
              </button>
            )}
            <button
              onClick={() => setShowSearchModal(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#ef4444'}}>
              <Search size={18}/>
              검색
            </button>
            <button
              onClick={() => setShowAddCompanyModal(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#f97316'}}>
              <Plus size={18}/>
              업체 추가
            </button>
            <button
              onClick={() => setShowMeetingModal(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#eab308'}}>
              <Plus size={18}/>
              미팅 추가
            </button>
            <button
              onClick={() => setShowEditCompanyModal(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#22c55e'}}>
              <Edit size={18}/>
              업체 수정
            </button>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#3b82f6'}}>
              <Users size={18}/>
              카테고리
            </button>
            <button
              onClick={() => setShowRecentMeetingsModal(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#6366f1'}}>
              <Calendar size={18}/>
              최근 미팅
            </button>
            <button
              onClick={() => setShowCompanyTimelineModal(true)}
              disabled={!selectedCompanyId}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{backgroundColor: '#a855f7'}}>
              <TrendingUp size={18}/>
              업체 타임라인
            </button>
            <button
              onClick={() => setShowDeleteCompanyModal(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#ef4444'}}>
              <Trash2 size={18}/>
              업체 삭제
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await api.exportContactsExcel()
                  const url = window.URL.createObjectURL(new Blob([res.data]))
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `담당자목록_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`
                  a.click()
                  window.URL.revokeObjectURL(url)
                } catch (e) {
                  alert('엑셀 다운로드에 실패했습니다')
                }
              }}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#10b981'}}>
              <Download size={18}/>
              엑셀
            </button>
            {/* 견적서 버튼 - 개발 중 (숨김)
            <button
              onClick={() => setShowQuotationList(true)}
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{backgroundColor: '#0ea5e9'}}>
              <FileText size={18}/>
              견적서
            </button>
            */}
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Companies */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 mb-2">업체 ({companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).length})</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input
                type="text"
                placeholder="업체명 검색..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {companySearch && (
                <button
                  onClick={() => setCompanySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14}/>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).map(company => (
              <div
                key={company.id}
                onClick={() => onCompanySelect(company)}
                className={`px-4 py-3 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                  selectedCompanyId === company.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}>
                <div className={`font-medium ${selectedCompanyId === company.id ? 'text-blue-900' : 'text-slate-900'}`}>{company.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {company.team_count || 0}팀 · {company.contact_count || 0}명
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle Left Panel - Teams */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">팀 ({teams.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {teams.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">
                ← 업체를 선택하세요
              </div>
            ) : (
              teams.map(team => (
                <div
                  key={team.id}
                  onClick={() => onTeamSelect(team)}
                  className={`px-4 py-3 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selectedTeamId === team.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}>
                  <div className={`font-medium ${selectedTeamId === team.id ? 'text-blue-900' : 'text-slate-900'}`}>{team.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {team.contact_count || 0}명
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle Right Panel - Contacts */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">담당자 ({contacts.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">
                ← 팀을 선택하세요
              </div>
            ) : (
              contacts.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => onContactSelect(contact)}
                  className={`px-4 py-3 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selectedContact?.id === contact.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  } ${contact.status === 'resigned' ? 'opacity-60' : ''}`}>
                  <div className={`font-medium ${selectedContact?.id === contact.id ? 'text-blue-900' : contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>
                    {contact.name}
                    {contact.status === 'resigned' && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#6b7280', color: 'white' }}>퇴사</span>
                    )}
                  </div>
                  {contact.position && (
                    <div className={`text-xs mt-1 ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-500'}`}>{contact.position}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Contact Detail or Stale Board */}
        <div className="flex-1 bg-slate-50 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h2 className="text-sm font-bold text-slate-900">
              {selectedContact ? '담당자 정보' : '대시보드'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {selectedContact ? (
              <ContactDetailView
                contact={selectedContact}
                meetings={meetings}
                onAddMeeting={() => setShowMeetingModal(true)}
                onEditContact={handleEditContact}
                onDeleteContact={handleDeleteContactFromDetail}
                onEditMeeting={handleEditMeeting}
                onDeleteMeeting={handleDeleteMeeting}
                onUploadFile={handleUploadFile}
                onOpenDriveFolder={handleOpenDriveFolder}
                driveAuthorized={driveAuthorized}
              />
            ) : (
              <StaleBoardView
                staleBoard={staleBoard}
                navigateToContact={navigateToContact}
                onOpenPopup={() => setShowDashboardPopup(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Meeting Modal */}
      {showMeetingModal && (
        <AddMeetingModal
          onClose={() => setShowMeetingModal(false)}
          companies={companies}
          preselectContactId={selectedContact?.id}
          onSuccess={() => {
            setShowMeetingModal(false)
            if (selectedContact) {
              onContactSelect(selectedContact)
            }
            loadStaleBoard()
          }}
        />
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <SearchModal
          onClose={() => setShowSearchModal(false)}
          onNavigate={navigateToContact}
        />
      )}

      {/* Add Company Modal */}
      {showAddCompanyModal && (
        <AddCompanyModal
          onClose={() => setShowAddCompanyModal(false)}
          companies={companies}
          onSuccess={() => {
            setShowAddCompanyModal(false)
            loadCompanies()
          }}
        />
      )}

      {/* Edit Company Modal */}
      {showEditCompanyModal && (
        <EditCompanyModal
          onClose={() => setShowEditCompanyModal(false)}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          onSuccess={() => {
            setShowEditCompanyModal(false)
            loadCompanies()
            if (selectedCompanyId) {
              onCompanySelect(companies.find(c => c.id === selectedCompanyId))
            }
          }}
        />
      )}

      {/* Delete Company Modal */}
      {showDeleteCompanyModal && (
        <DeleteCompanyModal
          onClose={() => setShowDeleteCompanyModal(false)}
          companies={companies}
          onSuccess={() => {
            setShowDeleteCompanyModal(false)
            setSelectedCompanyId(null)
            setSelectedTeamId(null)
            setSelectedContact(null)
            setTeams([])
            setContacts([])
            setMeetings([])
            loadCompanies()
          }}
        />
      )}

      {/* Quotation List Modal */}
      {showQuotationList && (
        <QuotationListModal
          onClose={() => setShowQuotationList(false)}
          onNew={() => {
            setEditingQuotationId(null)
            setShowQuotationModal(true)
          }}
          onEdit={(id) => {
            setEditingQuotationId(id)
            setShowQuotationModal(true)
          }}
          onPrint={(id) => {
            alert('인쇄 기능은 추후 구현 예정입니다')
          }}
        />
      )}

      {/* Quotation Modal */}
      {showQuotationModal && (
        <QuotationModal
          quotationId={editingQuotationId}
          preselect={selectedCompanyId ? { company_id: selectedCompanyId, contact_id: selectedContact?.id } : null}
          onClose={() => {
            setShowQuotationModal(false)
            setEditingQuotationId(null)
          }}
          onSaved={() => {
            setShowQuotationModal(false)
            setEditingQuotationId(null)
          }}
        />
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <CategoryManagementModal
          onClose={() => setShowCategoryModal(false)}
          onSuccess={() => {
            setShowCategoryModal(false)
            loadCompanies()
          }}
        />
      )}

      {/* Recent Meetings Modal */}
      {showRecentMeetingsModal && (
        <RecentMeetingsModal
          onClose={() => setShowRecentMeetingsModal(false)}
          onNavigate={navigateToContact}
        />
      )}

      {/* Company Timeline Modal */}
      {showCompanyTimelineModal && selectedCompanyId && (
        <CompanyTimelineModal
          onClose={() => setShowCompanyTimelineModal(false)}
          companyId={selectedCompanyId}
          companyName={companies.find(c => c.id === selectedCompanyId)?.name || ''}
          onUpdate={() => {
            if (selectedContact) {
              onContactSelect(selectedContact)
            }
            loadStaleBoard()
          }}
        />
      )}

      {/* Dashboard Renewal Popup Modal */}
      {showDashboardPopup && (
        <DashboardRenewalModal
          onClose={() => setShowDashboardPopup(false)}
          onSuccess={() => {
            loadStaleBoard()
          }}
          navigateToContact={navigateToContact}
        />
      )}

      {/* Edit Contact Modal */}
      {showEditContactModal && selectedContact && (
        <EditContactModal
          contact={selectedContact}
          onClose={() => setShowEditContactModal(false)}
          onSuccess={async (teamChanged) => {
            setShowEditContactModal(false)

            if (teamChanged) {
              // 팀이 변경된 경우 전체 새로고침
              await loadCompanies()
              setSelectedContact(null)
              setContacts([])
              setMeetings([])
            } else {
              // 같은 팀 내 정보만 수정된 경우
              const contactsRes = await api.getContacts({ team_id: selectedTeamId })
              setContacts(contactsRes.data || [])
              // 이력 포함한 상세 정보 다시 로드
              const contactDetailRes = await api.getContact(selectedContact.id)
              setSelectedContact(contactDetailRes.data)
            }
          }}
        />
      )}

      {/* Edit Meeting Modal */}
      {showEditMeetingModal && editingMeeting && selectedContact && (
        <EditMeetingModal
          meeting={editingMeeting}
          onClose={() => {
            setShowEditMeetingModal(false)
            setEditingMeeting(null)
          }}
          onSuccess={async () => {
            setShowEditMeetingModal(false)
            setEditingMeeting(null)
            // 미팅 목록 새로고침
            const meetingsRes = await api.getMeetings({ contact_id: selectedContact.id })
            setMeetings(meetingsRes.data || [])
            // 대시보드 새로고침
            loadStaleBoard()
          }}
        />
      )}

      {/* Upload Progress Modal */}
      {uploadProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-bold text-slate-900 mb-4">파일 업로드 중...</h3>
            <div className="space-y-3">
              <div className="text-sm text-slate-600 truncate">
                📁 {uploadProgress.fileName}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                  style={{ width: `${uploadProgress.percent}%` }}>
                  {uploadProgress.percent > 10 && `${uploadProgress.percent}%`}
                </div>
              </div>
              <div className="text-center text-sm font-semibold text-blue-600">
                {uploadProgress.percent}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactDetailView({ contact, meetings, onAddMeeting, onEditContact, onDeleteContact, onEditMeeting, onDeleteMeeting, onUploadFile, onOpenDriveFolder, driveAuthorized }) {
  return (
    <div className="space-y-6">
      {/* Contact Info Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`text-xl font-bold mb-2 ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>
              {contact.name}
              {contact.status === 'resigned' && (
                <span className="ml-2 px-2 py-0.5 text-sm rounded" style={{ backgroundColor: '#6b7280', color: 'white' }}>퇴사</span>
              )}
            </h3>
            {contact.position && (
              <p className={contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-600'}>{contact.position}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onEditContact}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm shadow-sm">
              수정
            </button>
            <button
              onClick={onDeleteContact}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm shadow-sm">
              삭제
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {contact.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone size={16} className="text-slate-500"/>
              <span className="text-slate-700">{contact.phone}</span>
              <button
                onClick={() => copyToClipboard(contact.phone, '전화번호')}
                className="px-2 py-1 bg-slate-100 rounded text-xs hover:bg-slate-200 text-slate-700 border border-slate-300">
                복사
              </button>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-slate-500"/>
              <span className="text-slate-700">{contact.email}</span>
              <button
                onClick={() => copyToClipboard(contact.email, '이메일')}
                className="px-2 py-1 bg-slate-100 rounded text-xs hover:bg-slate-200 text-slate-700 border border-slate-300">
                복사
              </button>
            </div>
          )}

          {/* 이직 이력 표시 */}
          {contact.transfer_history && contact.transfer_history.length > 0 && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-xs font-medium text-amber-800 mb-1">📋 이직 이력</div>
              <div className="space-y-1">
                {contact.transfer_history.map((h, idx) => (
                  <div key={h.id || idx} className="text-xs text-amber-700">
                    <span className="font-medium">{h.from_company_name}</span>
                    {h.from_team_name && <span className="text-amber-600"> ({h.from_team_name})</span>}
                    <span className="mx-1">→</span>
                    <span className="font-medium">{h.to_company_name}</span>
                    {h.to_team_name && <span className="text-amber-600"> ({h.to_team_name})</span>}
                    <span className="ml-1 text-amber-500">
                      ({new Date(h.transferred_at).toLocaleDateString('ko-KR')})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Google Drive Files Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            첨부파일
          </h4>
          <div className="flex gap-2">
            <button
              onClick={onUploadFile}
              disabled={!driveAuthorized}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
              파일 업로드
            </button>
            <button
              onClick={onOpenDriveFolder}
              disabled={!driveAuthorized}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
              드라이브 폴더 열기
            </button>
          </div>
          {!driveAuthorized && (
            <p className="text-xs text-slate-500 mt-2">
              Google Drive에 로그인하면 파일 업로드 및 관리가 가능합니다.
            </p>
          )}
        </div>
      </div>

      {/* Meetings Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar size={20} className="text-blue-600"/>
            미팅 내역 ({meetings.length})
          </h3>
          <button
            onClick={onAddMeeting}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm shadow-sm">
            + 미팅 추가
          </button>
        </div>

        <div className="space-y-3">
          {meetings.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center shadow-sm">
              <Calendar size={48} className="text-slate-300 mx-auto mb-4"/>
              <p className="text-slate-500">미팅 기록이 없습니다</p>
            </div>
          ) : (
            meetings.map(meeting => (
              <div key={meeting.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={14}/>
                    {new Date(meeting.meeting_date).toLocaleString('ko-KR')}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditMeeting(meeting)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 font-medium">
                      수정
                    </button>
                    <button
                      onClick={() => onDeleteMeeting(meeting)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-medium">
                      삭제
                    </button>
                  </div>
                </div>
                {meeting.attendees && (
                  <div className="text-sm text-slate-700 mb-2">
                    <span className="text-slate-500 font-medium">참석자:</span> {meeting.attendees}
                  </div>
                )}
                {meeting.content && (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200">
                    {meeting.content}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StaleBoardView({ staleBoard, navigateToContact, onOpenPopup }) {
  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-800">
            {"30일<노랑, 60일<주황, 90일<빨강"}
          </h3>
          <button
            onClick={onOpenPopup}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-base font-semibold shadow-md"
          >
            <Activity size={20}/>
            상세 현황
          </button>
        </div>
        <p className="text-slate-600 text-sm">
          장기간 미팅이 없는 담당자들입니다. <strong>더블클릭</strong>하여 상세 정보를 확인하세요.
        </p>
      </div>

      {staleBoard.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-300 p-12 text-center">
          <AlertTriangle size={48} className="text-slate-400 mx-auto mb-4"/>
          <p className="text-slate-600">모든 담당자가 관리되고 있습니다!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-300 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  업체명
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  담당자
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  마지막 미팅
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  경과일
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staleBoard.map(contact => {
                // inline style 사용 (Tailwind 색상 문제 해결)
                let bgColor = '#ffffff'
                let textColor = '#374151'

                if (contact.status === 'critical') {
                  bgColor = '#fca5a5'  // red-300
                  textColor = '#7f1d1d'  // red-900
                } else if (contact.status === 'warning') {
                  bgColor = '#fdba74'  // orange-300
                  textColor = '#7c2d12'  // orange-900
                } else if (contact.status === 'caution') {
                  bgColor = '#fde047'  // yellow-300
                  textColor = '#713f12'  // yellow-900
                }

                return (
                  <tr
                    key={contact.contact_id}
                    onDoubleClick={() => navigateToContact(contact.company_id, contact.team_id, contact.contact_id)}
                    style={{ backgroundColor: bgColor }}
                    className="hover:opacity-80 cursor-pointer transition-all">
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: textColor }}>
                      {contact.company_name}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: textColor }}>
                      {contact.contact_name}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: textColor }}>
                      {contact.last_meeting_date
                        ? new Date(contact.last_meeting_date).toLocaleDateString('ko-KR')
                        : '없음'}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: textColor }}>
                      {contact.days_since_meeting ? `${contact.days_since_meeting}일` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-3 py-1 text-xs font-bold" style={{ color: textColor }}>
                        {contact.status_text}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AddMeetingModal({ onClose, companies, preselectContactId, onSuccess }) {
  // 여러 업체 관리: { companyId: { company, teams, selectedTeams, contacts, selectedContacts } }
  const [selectedCompanies, setSelectedCompanies] = useState({})
  const [companySearch, setCompanySearch] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0)
  const dropdownRef = useRef(null)

  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0])
  const [meetingHour, setMeetingHour] = useState(new Date().getHours())
  const [attendees, setAttendees] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (preselectContactId) {
      preselectContact(preselectContactId)
    }
  }, [preselectContactId])

  const preselectContact = async (contactId) => {
    try {
      const res = await api.getContact(contactId)
      const contact = res.data
      const companyId = contact.company_id

      // 팀 로드
      const companyRes = await api.getCrmCompany(companyId)
      const teams = companyRes.data.teams || []

      // 담당자 로드
      const contactsRes = await api.getContacts({ team_id: contact.team_id })
      const contacts = contactsRes.data || []

      // 업체 추가
      setSelectedCompanies({
        [companyId]: {
          company: companies.find(c => c.id === companyId),
          teams,
          selectedTeams: new Set([contact.team_id]),
          contacts,
          selectedContacts: new Set([contactId])
        }
      })
    } catch (err) {
      console.error('담당자 미리선택 실패:', err)
    }
  }

  const onCompanyAdd = async (company) => {
    if (selectedCompanies[company.id]) {
      alert('이미 추가된 업체입니다.')
      return
    }

    try {
      const res = await api.getCrmCompany(company.id)
      setSelectedCompanies(prev => ({
        ...prev,
        [company.id]: {
          company,
          teams: res.data.teams || [],
          selectedTeams: new Set(),
          contacts: [],
          selectedContacts: new Set()
        }
      }))
      setCompanySearch('')
      setShowCompanyDropdown(false)
    } catch (err) {
      console.error('팀 로드 실패:', err)
      alert('업체 정보를 불러오는데 실패했습니다.')
    }
  }

  const onCompanyRemove = (companyId) => {
    setSelectedCompanies(prev => {
      const newCompanies = { ...prev }
      delete newCompanies[companyId]
      return newCompanies
    })
  }

  const onTeamToggle = async (companyId, teamId) => {
    const companyData = selectedCompanies[companyId]
    const newSelectedTeams = new Set(companyData.selectedTeams)

    if (newSelectedTeams.has(teamId)) {
      newSelectedTeams.delete(teamId)
    } else {
      newSelectedTeams.add(teamId)
    }

    // 선택된 팀들의 담당자 로드
    let allContacts = []
    let newSelectedContacts = new Set()

    if (newSelectedTeams.size > 0) {
      try {
        for (const tid of newSelectedTeams) {
          const res = await api.getContacts({ team_id: tid })
          allContacts.push(...(res.data || []))
        }

        // 기존 선택 유지 (존재하는 것만)
        const contactIds = new Set(allContacts.map(c => c.id))
        newSelectedContacts = new Set([...companyData.selectedContacts].filter(id => contactIds.has(id)))
      } catch (err) {
        console.error('담당자 로드 실패:', err)
      }
    }

    setSelectedCompanies(prev => ({
      ...prev,
      [companyId]: {
        ...companyData,
        selectedTeams: newSelectedTeams,
        contacts: allContacts,
        selectedContacts: newSelectedContacts
      }
    }))
  }

  const onContactToggle = (companyId, contactId) => {
    const companyData = selectedCompanies[companyId]
    const newSelectedContacts = new Set(companyData.selectedContacts)

    if (newSelectedContacts.has(contactId)) {
      newSelectedContacts.delete(contactId)
    } else {
      newSelectedContacts.add(contactId)
    }

    setSelectedCompanies(prev => ({
      ...prev,
      [companyId]: {
        ...companyData,
        selectedContacts: newSelectedContacts
      }
    }))
  }

  const handleSubmit = async () => {
    // 모든 선택된 담당자 수집
    const allSelectedContacts = []
    Object.values(selectedCompanies).forEach(companyData => {
      allSelectedContacts.push(...companyData.selectedContacts)
    })

    if (allSelectedContacts.length === 0) {
      alert('담당자를 한 명 이상 선택하세요.')
      return
    }
    if (!content.trim()) {
      alert('미팅 내용을 입력하세요.')
      return
    }

    setSaving(true)
    try {
      const meetingDateTime = `${meetingDate} ${String(meetingHour).padStart(2, '0')}:00:00`

      // 각 담당자마다 미팅 생성
      for (const contactId of allSelectedContacts) {
        await api.createMeeting({
          contact_id: contactId,
          meeting_date: meetingDateTime,
          attendees: attendees.trim(),
          content: content.trim()
        })
      }

      onSuccess()
    } catch (err) {
      console.error('미팅 저장 실패:', err)
      alert(err.response?.data?.detail || '미팅 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearch.toLowerCase()) &&
    !selectedCompanies[c.id]
  )

  useEffect(() => {
    if (showCompanyDropdown && companySearch && filteredCompanies.length > 0) {
      setSelectedDropdownIndex(0)
    }
  }, [showCompanyDropdown, companySearch, filteredCompanies.length])

  useEffect(() => {
    if (dropdownRef.current && showCompanyDropdown) {
      const selected = dropdownRef.current.children[selectedDropdownIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedDropdownIndex, showCompanyDropdown])

  const handleCompanySelect = (company) => {
    onCompanyAdd(company)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900">미팅 내용 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 업체 추가 */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">업체 추가</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input
                type="text"
                placeholder="업체명 검색 후 선택..."
                value={companySearch}
                onChange={(e) => {
                  setCompanySearch(e.target.value)
                  setShowCompanyDropdown(true)
                }}
                onFocus={() => setShowCompanyDropdown(true)}
                onKeyDown={(e) => {
                  if (showCompanyDropdown && companySearch && filteredCompanies.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSelectedDropdownIndex(prev => (prev + 1) % filteredCompanies.slice(0, 10).length)
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSelectedDropdownIndex(prev => (prev - 1 + filteredCompanies.slice(0, 10).length) % filteredCompanies.slice(0, 10).length)
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCompanySelect(filteredCompanies.slice(0, 10)[selectedDropdownIndex])
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setShowCompanyDropdown(false)
                    }
                  }
                }}
                className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {companySearch && (
                <button
                  type="button"
                  onClick={() => setCompanySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14}/>
                </button>
              )}
            </div>
            {showCompanyDropdown && companySearch && filteredCompanies.length > 0 && (
              <div ref={dropdownRef} className="absolute z-[110] w-full mt-1 max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-lg">
                {filteredCompanies.slice(0, 10).map((company, idx) => (
                  <div
                    key={company.id}
                    onClick={() => handleCompanySelect(company)}
                    onMouseEnter={() => setSelectedDropdownIndex(idx)}
                    className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-0 ${idx === selectedDropdownIndex ? 'bg-blue-100' : 'hover:bg-slate-50'}`}>
                    {company.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 선택된 업체들 */}
          {Object.keys(selectedCompanies).length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">선택된 업체 및 담당자</label>
              {Object.entries(selectedCompanies).map(([companyId, companyData]) => (
                <div key={companyId} className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                  {/* 업체 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900">{companyData.company.name}</h3>
                    <button
                      onClick={() => onCompanyRemove(Number(companyId))}
                      className="text-red-600 hover:text-red-700 p-1">
                      <X size={16}/>
                    </button>
                  </div>

                  {/* 팀 선택 */}
                  {companyData.teams.length > 0 && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">팀 선택</label>
                      <div className="max-h-20 overflow-y-auto border border-slate-200 rounded bg-white p-2">
                        {companyData.teams.map(team => (
                          <label key={team.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={companyData.selectedTeams.has(team.id)}
                              onChange={() => onTeamToggle(Number(companyId), team.id)}
                              className="rounded border-slate-300"
                            />
                            <span className="text-sm">{team.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 담당자 선택 */}
                  {companyData.contacts.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">담당자 선택</label>
                      <div className="max-h-24 overflow-y-auto border border-slate-200 rounded bg-white p-2">
                        {companyData.contacts.map(contact => (
                          <label key={contact.id} className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-50 cursor-pointer ${contact.status === 'resigned' ? 'opacity-60' : ''}`}>
                            <input
                              type="checkbox"
                              checked={companyData.selectedContacts.has(contact.id)}
                              onChange={() => onContactToggle(Number(companyId), contact.id)}
                              className="rounded border-slate-300"
                            />
                            <span className={`text-sm ${contact.status === 'resigned' ? 'text-slate-400' : ''}`}>
                              {contact.name}
                              {contact.status === 'resigned' && <span className="ml-1 px-1 py-0.5 text-xs rounded" style={{ backgroundColor: '#6b7280', color: 'white' }}>퇴사</span>}
                              {contact.position && ` (${contact.position})`}
                              {contact.team_name && ` — ${contact.team_name}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 날짜 & 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">날짜</label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">시간</label>
              <select
                value={meetingHour}
                onChange={(e) => setMeetingHour(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>

          {/* 참석자 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">한림 인원</label>
            <input
              type="text"
              placeholder="예: OOO 팀장, OOO 과장"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">내용</label>
            <textarea
              placeholder="미팅 내용을 입력하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex gap-2 justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// === Search Modal ===
function SearchModal({ onClose, onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchIn, setSearchIn] = useState({ company: true, team: true, contact: true, meeting: true })
  const [results, setResults] = useState({ companies: [], teams: [], contacts: [], meetings: [] })
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef(null)

  useEffect(() => {
    // 모달이 열릴 때 검색창에 자동 포커스
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      alert('검색어를 입력하세요.')
      return
    }

    setSearching(true)
    try {
      const newResults = { companies: [], teams: [], contacts: [], meetings: [] }

      // 업체 검색
      if (searchIn.company) {
        const res = await api.getCrmCompanies({ search: searchTerm })
        newResults.companies = res.data || []
      }

      // 팀 검색
      if (searchIn.team) {
        const res = await api.getTeams()
        const teams = res.data || []
        newResults.teams = teams.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
      }

      // 담당자 검색
      if (searchIn.contact) {
        const res = await api.getContacts({ search: searchTerm })
        newResults.contacts = res.data || []
      }

      // 미팅 검색
      if (searchIn.meeting) {
        const res = await api.getMeetings({ limit: 1000 })
        const meetings = res.data || []
        newResults.meetings = meetings.filter(m =>
          (m.content && m.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (m.attendees && m.attendees.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      }

      setResults(newResults)
    } catch (err) {
      console.error('검색 실패:', err)
      alert(err.response?.data?.detail || '검색에 실패했습니다.')
    } finally {
      setSearching(false)
    }
  }

  const totalResults = results.companies.length + results.teams.length + results.contacts.length + results.meetings.length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">검색</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 검색 옵션 체크박스 */}
          <div className="flex gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchIn.company}
                onChange={(e) => setSearchIn({ ...searchIn, company: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">업체</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchIn.team}
                onChange={(e) => setSearchIn({ ...searchIn, team: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">팀</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchIn.contact}
                onChange={(e) => setSearchIn({ ...searchIn, contact: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">담당자</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchIn.meeting}
                onChange={(e) => setSearchIn({ ...searchIn, meeting: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">미팅내용</span>
            </label>
          </div>

          {/* 검색창 */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="검색어 입력..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14}/>
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {searching ? '검색중...' : '검색'}
            </button>
          </div>

          {/* 검색 결과 */}
          {totalResults > 0 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">검색 결과: {totalResults}건</p>

              {/* 업체 결과 */}
              {results.companies.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Building2 size={16} className="text-blue-600"/>
                    업체 ({results.companies.length})
                  </h3>
                  <div className="space-y-2">
                    {results.companies.map(company => (
                      <div
                        key={company.id}
                        className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        onClick={() => { onNavigate(company.id, null, null); onClose(); }}>
                        <div className="font-medium text-slate-900">{company.name}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          {company.team_count || 0}팀 · {company.contact_count || 0}명
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 팀 결과 */}
              {results.teams.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Users size={16} className="text-green-600"/>
                    팀 ({results.teams.length})
                  </h3>
                  <div className="space-y-2">
                    {results.teams.map(team => (
                      <div
                        key={team.id}
                        className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        onClick={() => { onNavigate(team.company_id, team.id, null); onClose(); }}>
                        <div className="font-medium text-slate-900">{team.name}</div>
                        <div className="text-sm text-slate-500 mt-1">{team.company_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 담당자 결과 */}
              {results.contacts.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <User size={16} className="text-purple-600"/>
                    담당자 ({results.contacts.length})
                  </h3>
                  <div className="space-y-2">
                    {results.contacts.map(contact => (
                      <div
                        key={contact.id}
                        className={`p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer ${contact.status === 'resigned' ? 'opacity-60' : ''}`}
                        onClick={() => { onNavigate(contact.company_id, contact.team_id, contact.id); onClose(); }}>
                        <div className={`font-medium ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>
                          {contact.name}
                          {contact.status === 'resigned' && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#6b7280', color: 'white' }}>퇴사</span>
                          )}
                          {contact.position && <span className={`font-normal ml-2 ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-500'}`}>({contact.position})</span>}
                        </div>
                        <div className={`text-sm mt-1 ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {contact.company_name} · {contact.team_name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미팅 결과 */}
              {results.meetings.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Calendar size={16} className="text-orange-600"/>
                    미팅내용 ({results.meetings.length})
                  </h3>
                  <div className="space-y-2">
                    {results.meetings.map(meeting => (
                      <div
                        key={meeting.id}
                        className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        onClick={() => { onNavigate(meeting.company_id, meeting.team_id, meeting.contact_id); onClose(); }}>
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                          <Clock size={14}/>
                          {new Date(meeting.meeting_date).toLocaleDateString('ko-KR')}
                        </div>
                        <div className="font-medium text-slate-900">{meeting.company_name} - {meeting.contact_name}</div>
                        {meeting.attendees && (
                          <div className="text-sm text-slate-600 mt-1">참석: {meeting.attendees}</div>
                        )}
                        {meeting.content && (
                          <div className="text-sm text-slate-500 mt-1 line-clamp-2">{meeting.content}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// === Add Company Modal ===
function AddCompanyModal({ onClose, companies, onSuccess }) {
  const [isNewCompany, setIsNewCompany] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0)
  const dropdownRef = useRef(null)
  const [isNewTeam, setIsNewTeam] = useState(true)
  const [existingTeams, setExistingTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [teamName, setTeamName] = useState('')
  const [contactName, setContactName] = useState('')
  const [position, setPosition] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)

  // 카테고리 목록 로드
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.getContactCategories()
        setCategories(res.data || [])
      } catch (err) {
        console.error('카테고리 로드 실패:', err)
      }
    }
    loadCategories()
  }, [])

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearchTerm.toLowerCase())
  )

  useEffect(() => {
    if (showCompanyDropdown && filteredCompanies.length > 0) {
      setSelectedDropdownIndex(0)
    }
  }, [showCompanyDropdown, filteredCompanies.length])

  useEffect(() => {
    if (dropdownRef.current && showCompanyDropdown) {
      const selected = dropdownRef.current.children[selectedDropdownIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedDropdownIndex, showCompanyDropdown])

  const handleCompanySelect = async (company) => {
    setSelectedCompanyId(company.id)
    setCompanySearchTerm(company.name)
    setShowCompanyDropdown(false)

    // 기존 업체의 팀 목록 로드
    try {
      const res = await api.getCrmCompany(company.id)
      setExistingTeams(res.data.teams || [])
      if (res.data.teams && res.data.teams.length > 0) {
        setIsNewTeam(false) // 기존 팀이 있으면 기존 팀 선택 모드로
      }
    } catch (err) {
      console.error('팀 목록 로드 실패:', err)
      setExistingTeams([])
    }
  }

  const handleSubmit = async () => {
    if (isNewCompany && !companyName.trim()) {
      alert('업체명을 입력하세요.')
      return
    }
    if (!isNewCompany && !selectedCompanyId && !companySearchTerm.trim()) {
      alert('업체를 선택하거나 입력하세요.')
      return
    }
    if (isNewTeam && !teamName.trim()) {
      alert('팀명을 입력하세요.')
      return
    }
    if (!isNewTeam && !selectedTeamId) {
      alert('팀을 선택하세요.')
      return
    }
    if (!contactName.trim()) {
      alert('담당자 이름을 입력하세요.')
      return
    }

    setSaving(true)
    try {
      let companyId = selectedCompanyId

      // 새 업체 생성
      if (isNewCompany) {
        const res = await api.createCrmCompany({ name: companyName.trim() })
        companyId = res.data.id
      } else if (!selectedCompanyId && companySearchTerm.trim()) {
        // 기존 업체 모드지만 선택하지 않고 직접 입력한 경우 새 업체 생성
        const res = await api.createCrmCompany({ name: companySearchTerm.trim() })
        companyId = res.data.id
      }

      // 팀 생성 또는 기존 팀 사용
      let teamId = selectedTeamId
      if (isNewTeam) {
        const teamRes = await api.createTeam({ company_id: companyId, name: teamName.trim() })
        teamId = teamRes.data.id
      }

      // 담당자 생성
      await api.createContact({
        team_id: teamId,
        name: contactName.trim(),
        position: position.trim(),
        phone: phone.trim(),
        email: email.trim(),
        category: category
      })

      onSuccess()
    } catch (err) {
      console.error('저장 실패:', err)
      alert(err.response?.data?.detail || '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900">업체 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 새 업체 / 기존 업체 선택 */}
          <div>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={isNewCompany}
                  onChange={() => setIsNewCompany(true)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">새 업체</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!isNewCompany}
                  onChange={() => setIsNewCompany(false)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">기존 업체</span>
              </label>
            </div>

            {isNewCompany ? (
              <input
                type="text"
                placeholder="새 업체명 입력..."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"/>
                <input
                  type="text"
                  placeholder="업체명 검색 및 입력..."
                  value={companySearchTerm}
                  onChange={(e) => {
                    setCompanySearchTerm(e.target.value)
                    setShowCompanyDropdown(true)
                    setSelectedCompanyId(null)
                  }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  onKeyDown={(e) => {
                    if (showCompanyDropdown && companySearchTerm && filteredCompanies.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setSelectedDropdownIndex(prev => (prev + 1) % filteredCompanies.length)
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSelectedDropdownIndex(prev => (prev - 1 + filteredCompanies.length) % filteredCompanies.length)
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCompanySelect(filteredCompanies[selectedDropdownIndex])
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setShowCompanyDropdown(false)
                      }
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {companySearchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompanySearchTerm('')
                      setSelectedCompanyId(null)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                  >
                    <X size={14}/>
                  </button>
                )}
                {showCompanyDropdown && companySearchTerm && filteredCompanies.length > 0 && (
                  <div ref={dropdownRef} className="absolute z-[60] w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                    {filteredCompanies.map((company, idx) => (
                      <div
                        key={company.id}
                        className={`px-3 py-2 cursor-pointer ${idx === selectedDropdownIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                        onClick={() => handleCompanySelect(company)}
                        onMouseEnter={() => setSelectedDropdownIndex(idx)}>
                        <div className="font-medium text-slate-900">{company.name}</div>
                        <div className="text-xs text-slate-500">
                          {company.team_count || 0}팀 · {company.contact_count || 0}명
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 팀명 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">팀 *</label>

            {/* 기존 업체 선택 시 팀 선택/입력 옵션 표시 */}
            {!isNewCompany && selectedCompanyId && existingTeams.length > 0 && (
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!isNewTeam}
                    onChange={() => {
                      setIsNewTeam(false)
                      setTeamName('')
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">기존 팀 선택</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={isNewTeam}
                    onChange={() => {
                      setIsNewTeam(true)
                      setSelectedTeamId(null)
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">새 팀 입력</span>
                </label>
              </div>
            )}

            {/* 기존 팀 선택 */}
            {!isNewCompany && selectedCompanyId && existingTeams.length > 0 && !isNewTeam ? (
              <select
                value={selectedTeamId || ''}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">팀 선택...</option>
                {existingTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.contact_count || 0}명)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="팀명 입력..."
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* 담당자 정보 */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-900">담당자 정보</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">이름 *</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">직급</label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">전화번호</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">카테고리 *</label>
              <Combobox
                value={category}
                onChange={setCategory}
                options={categories}
                placeholder="카테고리 선택 또는 입력..."
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex gap-2 justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// === Edit Company Modal ===
function EditCompanyModal({ onClose, companies, selectedCompanyId, onSuccess }) {
  const [companyId, setCompanyId] = useState(selectedCompanyId || null)
  const [companyName, setCompanyName] = useState('')
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0)
  const dropdownRef = useRef(null)
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)

  // 카테고리 목록
  const [categories, setCategories] = useState([])
  const [editingCategoryContactId, setEditingCategoryContactId] = useState(null)
  const [tempCategory, setTempCategory] = useState('')

  // 팀 추가
  const [newTeamName, setNewTeamName] = useState('')

  // 담당자 추가
  const [newContact, setNewContact] = useState({ name: '', position: '', phone: '', email: '', category: '', note: '' })

  useEffect(() => {
    // 카테고리 목록 로드
    const loadCategories = async () => {
      try {
        const res = await api.getContactCategories()
        setCategories(res.data || [])
      } catch (err) {
        console.error('카테고리 로드 실패:', err)
      }
    }
    loadCategories()
  }, [])

  useEffect(() => {
    if (companyId) {
      loadCompanyData(companyId)
    }
  }, [companyId])

  useEffect(() => {
    if (selectedTeamId) {
      loadContacts(selectedTeamId)
    } else {
      setContacts([])
    }
  }, [selectedTeamId])

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearchTerm.toLowerCase())
  )

  useEffect(() => {
    if (showCompanyDropdown && filteredCompanies.length > 0) {
      setSelectedDropdownIndex(0)
    }
  }, [showCompanyDropdown, filteredCompanies.length])

  useEffect(() => {
    if (dropdownRef.current && showCompanyDropdown) {
      const selected = dropdownRef.current.children[selectedDropdownIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedDropdownIndex, showCompanyDropdown])

  const handleCompanySelect = (company) => {
    setCompanyId(company.id)
    setCompanySearchTerm(company.name)
    setShowCompanyDropdown(false)
  }

  const loadCompanyData = async (id) => {
    setLoading(true)
    try {
      const res = await api.getCrmCompany(id)
      setCompanyName(companies.find(c => c.id === id)?.name || '')
      setTeams(res.data.teams || [])
    } catch (err) {
      console.error('업체 정보 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadContacts = async (teamId) => {
    try {
      const res = await api.getContacts({ team_id: teamId })
      setContacts(res.data || [])
    } catch (err) {
      console.error('담당자 로드 실패:', err)
    }
  }

  const handleRenameCompany = async () => {
    if (!companyName.trim()) {
      alert('업체명을 입력하세요.')
      return
    }

    if (!confirm(`업체명을 변경하시겠습니까?`)) return

    try {
      await api.updateCrmCompany(companyId, { name: companyName.trim() })
      alert('업체명이 변경되었습니다.')
      onSuccess()
    } catch (err) {
      console.error('업체명 변경 실패:', err)
      alert(err.response?.data?.detail || '업체명 변경에 실패했습니다')
    }
  }

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) {
      alert('팀명을 입력하세요.')
      return
    }

    try {
      await api.createTeam({
        company_id: companyId,
        name: newTeamName.trim()
      })
      setNewTeamName('')
      loadCompanyData(companyId)
      alert('팀이 추가되었습니다.')
    } catch (err) {
      console.error('팀 추가 실패:', err)
      alert(err.response?.data?.detail || '팀 추가에 실패했습니다')
    }
  }

  const handleRenameTeam = async (teamId, oldName) => {
    const newName = prompt('새 팀명을 입력하세요:', oldName)
    if (!newName || newName.trim() === oldName) return

    try {
      await api.updateTeam(teamId, { name: newName.trim() })
      loadCompanyData(companyId)
      alert('팀명이 변경되었습니다.')
    } catch (err) {
      console.error('팀명 변경 실패:', err)
      alert(err.response?.data?.detail || '팀명 변경에 실패했습니다')
    }
  }

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`'${teamName}' 팀을 삭제하시겠습니까?\n담당자와 미팅 내역도 모두 삭제됩니다.`)) return

    try {
      await api.deleteTeam(teamId)
      setSelectedTeamId(null)
      loadCompanyData(companyId)
      alert('팀이 삭제되었습니다.')
    } catch (err) {
      console.error('팀 삭제 실패:', err)
      alert(err.response?.data?.detail || '팀 삭제에 실패했습니다')
    }
  }

  const handleAddContact = async () => {
    if (!selectedTeamId) {
      alert('먼저 팀을 선택하세요.')
      return
    }
    if (!newContact.name.trim()) {
      alert('담당자 이름을 입력하세요.')
      return
    }

    try {
      await api.createContact({
        team_id: selectedTeamId,
        name: newContact.name.trim(),
        position: newContact.position.trim(),
        phone: newContact.phone.trim(),
        email: newContact.email.trim(),
        category: newContact.category,
        note: newContact.note.trim()
      })
      setNewContact({ name: '', position: '', phone: '', email: '', category: '', note: '' })
      loadContacts(selectedTeamId)
      alert('담당자가 추가되었습니다.')
    } catch (err) {
      console.error('담당자 추가 실패:', err)
      alert(err.response?.data?.detail || '담당자 추가에 실패했습니다')
    }
  }

  const handleChangeContactCategory = async (contactId, newCategory) => {
    try {
      await api.updateContact(contactId, { category: newCategory })
      loadContacts(selectedTeamId)
      setEditingCategoryContactId(null)
    } catch (err) {
      console.error('카테고리 변경 실패:', err)
      alert(err.response?.data?.detail || '카테고리 변경에 실패했습니다')
    }
  }

  const handleDeleteContact = async (contactId, contactName) => {
    if (!confirm(`'${contactName}'을 삭제하시겠습니까?\n미팅 내역도 모두 삭제됩니다.`)) return

    try {
      await api.deleteContact(contactId)
      loadContacts(selectedTeamId)
      alert('담당자가 삭제되었습니다.')
    } catch (err) {
      console.error('담당자 삭제 실패:', err)
      alert(err.response?.data?.detail || '담당자 삭제에 실패했습니다')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900">업체 수정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 업체 선택 및 이름 변경 */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-2">업체명</label>
            {!companyId ? (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"/>
                <input
                  type="text"
                  placeholder="업체명 검색..."
                  value={companySearchTerm}
                  onChange={(e) => {
                    setCompanySearchTerm(e.target.value)
                    setShowCompanyDropdown(true)
                  }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  onKeyDown={(e) => {
                    if (showCompanyDropdown && filteredCompanies.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setSelectedDropdownIndex(prev => (prev + 1) % filteredCompanies.length)
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSelectedDropdownIndex(prev => (prev - 1 + filteredCompanies.length) % filteredCompanies.length)
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCompanySelect(filteredCompanies[selectedDropdownIndex])
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setShowCompanyDropdown(false)
                      }
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {companySearchTerm && (
                  <button
                    type="button"
                    onClick={() => setCompanySearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                  >
                    <X size={14}/>
                  </button>
                )}
                {showCompanyDropdown && filteredCompanies.length > 0 && (
                  <div ref={dropdownRef} className="absolute z-[60] w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                    {filteredCompanies.map((company, idx) => (
                      <div
                        key={company.id}
                        className={`px-3 py-2 cursor-pointer ${idx === selectedDropdownIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                        onClick={() => handleCompanySelect(company)}
                        onMouseEnter={() => setSelectedDropdownIndex(idx)}>
                        <div className="font-medium text-slate-900">{company.name}</div>
                        <div className="text-xs text-slate-500">
                          {company.team_count || 0}팀 · {company.contact_count || 0}명
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleRenameCompany}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                  업체명 변경
                </button>
              </div>
            )}
          </div>

          {companyId && (
            <div className="grid grid-cols-2 gap-6">
              {/* 왼쪽: 팀 목록 */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Users size={18} className="text-green-600"/>
                  팀 목록 ({teams.length})
                </h3>

                {/* 팀 추가 */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="새 팀명..."
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTeam()}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    onClick={handleAddTeam}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                    +
                  </button>
                </div>

                {/* 팀 리스트 */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {loading ? (
                    <p className="text-slate-500 text-sm">로딩 중...</p>
                  ) : teams.length === 0 ? (
                    <p className="text-slate-500 text-sm">팀이 없습니다.</p>
                  ) : (
                    teams.map(team => (
                      <div
                        key={team.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTeamId === team.id
                            ? 'bg-blue-50 border-blue-500'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedTeamId(team.id)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-900">{team.name}</div>
                            <div className="text-sm text-slate-500">{team.contact_count || 0}명</div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRenameTeam(team.id, team.name); }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 font-medium">
                              ✏
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id, team.name); }}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-medium">
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 오른쪽: 담당자 목록 */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <User size={18} className="text-purple-600"/>
                  {selectedTeamId ? `담당자 목록 (${contacts.length})` : '← 팀을 선택하세요'}
                </h3>

                {selectedTeamId && (
                  <>
                    {/* 담당자 추가 폼 */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 space-y-2">
                      <p className="text-xs font-medium text-slate-700 mb-2">담당자 추가</p>
                      <input
                        type="text"
                        placeholder="이름 *"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="직급"
                        value={newContact.position}
                        onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="전화번호"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="이메일"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="메모"
                        value={newContact.note}
                        onChange={(e) => setNewContact({ ...newContact, note: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <select
                        value={newContact.category}
                        onChange={(e) => setNewContact({ ...newContact, category: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddContact}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        + 담당자 추가
                      </button>
                    </div>

                    {/* 담당자 리스트 */}
                    <div className="space-y-2 max-h-[280px] overflow-y-auto">
                      {contacts.length === 0 ? (
                        <p className="text-slate-500 text-sm">담당자가 없습니다.</p>
                      ) : (
                        contacts.map(contact => (
                          <div key={contact.id} className={`p-3 border border-slate-200 rounded-lg hover:bg-slate-50 ${contact.status === 'resigned' ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className={`font-medium ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>
                                  {contact.name}
                                  {contact.status === 'resigned' && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#6b7280', color: 'white' }}>퇴사</span>
                                  )}
                                  {contact.position && <span className={`font-normal ml-2 ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-500'}`}>({contact.position})</span>}
                                </div>
                                {contact.phone && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-600">{contact.phone}</span>
                                    <button
                                      onClick={() => copyToClipboard(contact.phone, '전화번호')}
                                      className="px-1.5 py-0.5 bg-slate-100 rounded text-xs hover:bg-slate-200 text-slate-700 border border-slate-300">
                                      복사
                                    </button>
                                  </div>
                                )}
                                {contact.email && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-600">{contact.email}</span>
                                    <button
                                      onClick={() => copyToClipboard(contact.email, '이메일')}
                                      className="px-1.5 py-0.5 bg-slate-100 rounded text-xs hover:bg-slate-200 text-slate-700 border border-slate-300">
                                      복사
                                    </button>
                                  </div>
                                )}
                                <div className="mt-2">
                                  {editingCategoryContactId === contact.id ? (
                                    <div className="flex gap-2 items-center">
                                      <div className="flex-1">
                                        <Combobox
                                          value={tempCategory}
                                          onChange={setTempCategory}
                                          options={categories}
                                          placeholder="카테고리..."
                                          className="text-xs"
                                        />
                                      </div>
                                      <button
                                        onClick={() => handleChangeContactCategory(contact.id, tempCategory)}
                                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                        저장
                                      </button>
                                      <button
                                        onClick={() => setEditingCategoryContactId(null)}
                                        className="px-2 py-1 bg-slate-300 text-slate-700 rounded text-xs hover:bg-slate-400">
                                        취소
                                      </button>
                                    </div>
                                  ) : (
                                    <span
                                      className="inline-block px-2 py-0.5 text-xs rounded-full cursor-pointer hover:opacity-80"
                                      style={{
                                        backgroundColor: contact.category === '분류필요' ? '#ef4444' : '#3b82f6',
                                        color: 'white'
                                      }}
                                      onClick={() => {
                                        setEditingCategoryContactId(contact.id)
                                        setTempCategory(contact.category || '')
                                      }}>
                                      {contact.category || '분류필요'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteContact(contact.id, contact.name)}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-medium">
                                🗑 삭제
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex gap-2 justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// === Delete Company Modal ===
function DeleteCompanyModal({ onClose, companies, onSuccess }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0)
  const dropdownRef = useRef(null)
  const [deleting, setDeleting] = useState(false)

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    if (showDropdown && filteredCompanies.length > 0) {
      setSelectedDropdownIndex(0)
    }
  }, [showDropdown, filteredCompanies.length])

  useEffect(() => {
    if (dropdownRef.current && showDropdown) {
      const selected = dropdownRef.current.children[selectedDropdownIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedDropdownIndex, showDropdown])

  const handleCompanySelect = (company) => {
    setSelectedCompanyId(company.id)
    setSelectedCompanyName(company.name)
    setSearchTerm(company.name)
    setShowDropdown(false)
  }

  const handleDelete = async () => {
    if (!selectedCompanyId) {
      alert('업체를 선택하세요.')
      return
    }

    if (!confirm(`'${selectedCompanyName}' 업체를 삭제하시겠습니까?\n\n업체, 팀, 담당자, 미팅내역이 모두 삭제됩니다.`)) {
      return
    }

    setDeleting(true)
    try {
      await api.deleteCrmCompany(selectedCompanyId)
      alert('업체가 삭제되었습니다.')
      onSuccess()
    } catch (err) {
      console.error('업체 삭제 실패:', err)
      alert(err.response?.data?.detail || '업체 삭제에 실패했습니다')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Trash2 size={20} className="text-red-600"/>
            업체 삭제
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm font-medium">⚠ 경고</p>
            <p className="text-red-700 text-sm mt-1">
              업체 삭제 시 팀, 담당자, 미팅 내역이 모두 삭제됩니다.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">삭제할 업체 검색</label>
            <div className="relative">
              <input
                type="text"
                placeholder="업체명 검색..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setShowDropdown(true)
                  if (!e.target.value) {
                    setSelectedCompanyId(null)
                    setSelectedCompanyName('')
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={(e) => {
                  if (showDropdown && filteredCompanies.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSelectedDropdownIndex(prev => (prev + 1) % filteredCompanies.length)
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSelectedDropdownIndex(prev => (prev - 1 + filteredCompanies.length) % filteredCompanies.length)
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCompanySelect(filteredCompanies[selectedDropdownIndex])
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setShowDropdown(false)
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {showDropdown && filteredCompanies.length > 0 && (
                <div ref={dropdownRef} className="absolute z-[60] w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                  {filteredCompanies.map((company, idx) => (
                    <div
                      key={company.id}
                      className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 ${idx === selectedDropdownIndex ? 'bg-red-100' : 'hover:bg-red-50'}`}
                      onClick={() => handleCompanySelect(company)}
                      onMouseEnter={() => setSelectedDropdownIndex(idx)}>
                      <div className="font-medium text-slate-900">{company.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {company.team_count || 0}팀 · {company.contact_count || 0}명
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedCompanyId && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-700">선택된 업체:</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{selectedCompanyName}</p>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex gap-2 justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || !selectedCompanyId}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

// === Recent Meetings Modal ===
function RecentMeetingsModal({ onClose, onNavigate }) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadRecentMeetings()
  }, [])

  const loadRecentMeetings = async () => {
    setLoading(true)
    try {
      const res = await api.getRecentMeetings(30)
      setMeetings(res.data || [])
    } catch (err) {
      console.error('최근 미팅 로드 실패:', err)
      alert(err.response?.data?.detail || '최근 미팅을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 같은 미팅 그룹핑 (날짜, 시간, 참석자, 내용이 동일한 경우)
  const groupedByMeeting = meetings.reduce((acc, meeting) => {
    const key = `${meeting.meeting_date}|${meeting.attendees || ''}|${meeting.content || ''}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(meeting)
    return acc
  }, {})

  // 그룹핑된 미팅들을 하나의 객체로 만들기
  const mergedMeetings = Object.values(groupedByMeeting).map(group => {
    const firstMeeting = group[0]

    // 업체별로 담당자 그룹핑
    const companiesMap = {}
    group.forEach(m => {
      if (!companiesMap[m.company_id]) {
        companiesMap[m.company_id] = {
          company_name: m.company_name,
          contacts: []
        }
      }
      companiesMap[m.company_id].contacts.push({
        contact_id: m.contact_id,
        contact_name: m.contact_name,
        contact_position: m.contact_position,
        team_id: m.team_id,
        team_name: m.team_name
      })
    })

    return {
      ...firstMeeting,
      companies: Object.values(companiesMap)
    }
  })

  // 날짜별 그룹핑
  const groupedMeetings = mergedMeetings.reduce((acc, meeting) => {
    const dateObj = new Date(meeting.meeting_date)
    const dateKey = dateObj.toISOString().split('T')[0] // YYYY-MM-DD
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(meeting)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar size={24} className="text-purple-600"/>
            최근 30일 미팅 내역
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">로딩 중...</div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">최근 30일 내 미팅 내역이 없습니다.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedMeetings)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([dateKey, dateMeetings]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={16} className="text-blue-600"/>
                    <h3 className="font-bold text-slate-900">{new Date(dateKey + 'T00:00:00').toLocaleDateString('ko-KR')}</h3>
                    <span className="text-sm text-slate-500">({dateMeetings.length}건)</span>
                  </div>
                  <div className="space-y-2">
                    {dateMeetings
                      .sort((a, b) => new Date(b.meeting_date) - new Date(a.meeting_date))
                      .map((meeting, idx) => {
                        // 첫 번째 담당자로 네비게이션
                        const firstCompany = meeting.companies[0]
                        const firstContact = firstCompany?.contacts[0]

                        // 업체별 담당자 문자열 생성
                        const participantsText = meeting.companies.map(company => {
                          const contactsText = company.contacts.map(contact =>
                            contact.contact_position
                              ? `${contact.contact_name}(${contact.contact_position})`
                              : contact.contact_name
                          ).join(', ')
                          return `${company.company_name}-${contactsText}`
                        }).join(' / ')

                        return (
                          <div
                            key={`${meeting.meeting_date}-${idx}`}
                            className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                            onClick={() => {
                              if (firstContact) {
                                onNavigate(firstCompany.contacts[0].company_id || meeting.company_id, firstContact.team_id, firstContact.contact_id);
                                onClose();
                              }
                            }}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-slate-900">
                                  {participantsText}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 ml-2">
                                <Clock size={12}/>
                                {new Date(meeting.meeting_date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            {meeting.attendees && (
                              <div className="text-sm text-slate-600 mb-2">
                                <span className="font-medium">참석:</span> {meeting.attendees}
                              </div>
                            )}
                            {meeting.content && (
                              <div className="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                                {meeting.content}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center">
          <span className="text-sm text-slate-500">총 {mergedMeetings.length}건</span>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// === Company Timeline Modal ===
function CompanyTimelineModal({ onClose, companyId, companyName, onUpdate }) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTimeline()
  }, [companyId])

  const loadTimeline = async () => {
    setLoading(true)
    try {
      const res = await api.getCompanyTimeline(companyId)
      setMeetings(res.data || [])
    } catch (err) {
      console.error('타임라인 로드 실패:', err)
      alert(err.response?.data?.detail || '타임라인을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 같은 미팅 그룹핑 (날짜, 시간, 참석자, 내용이 동일한 경우)
  const groupedByMeeting = meetings.reduce((acc, meeting) => {
    const key = `${meeting.meeting_date}|${meeting.attendees || ''}|${meeting.content || ''}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(meeting)
    return acc
  }, {})

  // 그룹핑된 미팅들을 하나의 객체로 만들기
  const mergedMeetings = Object.values(groupedByMeeting).map(group => {
    const firstMeeting = group[0]

    // 담당자들 수집
    const contacts = group.map(m => ({
      contact_id: m.contact_id,
      contact_name: m.contact_name,
      contact_position: m.contact_position,
      team_id: m.team_id,
      team_name: m.team_name
    }))

    return {
      ...firstMeeting,
      contacts
    }
  })

  // 날짜별 그룹핑
  const groupedMeetings = mergedMeetings.reduce((acc, meeting) => {
    const dateObj = new Date(meeting.meeting_date)
    const dateKey = dateObj.toISOString().split('T')[0] // YYYY-MM-DD
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(meeting)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={24} className="text-indigo-600"/>
            {companyName} - 미팅 타임라인
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-slate-500">로딩 중...</div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">이 업체의 미팅 내역이 없습니다.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedMeetings)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([dateKey, dateMeetings]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-indigo-200">
                    <Calendar size={18} className="text-indigo-600"/>
                    <h3 className="font-bold text-slate-900 text-lg">{new Date(dateKey + 'T00:00:00').toLocaleDateString('ko-KR')}</h3>
                    <span className="text-sm text-slate-500">({dateMeetings.length}건)</span>
                  </div>
                  <div className="space-y-3 pl-6">
                    {dateMeetings
                      .sort((a, b) => new Date(b.meeting_date) - new Date(a.meeting_date))
                      .map((meeting, idx) => {
                        // 담당자들을 팀별로 그룹핑
                        const teamMap = {}
                        meeting.contacts.forEach(contact => {
                          if (!teamMap[contact.team_name]) {
                            teamMap[contact.team_name] = []
                          }
                          teamMap[contact.team_name].push(contact)
                        })

                        // 팀별 담당자 문자열 생성
                        const participantsText = Object.entries(teamMap).map(([teamName, contacts]) => {
                          const contactsText = contacts.map(contact =>
                            contact.contact_position
                              ? `${contact.contact_name}(${contact.contact_position})`
                              : contact.contact_name
                          ).join(', ')
                          return `${teamName}-${contactsText}`
                        }).join(' / ')

                        return (
                          <div key={`${meeting.meeting_date}-${idx}`} className="relative">
                            {/* Timeline dot */}
                            <div className="absolute -left-[13px] top-2 w-2 h-2 bg-indigo-500 rounded-full"></div>

                            <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900">
                                    {participantsText}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1 ml-2">
                                  <Clock size={12}/>
                                  {new Date(meeting.meeting_date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              {meeting.attendees && (
                                <div className="text-sm text-slate-600 mb-2">
                                  <span className="font-medium">참석:</span> {meeting.attendees}
                                </div>
                              )}
                              {meeting.content && (
                                <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100 mt-2">
                                  {meeting.content}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center rounded-b-lg flex-shrink-0">
          <span className="text-sm text-slate-500">총 {mergedMeetings.length}건</span>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// === Dashboard Renewal Popup Modal ===
function DashboardRenewalModal({ onClose, onSuccess, navigateToContact }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [minDays, setMinDays] = useState(30)
  const [selectedContactIds, setSelectedContactIds] = useState(new Set())
  const [renewalDate, setRenewalDate] = useState(
    new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD
  )
  const [submitting, setSubmitting] = useState(false)
  const [showContactActionModal, setShowContactActionModal] = useState(false)
  const [clickedContact, setClickedContact] = useState(null)

  useEffect(() => {
    loadContacts()
  }, [showAll, minDays])

  const loadContacts = async () => {
    setLoading(true)
    try {
      const res = await api.getAllContactsWithDates({
        show_all: showAll,
        min_days: minDays
      })
      setContacts(res.data.contacts || [])
      setSelectedContactIds(new Set())
    } catch (err) {
      console.error('담당자 목록 로드 실패:', err)
      alert(err.response?.data?.detail || '담당자 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const toggleContactSelection = (contactId) => {
    const newSet = new Set(selectedContactIds)
    if (newSet.has(contactId)) {
      newSet.delete(contactId)
    } else {
      newSet.add(contactId)
    }
    setSelectedContactIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedContactIds.size === contacts.length) {
      setSelectedContactIds(new Set())
    } else {
      setSelectedContactIds(new Set(contacts.map(c => c.contact_id)))
    }
  }

  const handleBulkRenewal = async () => {
    if (selectedContactIds.size === 0) {
      alert('갱신할 담당자를 선택해주세요.')
      return
    }

    if (!renewalDate) {
      alert('갱신 날짜를 선택해주세요.')
      return
    }

    const confirmed = confirm(
      `${selectedContactIds.size}명의 담당자 연락일을 ${renewalDate}로 갱신하시겠습니까?`
    )

    if (!confirmed) return

    setSubmitting(true)
    try {
      const res = await api.bulkRenewContactDates({
        contact_ids: Array.from(selectedContactIds),
        new_contact_date: renewalDate
      })

      alert(`${res.data.updated_count}명의 연락일이 갱신되었습니다.`)

      await loadContacts()

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('연락일 갱신 실패:', err)
      alert(err.response?.data?.detail || '연락일 갱신에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const groupedContacts = contacts.reduce((acc, contact) => {
    const status = contact.status || 'normal'
    if (!acc[status]) acc[status] = []
    acc[status].push(contact)
    return acc
  }, {})

  const statusOrder = ['critical', 'warning', 'caution', 'normal']
  const statusColors = {
    critical: { bg: '#fca5a5', text: '#7f1d1d', label: '90일 초과' },
    warning: { bg: '#fdba74', text: '#7c2d12', label: '60일 초과' },
    caution: { bg: '#fde047', text: '#713f12', label: '30일 초과' },
    normal: { bg: '#ffffff', text: '#374151', label: '정상' }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity size={24} className="text-blue-600"/>
              마지막 미팅 후 30일 초과 담당자 현황
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={20}/>
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              미팅 또는 연락 기준으로 30일 이상 경과된 담당자 목록입니다.
              미팅없이 전화 등으로 연락한 경우 <strong>연락일을 갱신</strong>하면 목록에서 제외됩니다.
            </p>
	    <p className="text-sm text-red-500 font-medium mt-1">
  	      * 미팅이력 없는 업체는 표시안됨
	    </p>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">전체 업체 보기</span>
              </label>

              {!showAll && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-700">경과일:</label>
                  <select
                    value={minDays}
                    onChange={(e) => setMinDays(Number(e.target.value))}
                    className="border border-slate-300 rounded px-3 py-1 text-sm"
                  >
                    <option value={30}>30일 이상</option>
                    <option value={60}>60일 이상</option>
                    <option value={90}>90일 이상</option>
                  </select>
                </div>
              )}

              <div className="flex-1"></div>

              <div className="text-sm text-slate-600">
                총 {contacts.length}명 | 선택 {selectedContactIds.size}명
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500">로딩 중...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {showAll ? '등록된 담당자가 없습니다.' : '해당 조건의 담당자가 없습니다.'}
            </div>
          ) : (
            <div className="space-y-6">
              {statusOrder.map(status => {
                const statusContacts = groupedContacts[status] || []
                if (statusContacts.length === 0) return null

                const colors = statusColors[status]

                return (
                  <div key={status}>
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <span style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        padding: '4px 12px',
                        borderRadius: '6px'
                      }}>
                        {colors.label}
                      </span>
                      <span className="text-slate-500 text-sm">({statusContacts.length}명)</span>
                    </h3>

                    <div className="bg-white rounded-lg border border-slate-300 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-100 border-b border-slate-300">
                          <tr>
                            <th className="px-4 py-3 text-left w-12">
                              <input
                                type="checkbox"
                                checked={statusContacts.every(c => selectedContactIds.has(c.contact_id))}
                                onChange={() => {
                                  const allSelected = statusContacts.every(c => selectedContactIds.has(c.contact_id))
                                  const newSet = new Set(selectedContactIds)
                                  statusContacts.forEach(c => {
                                    if (allSelected) {
                                      newSet.delete(c.contact_id)
                                    } else {
                                      newSet.add(c.contact_id)
                                    }
                                  })
                                  setSelectedContactIds(newSet)
                                }}
                                className="w-4 h-4 cursor-pointer"
                              />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">업체명</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">팀명</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">담당자</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">마지막 미팅</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">마지막 연락</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">경과일</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {statusContacts.map(contact => (
                            <tr
                              key={contact.contact_id}
                              className={`hover:bg-slate-50 ${
                                selectedContactIds.has(contact.contact_id) ? 'bg-blue-50' : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedContactIds.has(contact.contact_id)}
                                  onChange={() => toggleContactSelection(contact.contact_id)}
                                  className="w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                {contact.company_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700">
                                {contact.team_name}
                              </td>
                              <td
                                className="px-4 py-3 text-sm text-slate-700 cursor-pointer hover:text-blue-600 hover:underline"
                                onClick={() => {
                                  setClickedContact(contact)
                                  setShowContactActionModal(true)
                                }}
                              >
                                {contact.contact_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {contact.last_meeting_date
                                  ? new Date(contact.last_meeting_date).toLocaleDateString('ko-KR')
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {contact.last_contact_date
                                  ? new Date(contact.last_contact_date).toLocaleDateString('ko-KR')
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                {contact.days_since_last_contact || 0}일
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer - Renewal Controls */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedContactIds.size === contacts.length && contacts.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">전체 선택</span>
            </label>

            <div className="flex-1"></div>

            <label className="text-sm font-medium text-slate-700">갱신 날짜:</label>
            <input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2 text-sm"
            />

            <button
              onClick={handleBulkRenewal}
              disabled={selectedContactIds.size === 0 || submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? '갱신 중...' : `갱신 (${selectedContactIds.size})`}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* Contact Action Selection Modal */}
      {showContactActionModal && clickedContact && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]"
          onClick={() => setShowContactActionModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {clickedContact.contact_name}
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              {clickedContact.company_name} / {clickedContact.team_name}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowContactActionModal(false)
                  onClose()
                  if (navigateToContact) {
                    navigateToContact(
                      clickedContact.company_id,
                      clickedContact.team_id,
                      clickedContact.contact_id
                    )
                  }
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <User size={18}/>
                담당자 상세정보로 이동
              </button>
            </div>

            <button
              onClick={() => setShowContactActionModal(false)}
              className="w-full mt-4 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// === Edit Contact Modal ===
function EditContactModal({ contact, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: contact.name || '',
    position: contact.position || '',
    phone: contact.phone || '',
    email: contact.email || '',
    category: contact.category || '',
    note: contact.note || ''
  })
  const [categories, setCategories] = useState([])
  const [isTransfer, setIsTransfer] = useState(false)
  const [companies, setCompanies] = useState([])
  const [isNewCompany, setIsNewCompany] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0)
  const dropdownRef = useRef(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [teams, setTeams] = useState([])
  const [isNewTeam, setIsNewTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState(contact.team_id)
  const [currentTeams, setCurrentTeams] = useState([])
  const [saving, setSaving] = useState(false)
  const [resignLoading, setResignLoading] = useState(false)
  const [transferHistory, setTransferHistory] = useState([])
  const [showAddHistory, setShowAddHistory] = useState(false)
  const [newHistory, setNewHistory] = useState({ from_company_name: '', from_team_name: '', transferred_at: '' })
  const [addingHistory, setAddingHistory] = useState(false)
  // 이력 추가용 드롭다운 상태
  const [historyCompanySearch, setHistoryCompanySearch] = useState('')
  const [historyShowCompanyDropdown, setHistoryShowCompanyDropdown] = useState(false)
  const [historySelectedCompanyId, setHistorySelectedCompanyId] = useState(null)
  const [historyTeams, setHistoryTeams] = useState([])
  const [historyTeamSearch, setHistoryTeamSearch] = useState('')
  const [historyShowTeamDropdown, setHistoryShowTeamDropdown] = useState(false)
  const historyCompanyDropdownRef = useRef(null)
  const historyTeamDropdownRef = useRef(null)

  // 이직 이력 로드
  const loadTransferHistory = async () => {
    try {
      const res = await api.getContact(contact.id)
      setTransferHistory(res.data.transfer_history || [])
    } catch (err) {
      console.error('이직 이력 로드 실패:', err)
    }
  }

  useEffect(() => {
    loadTransferHistory()
  }, [contact.id])

  // 이력 추가용 업체 필터링
  const historyFilteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(historyCompanySearch.toLowerCase())
  )

  // 이력 추가용 팀 필터링
  const historyFilteredTeams = historyTeams.filter(t =>
    t.name.toLowerCase().includes(historyTeamSearch.toLowerCase())
  )

  // 이력 추가용 업체 선택
  const handleHistoryCompanySelect = async (company) => {
    setHistorySelectedCompanyId(company.id)
    setHistoryCompanySearch(company.name)
    setNewHistory({...newHistory, from_company_name: company.name})
    setHistoryShowCompanyDropdown(false)
    setHistoryTeamSearch('')
    setHistoryTeams([])

    try {
      const res = await api.getCrmCompany(company.id)
      setHistoryTeams(res.data.teams || [])
    } catch (err) {
      console.error('팀 로드 실패:', err)
    }
  }

  // 이력 추가용 팀 선택
  const handleHistoryTeamSelect = (team) => {
    setHistoryTeamSearch(team.name)
    setNewHistory({...newHistory, from_team_name: team.name})
    setHistoryShowTeamDropdown(false)
  }

  // 이력 추가 폼 초기화
  const resetHistoryForm = () => {
    setNewHistory({ from_company_name: '', from_team_name: '', transferred_at: '' })
    setHistoryCompanySearch('')
    setHistorySelectedCompanyId(null)
    setHistoryTeams([])
    setHistoryTeamSearch('')
    setHistoryShowCompanyDropdown(false)
    setHistoryShowTeamDropdown(false)
  }

  // 이력 수동 추가
  const handleAddHistory = async () => {
    const companyName = historyCompanySearch.trim() || newHistory.from_company_name.trim()
    if (!companyName) {
      alert('이전 회사명을 입력하세요.')
      return
    }
    setAddingHistory(true)
    try {
      await api.addTransferHistory(contact.id, {
        from_company_name: companyName,
        from_team_name: historyTeamSearch.trim() || newHistory.from_team_name.trim() || null,
        transferred_at: newHistory.transferred_at || null
      })
      resetHistoryForm()
      setShowAddHistory(false)
      await loadTransferHistory()
    } catch (err) {
      console.error('이력 추가 실패:', err)
      alert(err.response?.data?.detail || '이력 추가에 실패했습니다')
    } finally {
      setAddingHistory(false)
    }
  }

  // 이력 삭제
  const handleDeleteHistory = async (historyId) => {
    if (!confirm('이 이직 이력을 삭제하시겠습니까?')) return
    try {
      await api.deleteTransferHistory(contact.id, historyId)
      await loadTransferHistory()
    } catch (err) {
      console.error('이력 삭제 실패:', err)
      alert(err.response?.data?.detail || '이력 삭제에 실패했습니다')
    }
  }

  const handleResign = async () => {
    if (!confirm(`'${contact.name}' 담당자를 퇴사 처리하시겠습니까?`)) return
    setResignLoading(true)
    try {
      await api.resignContact(contact.id)
      alert('퇴사 처리되었습니다.')
      onSuccess(false)
    } catch (err) {
      console.error('퇴사 처리 실패:', err)
      alert(err.response?.data?.detail || '퇴사 처리에 실패했습니다')
    } finally {
      setResignLoading(false)
    }
  }

  const handleRestore = async () => {
    setResignLoading(true)
    try {
      await api.restoreContact(contact.id)
      alert('퇴사가 취소되었습니다.')
      onSuccess(false)
    } catch (err) {
      console.error('퇴사 취소 실패:', err)
      alert(err.response?.data?.detail || '퇴사 취소에 실패했습니다')
    } finally {
      setResignLoading(false)
    }
  }

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companySearchTerm.toLowerCase())
  )

  useEffect(() => {
    loadCompanies()
    loadCurrentTeams()
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const res = await api.getContactCategories()
      setCategories(res.data || [])
    } catch (err) {
      console.error('카테고리 로드 실패:', err)
    }
  }

  useEffect(() => {
    if (showCompanyDropdown && companySearchTerm && filteredCompanies.length > 0) {
      setSelectedDropdownIndex(0)
    }
  }, [showCompanyDropdown, companySearchTerm, filteredCompanies.length])

  useEffect(() => {
    if (dropdownRef.current && showCompanyDropdown) {
      const selected = dropdownRef.current.children[selectedDropdownIndex]
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedDropdownIndex, showCompanyDropdown])

  const loadCompanies = async () => {
    try {
      const res = await api.getCrmCompanies()
      setCompanies(res.data || [])
    } catch (err) {
      console.error('업체 로드 실패:', err)
    }
  }

  const loadCurrentTeams = async () => {
    try {
      // 현재 업체의 팀 목록 로드
      const res = await api.getCrmCompany(contact.company_id)
      setCurrentTeams(res.data.teams || [])
    } catch (err) {
      console.error('팀 로드 실패:', err)
    }
  }

  const handleCompanySelect = async (company) => {
    setSelectedCompanyId(company.id)
    setCompanySearchTerm(company.name)
    setShowCompanyDropdown(false)
    setSelectedTeamId(null)
    setTeams([])

    try {
      const res = await api.getCrmCompany(company.id)
      const loadedTeams = res.data.teams || []
      setTeams(loadedTeams)
      // 기존 팀이 있으면 기존 팀 선택 모드로, 없으면 새 팀 입력 모드로
      if (loadedTeams.length > 0) {
        setIsNewTeam(false)
      } else {
        setIsNewTeam(true)
      }
    } catch (err) {
      console.error('팀 로드 실패:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('담당자 이름을 입력하세요.')
      return
    }

    // 이직 처리 시 검증
    if (isTransfer) {
      if (isNewCompany && !newCompanyName.trim()) {
        alert('업체명을 입력하세요.')
        return
      }
      if (!isNewCompany && !selectedCompanyId && !companySearchTerm.trim()) {
        alert('업체를 선택하거나 입력하세요.')
        return
      }
      if (isNewTeam && !newTeamName.trim()) {
        alert('팀명을 입력하세요.')
        return
      }
      if (!isNewTeam && !selectedTeamId) {
        alert('팀을 선택하세요.')
        return
      }
    }

    // 같은 업체 내 팀 변경 시 팀 선택 필수
    if (!isTransfer && selectedTeamId !== contact.team_id && !selectedTeamId) {
      alert('팀을 선택하세요.')
      return
    }

    setSaving(true)
    try {
      let finalCompanyId = selectedCompanyId
      let finalTeamId = selectedTeamId

      // 이직 처리 시
      if (isTransfer) {
        // 새 업체 생성
        if (isNewCompany) {
          const companyRes = await api.createCrmCompany({ name: newCompanyName.trim() })
          finalCompanyId = companyRes.data.id
        } else if (!selectedCompanyId && companySearchTerm.trim()) {
          // 기존 업체 모드지만 선택하지 않고 직접 입력한 경우 새 업체 생성
          const companyRes = await api.createCrmCompany({ name: companySearchTerm.trim() })
          finalCompanyId = companyRes.data.id
        }

        // 새 팀 생성이 필요한 경우
        if (isNewTeam && newTeamName.trim()) {
          const teamRes = await api.createTeam({
            company_id: finalCompanyId,
            name: newTeamName.trim()
          })
          finalTeamId = teamRes.data.id
        }
      }

      const updateData = {
        name: formData.name.trim(),
        position: formData.position.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        category: formData.category,
        note: formData.note.trim()
      }

      // 팀 변경이 있으면 team_id 추가
      if (finalTeamId && finalTeamId !== contact.team_id) {
        updateData.team_id = finalTeamId
      }

      await api.updateContact(contact.id, updateData)

      const teamChanged = finalTeamId && finalTeamId !== contact.team_id

      if (teamChanged) {
        alert('담당자 정보가 수정되고 팀이 변경되었습니다.')
      } else {
        alert('담당자 정보가 수정되었습니다.')
      }

      onSuccess(teamChanged)
    } catch (err) {
      console.error('담당자 수정 실패:', err)
      alert(err.response?.data?.detail || '담당자 수정에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900">담당자 수정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {/* 이직 처리 토글 */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setIsTransfer(!isTransfer)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isTransfer
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}>
                🏢 이직 처리
              </button>
              {isTransfer && (
                <span className="text-sm text-slate-600">다른 업체/팀으로 이동</span>
              )}

              {/* 퇴사 처리/취소 버튼 */}
              {contact.status === 'resigned' ? (
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={resignLoading}
                  className="px-4 py-2 rounded-lg font-medium transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                  {resignLoading ? '처리중...' : '↩ 퇴사 취소'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResign}
                  disabled={resignLoading}
                  className="px-4 py-2 rounded-lg font-medium transition-colors text-white hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: '#6b7280' }}>
                  {resignLoading ? '처리중...' : '🚪 퇴사 처리'}
                </button>
              )}
            </div>

            {/* 이직 모드: 업체/팀 선택 */}
            {isTransfer && (
              <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    업체 <span className="text-red-600">*</span>
                  </label>

                  {/* 새 업체 / 기존 업체 선택 */}
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!isNewCompany}
                        onChange={() => {
                          setIsNewCompany(false)
                          setNewCompanyName('')
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">기존 업체</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={isNewCompany}
                        onChange={() => {
                          setIsNewCompany(true)
                          setSelectedCompanyId(null)
                          setCompanySearchTerm('')
                          setTeams([])
                          setIsNewTeam(true)
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">새 업체</span>
                    </label>
                  </div>

                  {isNewCompany ? (
                    <input
                      type="text"
                      placeholder="새 업체명 입력..."
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"/>
                      <input
                        type="text"
                        placeholder="업체명 검색..."
                        value={companySearchTerm}
                        onChange={(e) => {
                          setCompanySearchTerm(e.target.value)
                          setShowCompanyDropdown(true)
                          setSelectedCompanyId(null)
                        }}
                        onFocus={() => setShowCompanyDropdown(true)}
                        onKeyDown={(e) => {
                          if (showCompanyDropdown && companySearchTerm && filteredCompanies.length > 0) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              setSelectedDropdownIndex(prev => (prev + 1) % filteredCompanies.length)
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              setSelectedDropdownIndex(prev => (prev - 1 + filteredCompanies.length) % filteredCompanies.length)
                            } else if (e.key === 'Enter') {
                              e.preventDefault()
                              handleCompanySelect(filteredCompanies[selectedDropdownIndex])
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              setShowCompanyDropdown(false)
                            }
                          }
                        }}
                        className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {companySearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setCompanySearchTerm('')
                            setSelectedCompanyId(null)
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                        >
                          <X size={14}/>
                        </button>
                      )}
                      {showCompanyDropdown && companySearchTerm && filteredCompanies.length > 0 && (
                        <div ref={dropdownRef} className="absolute z-[60] w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                          {filteredCompanies.map((company, idx) => (
                            <div
                              key={company.id}
                              className={`px-3 py-2 cursor-pointer ${idx === selectedDropdownIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                              onClick={() => handleCompanySelect(company)}
                              onMouseEnter={() => setSelectedDropdownIndex(idx)}>
                              <div className="font-medium text-slate-900">{company.name}</div>
                              <div className="text-xs text-slate-500">
                                {company.team_count || 0}팀 · {company.contact_count || 0}명
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 팀 선택/입력 - 기존 업체 선택 시 또는 새 업체 입력 시 */}
                {(selectedCompanyId || isNewCompany) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      팀 <span className="text-red-600">*</span>
                    </label>

                    {/* 기존 업체 선택 시에만 팀 선택/입력 옵션 표시 */}
                    {!isNewCompany && selectedCompanyId && teams.length > 0 && (
                      <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={!isNewTeam}
                            onChange={() => {
                              setIsNewTeam(false)
                              setNewTeamName('')
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700">기존 팀 선택</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={isNewTeam}
                            onChange={() => {
                              setIsNewTeam(true)
                              setSelectedTeamId(null)
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700">새 팀 입력</span>
                        </label>
                      </div>
                    )}

                    {/* 기존 팀 선택 또는 새 팀 입력 */}
                    {!isNewCompany && !isNewTeam && teams.length > 0 ? (
                      <select
                        value={selectedTeamId || ''}
                        onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={isTransfer}>
                        <option value="">팀 선택...</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.contact_count || 0}명)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="새 팀명 입력..."
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={isTransfer}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 같은 업체 내 팀 변경 */}
            {!isTransfer && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">팀</label>
                <select
                  value={selectedTeamId || contact.team_id}
                  onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {currentTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                이름 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="이름 입력"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">직책</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({...formData, position: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="직책 입력"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">전화번호</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="전화번호 입력"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">이메일</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="이메일 입력"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">메모</label>
              <input
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({...formData, note: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="메모 입력"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">카테고리</label>
              <Combobox
                value={formData.category}
                onChange={(value) => setFormData({...formData, category: value})}
                options={categories}
                placeholder="카테고리 선택 또는 입력..."
                className="text-sm"
              />
            </div>

            {/* 이직 이력 섹션 */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-amber-800">📋 이직 이력</label>
                <button
                  type="button"
                  onClick={() => setShowAddHistory(!showAddHistory)}
                  className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700">
                  {showAddHistory ? '취소' : '+ 이력 추가'}
                </button>
              </div>

              {/* 이력 추가 폼 */}
              {showAddHistory && (
                <div className="mb-3 p-2 bg-white rounded border border-amber-300 space-y-2">
                  {/* 업체 드롭다운 */}
                  <div className="relative" ref={historyCompanyDropdownRef}>
                    <input
                      type="text"
                      placeholder="이전 회사명 * (검색 또는 직접 입력)"
                      value={historyCompanySearch}
                      onChange={(e) => {
                        setHistoryCompanySearch(e.target.value)
                        setNewHistory({...newHistory, from_company_name: e.target.value})
                        setHistoryShowCompanyDropdown(true)
                        setHistorySelectedCompanyId(null)
                        setHistoryTeams([])
                        setHistoryTeamSearch('')
                      }}
                      onFocus={() => setHistoryShowCompanyDropdown(true)}
                      onBlur={() => setTimeout(() => setHistoryShowCompanyDropdown(false), 200)}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {historyShowCompanyDropdown && historyCompanySearch && historyFilteredCompanies.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto bg-white border border-slate-300 rounded shadow-lg">
                        {historyFilteredCompanies.slice(0, 10).map(c => (
                          <div
                            key={c.id}
                            onClick={() => handleHistoryCompanySelect(c)}
                            className="px-2 py-1 text-sm hover:bg-amber-100 cursor-pointer">
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 팀 드롭다운 */}
                  <div className="relative" ref={historyTeamDropdownRef}>
                    <input
                      type="text"
                      placeholder="이전 팀/부서명 (선택, 검색 또는 직접 입력)"
                      value={historyTeamSearch}
                      onChange={(e) => {
                        setHistoryTeamSearch(e.target.value)
                        setNewHistory({...newHistory, from_team_name: e.target.value})
                        setHistoryShowTeamDropdown(true)
                      }}
                      onFocus={() => historyTeams.length > 0 && setHistoryShowTeamDropdown(true)}
                      onBlur={() => setTimeout(() => setHistoryShowTeamDropdown(false), 200)}
                      className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {historyShowTeamDropdown && historyTeams.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto bg-white border border-slate-300 rounded shadow-lg">
                        {historyFilteredTeams.map(t => (
                          <div
                            key={t.id}
                            onClick={() => handleHistoryTeamSelect(t)}
                            className="px-2 py-1 text-sm hover:bg-amber-100 cursor-pointer">
                            {t.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newHistory.transferred_at}
                      onChange={(e) => setNewHistory({...newHistory, transferred_at: e.target.value})}
                      className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddHistory}
                      disabled={addingHistory || !historyCompanySearch.trim()}
                      className="px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
                      {addingHistory ? '...' : '추가'}
                    </button>
                  </div>
                </div>
              )}

              {/* 이력 목록 */}
              {transferHistory.length > 0 ? (
                <div className="space-y-2">
                  {transferHistory.map((h, idx) => (
                    <div key={h.id || idx} className="text-sm text-amber-700 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <div>
                          <span className="font-medium">{h.from_company_name}</span>
                          {h.from_team_name && <span className="text-amber-600"> ({h.from_team_name})</span>}
                          <span className="mx-2">→</span>
                          <span className="font-medium">{h.to_company_name}</span>
                          {h.to_team_name && <span className="text-amber-600"> ({h.to_team_name})</span>}
                          <span className="ml-2 text-xs text-amber-500">
                            ({new Date(h.transferred_at).toLocaleDateString('ko-KR')})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(h.id)}
                        className="text-red-400 hover:text-red-600 text-xs px-1">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-amber-600">이직 이력이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// === Edit Meeting Modal ===
function EditMeetingModal({ meeting, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    date: meeting.meeting_date ? meeting.meeting_date.split('T')[0] : '',
    time: meeting.meeting_date ? meeting.meeting_date.split('T')[1]?.substring(0, 5) : '09:00',
    attendees: meeting.attendees || '',
    content: meeting.content || ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.content.trim()) {
      alert('미팅 내용을 입력하세요.')
      return
    }

    setSaving(true)
    try {
      const meetingDate = `${formData.date}T${formData.time}:00`
      await api.updateMeeting(meeting.id, {
        meeting_date: meetingDate,
        attendees: formData.attendees.trim(),
        content: formData.content.trim()
      })
      alert('미팅 내역이 수정되었습니다.')
      onSuccess()
    } catch (err) {
      console.error('미팅 수정 실패:', err)
      alert(err.response?.data?.detail || '미팅 수정에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900">미팅 내용 수정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">날짜</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">시간</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">한림 인원</label>
              <input
                type="text"
                value={formData.attendees}
                onChange={(e) => setFormData({...formData, attendees: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="참석자 입력 (예: 홍길동, 김철수)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                내용 <span className="text-red-600">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="미팅 내용 입력"
                rows={6}
                required
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// === Category Management Modal ===
function CategoryManagementModal({ onClose, onSuccess }) {
  const [categories, setCategories] = useState([])
  const [allContacts, setAllContacts] = useState([])
  const [filteredContacts, setFilteredContacts] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('분류필요')
  const [selectedContactIds, setSelectedContactIds] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCategories()
    loadAllContacts()
  }, [])

  useEffect(() => {
    // 선택된 카테고리와 검색어로 필터링
    let filtered = allContacts

    // 카테고리 필터링
    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(c => (c.category || '분류필요') === selectedCategory)
    }

    // 검색어 필터링
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.company_name && c.company_name.toLowerCase().includes(term)) ||
        (c.team_name && c.team_name.toLowerCase().includes(term)) ||
        (c.position && c.position.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term))
      )
    }

    setFilteredContacts(filtered)
    setSelectedContactIds([])
  }, [selectedCategory, allContacts, searchTerm])

  const loadCategories = async () => {
    try {
      const res = await api.getContactCategories()
      setCategories(res.data || [])
    } catch (err) {
      console.error('카테고리 로드 실패:', err)
    }
  }

  const loadAllContacts = async () => {
    setLoading(true)
    try {
      const res = await api.getContacts({})
      setAllContacts(res.data || [])
    } catch (err) {
      console.error('담당자 로드 실패:', err)
      alert('담당자 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([])
    } else {
      setSelectedContactIds(filteredContacts.map(c => c.id))
    }
  }

  const handleToggleContact = (contactId) => {
    if (selectedContactIds.includes(contactId)) {
      setSelectedContactIds(selectedContactIds.filter(id => id !== contactId))
    } else {
      setSelectedContactIds([...selectedContactIds, contactId])
    }
  }

  const handleBulkUpdate = async () => {
    if (selectedContactIds.length === 0) {
      alert('담당자를 선택하세요.')
      return
    }
    if (!newCategory.trim()) {
      alert('카테고리를 입력하세요.')
      return
    }

    if (!confirm(`선택한 ${selectedContactIds.length}명의 담당자를 '${newCategory}' 카테고리로 변경하시겠습니까?`)) {
      return
    }

    setSaving(true)
    try {
      // 선택된 담당자들의 카테고리 일괄 업데이트
      await Promise.all(
        selectedContactIds.map(contactId =>
          api.updateContact(contactId, { category: newCategory })
        )
      )
      alert('카테고리가 변경되었습니다.')
      setSelectedContactIds([])
      setNewCategory('')
      loadAllContacts()
      onSuccess()
    } catch (err) {
      console.error('카테고리 변경 실패:', err)
      alert('카테고리 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const categoryStats = categories.map(cat => ({
    name: cat,
    count: allContacts.filter(c => (c.category || '분류필요') === cat).length
  }))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="text-white border-b px-6 py-4 flex items-center justify-between rounded-t-lg" style={{backgroundColor: '#eab308', borderColor: '#ca8a04'}}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={20}/>
            카테고리 관리
          </h2>
          <button onClick={onClose} className="text-white hover:opacity-80">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          {/* 카테고리 통계 */}
          <div className="mb-4 grid grid-cols-7 gap-2">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}>
              전체 ({allContacts.length})
            </button>
            {categoryStats.map(stat => (
              <button
                key={stat.name}
                onClick={() => setSelectedCategory(stat.name)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === stat.name
                    ? stat.name === '분류필요'
                      ? 'text-white'
                      : 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                style={selectedCategory === stat.name && stat.name === '분류필요' ? {backgroundColor: '#ef4444'} : {}}>
                {stat.name} ({stat.count})
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="담당자, 업체, 팀, 직책, 전화번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          {/* 일괄 변경 */}
          {selectedContactIds.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedContactIds.length}명 선택됨
                </span>
                <div className="flex-1">
                  <Combobox
                    value={newCategory}
                    onChange={setNewCategory}
                    options={categories}
                    placeholder="변경할 카테고리..."
                    className="text-sm"
                  />
                </div>
                <button
                  onClick={handleBulkUpdate}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                  {saving ? '변경 중...' : '일괄 변경'}
                </button>
              </div>
            </div>
          )}

          {/* 담당자 목록 */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500">로딩 중...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500">담당자가 없습니다.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                      <input
                        type="checkbox"
                        checked={selectedContactIds.length === filteredContacts.length && filteredContacts.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">업체</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">팀</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase min-w-[120px]">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">직책</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">전화번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">카테고리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredContacts.map(contact => (
                    <tr key={contact.id} className={`hover:bg-slate-50 ${contact.status === 'resigned' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(contact.id)}
                          onChange={() => handleToggleContact(contact.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className={`px-4 py-3 text-sm ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>{contact.company_name}</td>
                      <td className={`px-4 py-3 text-sm ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>{contact.team_name}</td>
                      <td className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>
                        {contact.name}
                        {contact.status === 'resigned' && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#6b7280', color: 'white' }}>퇴사</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-600'}`}>{contact.position || '-'}</td>
                      <td className={`px-4 py-3 text-sm ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-600'}`}>{contact.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-1 text-xs rounded-full whitespace-nowrap"
                          style={{
                            backgroundColor: (contact.category || '분류필요') === '분류필요' ? '#ef4444' : '#3b82f6',
                            color: 'white'
                          }}>
                          {contact.category || '분류필요'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex gap-2 justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
