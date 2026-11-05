import { useState, useEffect } from 'react'
import { Users, X } from 'lucide-react'
import * as api from '../../api'
import Combobox from '../Combobox'

// === Category Management Modal ===
export default function CategoryManagementModal({ onClose, onSuccess }) {
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
