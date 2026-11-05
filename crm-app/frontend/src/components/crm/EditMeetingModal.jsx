import { useState } from 'react'
import { X } from 'lucide-react'
import * as api from '../../api'

// === Edit Meeting Modal ===
export default function EditMeetingModal({ meeting, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    date: meeting.meeting_date ? meeting.meeting_date.split('T')[0] : '',
    time: meeting.meeting_date ? meeting.meeting_date.split('T')[1]?.substring(0, 5) : '09:00',
    attendees: meeting.attendees || '',
    content: meeting.content || ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.content.trim()) {
      alert('미팅 내용을 입력하세요.')
      return
    }

    setSaving(true)
    try {
      const meetingDate = `${formData.date}T${formData.time}:00`
      await api.updateMeeting(meeting.id, {
        meeting_date: meetingDate,
        attendees: formData.attendees.trim(),
        content: formData.content.trim()
      })
      alert('미팅 내역이 수정되었습니다.')
      onSuccess()
    } catch (err) {
      console.error('미팅 수정 실패:', err)
      alert(err.response?.data?.detail || '미팅 수정에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-bold text-slate-900">미팅 내용 수정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">날짜</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">시간</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">한림 인원</label>
              <input
                type="text"
                value={formData.attendees}
                onChange={(e) => setFormData({...formData, attendees: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="참석자 입력 (예: 홍길동, 김철수)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                내용 <span className="text-red-600">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="미팅 내용 입력"
                rows={6}
                required
              />
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
