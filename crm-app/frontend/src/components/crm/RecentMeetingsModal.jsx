import { useState, useEffect } from 'react'
import { Calendar, X, Clock } from 'lucide-react'
import * as api from '../../api'

// === Recent Meetings Modal ===
export default function RecentMeetingsModal({ onClose, onNavigate }) {
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
