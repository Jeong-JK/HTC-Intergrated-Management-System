import { useState, useRef, useEffect } from 'react'
import { X, Search, Users, User } from 'lucide-react'
import * as api from '../../api'
import Combobox from '../Combobox'
import { copyToClipboard } from '../../utils/clipboard'

// === Edit Company Modal ===
export default function EditCompanyModal({ onClose, companies, selectedCompanyId, onSuccess }) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
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
