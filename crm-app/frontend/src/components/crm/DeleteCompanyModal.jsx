import { useState, useRef, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import * as api from '../../api'

// === Delete Company Modal ===
const CONFIRM_TEXT = '삭제합니다.'

export default function DeleteCompanyModal({ onClose, companies, onSuccess }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0)
  const dropdownRef = useRef(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const confirmed = confirmText.trim().replace(/\.$/, '') === CONFIRM_TEXT.replace(/\.$/, '') // 끝의 마침표는 없어도 됨

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
    setConfirmText('') // 다른 업체를 고르면 다시 입력
  }

  const handleDelete = async () => {
    if (!selectedCompanyId) {
      alert('업체를 선택하세요.')
      return
    }

    if (!confirmed) {
      alert(`'${CONFIRM_TEXT}'를 입력해야 삭제됩니다.`)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
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

          {selectedCompanyId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                삭제하려면 <span className="font-bold text-red-600">{CONFIRM_TEXT}</span> 를 입력하세요
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && confirmed && !deleting) handleDelete() }}
                placeholder={CONFIRM_TEXT}
                autoComplete="off"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${confirmed ? 'border-red-400' : 'border-slate-300'}`}
              />
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
            disabled={deleting || !selectedCompanyId || !confirmed}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}
