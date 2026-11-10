import { useState, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import * as api from '../../api'
import Combobox from '../Combobox'

// === Edit Contact Modal ===
export default function EditContactModal({ contact, onClose, onSuccess }) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
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
