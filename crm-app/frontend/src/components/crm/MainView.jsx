import { useState, useEffect } from 'react'
import { Home, Users, Search, Plus, Edit, Calendar, TrendingUp, Trash2, Download, X } from 'lucide-react'
import * as api from '../../api'
import * as gdrive from '../../utils/googleDrive'
import QuotationModal from '../quotation/QuotationModal'
import QuotationListModal from '../quotation/QuotationListModal'
import AddCompanyModal from './AddCompanyModal'
import AddMeetingModal from './AddMeetingModal'
import CategoryManagementModal from './CategoryManagementModal'
import CompanyTimelineModal from './CompanyTimelineModal'
import ContactDetailView from './ContactDetailView'
import DashboardRenewalModal from './DashboardRenewalModal'
import DeleteCompanyModal from './DeleteCompanyModal'
import EditCompanyModal from './EditCompanyModal'
import EditContactModal from './EditContactModal'
import EditMeetingModal from './EditMeetingModal'
import RecentMeetingsModal from './RecentMeetingsModal'
import SearchModal from './SearchModal'
import StaleBoardView from './StaleBoardView'

export default function MainView({ navigate }) {
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
  const [showBoard, setShowBoard] = useState(false) // 폰: 장기 미활동 대시보드 화면
  const [showMore, setShowMore] = useState(false)   // 폰: 헤더 나머지 버튼 펼침
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

  // 폰/세로 태블릿(lg 미만)에선 이 단계의 칸 하나만 보여줌. PC는 4칸 모두
  const step = selectedContact || showBoard ? 'detail' : selectedTeamId ? 'teamContacts' : selectedCompanyId ? 'teams' : 'companies'
  const show = (name) => (step === name ? 'flex' : 'hidden')
  useEffect(() => { if (window.innerWidth < 1024) window.scrollTo(0, 0) }, [step])
  const moreCls = showMore ? '' : 'max-lg:hidden'
  const companyName = companies.find(c => c.id === selectedCompanyId)?.name
  const teamName = teams.find(t => t.id === selectedTeamId)?.name
  const backFromDetail = () => { setShowBoard(false); setSelectedContact(null); setMeetings([]) }
  const backFromContacts = () => { setSelectedTeamId(null); setContacts([]) }

  const handleHomeClick = () => {
    setShowBoard(false)
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
        <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">HTC Partner CRM</h1>
                <p className="hidden sm:block text-sm text-slate-500">업체, 팀, 담당자 관리</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {driveInitializing ? (
              <button
                disabled
                className={`${moreCls} px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed flex items-center gap-2 shadow-sm`}>
                Drive 초기화중...
              </button>
            ) : driveAuthorized ? (
              <button
                disabled
                className={`${moreCls} px-4 py-2 bg-green-100 text-green-800 rounded-lg cursor-default flex items-center gap-2 shadow-sm border border-green-300`}>
                🟢 Drive 연결됨
              </button>
            ) : (
              <button
                onClick={handleDriveLogin}
                className={`${moreCls} px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2 shadow-sm border border-red-300`}>
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
              className={`${moreCls} px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90`}
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
              className={`${moreCls} px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90`}
              style={{backgroundColor: '#22c55e'}}>
              <Edit size={18}/>
              업체 수정
            </button>
            <button
              onClick={() => setShowCategoryModal(true)}
              className={`${moreCls} px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90`}
              style={{backgroundColor: '#3b82f6'}}>
              <Users size={18}/>
              카테고리
            </button>
            <button
              onClick={() => setShowRecentMeetingsModal(true)}
              className={`${moreCls} px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90`}
              style={{backgroundColor: '#6366f1'}}>
              <Calendar size={18}/>
              최근 미팅
            </button>
            <button
              onClick={() => setShowCompanyTimelineModal(true)}
              disabled={!selectedCompanyId}
              className={`${moreCls} px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{backgroundColor: '#a855f7'}}>
              <TrendingUp size={18}/>
              업체 타임라인
            </button>
            <button
              onClick={() => setShowDeleteCompanyModal(true)}
              className={`${moreCls} px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90`}
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
              className={`${moreCls} px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:opacity-90`}
              style={{backgroundColor: '#10b981'}}>
              <Download size={18}/>
              엑셀
            </button>
            <button onClick={() => setShowMore(!showMore)}
              className="lg:hidden px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 text-sm">
              {showMore ? '접기' : '더보기'}
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
      <div className="flex h-[calc(100vh-73px)] max-lg:h-auto">
        {/* Left Panel - Companies */}
        <div className={`${show('companies')} lg:flex w-full lg:w-64 bg-white border-r border-slate-200 flex-col shadow-sm`}>
          <button onClick={() => setShowBoard(true)}
            className="lg:hidden m-3 mb-0 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium text-left">
            📊 장기 미활동 대시보드 보기
          </button>
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
        <div className={`${show('teams')} lg:flex w-full lg:w-64 bg-white border-r border-slate-200 flex-col`}>
          <button onClick={handleHomeClick} className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white text-left">
            <span className="text-blue-600 text-lg leading-none">←</span>
            <span className="font-semibold text-slate-800 truncate">{companyName}</span>
          </button>
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
        <div className={`${show('teamContacts')} lg:flex w-full lg:w-64 bg-white border-r border-slate-200 flex-col`}>
          <button onClick={backFromContacts} className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white text-left">
            <span className="text-blue-600 text-lg leading-none">←</span>
            <span className="font-semibold text-slate-800 truncate">{`${companyName || ''} · ${teamName || ''}`}</span>
          </button>
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
        <div className={`${show('detail')} lg:flex flex-1 min-w-0 bg-slate-50 flex-col`}>
          <button onClick={backFromDetail} className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white text-left">
            <span className="text-blue-600 text-lg leading-none">←</span>
            <span className="font-semibold text-slate-800 truncate">{selectedContact ? (teamName || '담당자 목록') : '업체 목록'}</span>
          </button>
          <div className="p-4 border-b border-slate-200 bg-white">
            <h2 className="text-sm font-bold text-slate-900">
              {selectedContact ? '담당자 정보' : '대시보드'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 lg:p-6">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
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
