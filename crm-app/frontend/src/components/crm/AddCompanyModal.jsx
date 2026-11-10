import { useState, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import * as api from '../../api'
import Combobox from '../Combobox'

// === Add Company Modal ===
export default function AddCompanyModal({ onClose, companies, onSuccess }) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
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
