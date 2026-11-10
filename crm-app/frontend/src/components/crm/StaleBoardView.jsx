import { Activity, AlertTriangle } from 'lucide-react'

export default function StaleBoardView({ staleBoard, navigateToContact, onOpenPopup }) {
  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-800">
            {"30일<노랑, 60일<주황, 90일<빨강"}
          </h3>
          <button
            onClick={onOpenPopup}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-base font-semibold shadow-md"
          >
            <Activity size={20}/>
            상세 현황
          </button>
        </div>
        <p className="text-slate-600 text-sm">
          장기간 미팅이 없는 담당자들입니다. <strong>더블클릭</strong>하여 상세 정보를 확인하세요.
        </p>
      </div>

      {staleBoard.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-300 p-12 text-center">
          <AlertTriangle size={48} className="text-slate-400 mx-auto mb-4"/>
          <p className="text-slate-600">모든 담당자가 관리되고 있습니다!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-300 overflow-x-auto shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  업체명
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  담당자
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  마지막 미팅
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  경과일
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staleBoard.map(contact => {
                // inline style 사용 (Tailwind 색상 문제 해결)
                let bgColor = '#ffffff'
                let textColor = '#374151'

                if (contact.status === 'critical') {
                  bgColor = '#fca5a5'  // red-300
                  textColor = '#7f1d1d'  // red-900
                } else if (contact.status === 'warning') {
                  bgColor = '#fdba74'  // orange-300
                  textColor = '#7c2d12'  // orange-900
                } else if (contact.status === 'caution') {
                  bgColor = '#fde047'  // yellow-300
                  textColor = '#713f12'  // yellow-900
                }

                return (
                  <tr
                    key={contact.contact_id}
                    onDoubleClick={() => navigateToContact(contact.company_id, contact.team_id, contact.contact_id)}
                    style={{ backgroundColor: bgColor }}
                    className="hover:opacity-80 cursor-pointer transition-all">
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: textColor }}>
                      {contact.company_name}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: textColor }}>
                      {contact.contact_name}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: textColor }}>
                      {contact.last_meeting_date
                        ? new Date(contact.last_meeting_date).toLocaleDateString('ko-KR')
                        : '없음'}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: textColor }}>
                      {contact.days_since_meeting ? `${contact.days_since_meeting}일` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-3 py-1 text-xs font-bold" style={{ color: textColor }}>
                        {contact.status_text}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
