import { useState, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import * as api from '../../api'

export default function AddMeetingModal({ onClose, companies, preselectContactId, onSuccess }) {
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
