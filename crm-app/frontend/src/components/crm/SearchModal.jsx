import { useState, useRef, useEffect } from 'react'
import { X, Search, Building2, Users, User, Calendar, Clock } from 'lucide-react'
import * as api from '../../api'

// === Search Modal ===
export default function SearchModal({ onClose, onNavigate }) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
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
