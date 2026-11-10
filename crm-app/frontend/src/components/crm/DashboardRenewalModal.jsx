import { useState, useEffect } from 'react'
import { Activity, X, User } from 'lucide-react'
import * as api from '../../api'

// === Dashboard Renewal Popup Modal ===
export default function DashboardRenewalModal({ onClose, onSuccess, navigateToContact }) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
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

                    <div className="bg-white rounded-lg border border-slate-300 overflow-x-auto">
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4"
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
