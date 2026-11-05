import { Phone, Mail, Calendar, Clock } from 'lucide-react'
import { copyToClipboard } from '../../utils/clipboard'

export default function ContactDetailView({ contact, meetings, onAddMeeting, onEditContact, onDeleteContact, onEditMeeting, onDeleteMeeting, onUploadFile, onOpenDriveFolder, driveAuthorized }) {
  return (
    <div className="space-y-6">
      {/* Contact Info Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`text-xl font-bold mb-2 ${contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-900'}`}>
              {contact.name}
              {contact.status === 'resigned' && (
                <span className="ml-2 px-2 py-0.5 text-sm rounded" style={{ backgroundColor: '#6b7280', color: 'white' }}>퇴사</span>
              )}
            </h3>
            {contact.position && (
              <p className={contact.status === 'resigned' ? 'text-slate-400' : 'text-slate-600'}>{contact.position}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onEditContact}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm shadow-sm">
              수정
            </button>
            <button
              onClick={onDeleteContact}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm shadow-sm">
              삭제
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {contact.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone size={16} className="text-slate-500"/>
              <span className="text-slate-700">{contact.phone}</span>
              <button
                onClick={() => copyToClipboard(contact.phone, '전화번호')}
                className="px-2 py-1 bg-slate-100 rounded text-xs hover:bg-slate-200 text-slate-700 border border-slate-300">
                복사
              </button>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-slate-500"/>
              <span className="text-slate-700">{contact.email}</span>
              <button
                onClick={() => copyToClipboard(contact.email, '이메일')}
                className="px-2 py-1 bg-slate-100 rounded text-xs hover:bg-slate-200 text-slate-700 border border-slate-300">
                복사
              </button>
            </div>
          )}

          {/* 이직 이력 표시 */}
          {contact.transfer_history && contact.transfer_history.length > 0 && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-xs font-medium text-amber-800 mb-1">📋 이직 이력</div>
              <div className="space-y-1">
                {contact.transfer_history.map((h, idx) => (
                  <div key={h.id || idx} className="text-xs text-amber-700">
                    <span className="font-medium">{h.from_company_name}</span>
                    {h.from_team_name && <span className="text-amber-600"> ({h.from_team_name})</span>}
                    <span className="mx-1">→</span>
                    <span className="font-medium">{h.to_company_name}</span>
                    {h.to_team_name && <span className="text-amber-600"> ({h.to_team_name})</span>}
                    <span className="ml-1 text-amber-500">
                      ({new Date(h.transferred_at).toLocaleDateString('ko-KR')})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Google Drive Files Section */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            첨부파일
          </h4>
          <div className="flex gap-2">
            <button
              onClick={onUploadFile}
              disabled={!driveAuthorized}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
              파일 업로드
            </button>
            <button
              onClick={onOpenDriveFolder}
              disabled={!driveAuthorized}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
              드라이브 폴더 열기
            </button>
          </div>
          {!driveAuthorized && (
            <p className="text-xs text-slate-500 mt-2">
              Google Drive에 로그인하면 파일 업로드 및 관리가 가능합니다.
            </p>
          )}
        </div>
      </div>

      {/* Meetings Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar size={20} className="text-blue-600"/>
            미팅 내역 ({meetings.length})
          </h3>
          <button
            onClick={onAddMeeting}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm shadow-sm">
            + 미팅 추가
          </button>
        </div>

        <div className="space-y-3">
          {meetings.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center shadow-sm">
              <Calendar size={48} className="text-slate-300 mx-auto mb-4"/>
              <p className="text-slate-500">미팅 기록이 없습니다</p>
            </div>
          ) : (
            meetings.map(meeting => (
              <div key={meeting.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={14}/>
                    {new Date(meeting.meeting_date).toLocaleString('ko-KR')}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditMeeting(meeting)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 font-medium">
                      수정
                    </button>
                    <button
                      onClick={() => onDeleteMeeting(meeting)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-medium">
                      삭제
                    </button>
                  </div>
                </div>
                {meeting.attendees && (
                  <div className="text-sm text-slate-700 mb-2">
                    <span className="text-slate-500 font-medium">참석자:</span> {meeting.attendees}
                  </div>
                )}
                {meeting.content && (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200">
                    {meeting.content}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
