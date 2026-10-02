import { useState } from 'react'
import dayjs from 'dayjs'
import { Printer, X } from 'lucide-react'
import logoImg from '../assets/111222.png'

export default function EditableRentalReceipt({ data, onClose }) {
  const [editableData, setEditableData] = useState({
    borrower: data.borrower || '',
    contact_name: data.contact_name || '',
    contact_position: data.contact_position || '',
    contact_phone: data.contact_phone || '',
    rent_date: data.rent_date || '',
    expected_return: data.expected_return || '미정',
    purpose: data.purpose || '',
    items: data.items.map(item => ({
      item_name: item.item_name || '',
      description: item.description || '',
      serial_ip: item.serial_ip || '',
      quantity: item.quantity || 1,
      note: item.note || ''
    }))
  })

  const today = dayjs().format('YYYY. M. D')

  const handlePrint = () => {
    // 인쇄 시 페이지 제목 임시 제거
    const originalTitle = document.title
    document.title = ''

    // body에 인쇄 모드 클래스 추가
    document.body.classList.add('printing-receipt')

    window.print()

    // 인쇄 후 원래 상태 복원
    setTimeout(() => {
      document.title = originalTitle
      document.body.classList.remove('printing-receipt')
    }, 100)
  }

  const updateField = (field, value) => {
    setEditableData(prev => ({ ...prev, [field]: value }))
  }

  const updateItem = (index, field, value) => {
    setEditableData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }

  const inputStyle = "w-full bg-transparent border-b border-dotted border-slate-300 focus:border-blue-500 focus:outline-none px-1"

  return (
    <div className="print-container" style={{position: 'fixed', inset: 0, background: 'white', zIndex: 9999, overflow: 'auto'}}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          /* 인쇄 모드일 때 모든 요소 숨기기 */
          body.printing-receipt * {
            visibility: hidden !important;
          }

          /* print-container와 자식들만 보이기 */
          body.printing-receipt .print-container,
          body.printing-receipt .print-container * {
            visibility: visible !important;
          }

          body.printing-receipt {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* print-container 위치 설정 */
          body.printing-receipt .print-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            overflow: visible !important;
            height: auto !important;
          }

          .receipt-container {
            overflow: visible !important;
            height: auto !important;
          }

          /* 테이블 페이지 넘김 허용 */
          .receipt-table {
            page-break-inside: auto !important;
          }

          .receipt-table thead {
            display: table-header-group !important;
          }

          .receipt-table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          .no-print {
            display: none !important;
          }

          input, textarea {
            border: none !important;
            background: transparent !important;
          }
        }

        .receipt-container {
          max-width: 190mm;
          width: 100%;
          margin: 0 auto;
          padding: 10mm 0;
          background: white;
          font-family: 'Malgun Gothic', sans-serif;
          box-sizing: border-box;
        }

        @media print {
          .receipt-container {
            page-break-after: auto;
          }
        }

        .receipt-header {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid #333;
        }

        .receipt-logo {
          height: 40px;
          width: auto;
          object-fit: contain;
          margin-right: 20px;
        }

        .receipt-title {
          font-size: 28px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0 15px 0;
          letter-spacing: 8px;
        }

        .receipt-info {
          margin-bottom: 15px;
          line-height: 1.6;
        }

        .receipt-info-row {
          display: flex;
          margin-bottom: 5px;
        }

        .receipt-info-label {
          font-weight: bold;
          width: 130px;
          font-size: 12px;
        }

        .receipt-info-value {
          flex: 1;
          font-size: 12px;
        }

        .receipt-notice {
          margin: 15px 0;
          padding: 10px;
          background: #f5f5f5;
          font-size: 11px;
          line-height: 1.6;
          text-align: center;
        }

        .receipt-date {
          text-align: center;
          font-size: 14px;
          font-weight: bold;
          margin: 15px 0;
        }

        .receipt-signature {
          display: flex;
          justify-content: flex-end;
          margin: 15px 0;
        }

        .signature-box {
          border: 1px solid #333;
          width: 220px;
        }

        .signature-row {
          display: flex;
          border-bottom: 1px solid #333;
        }

        .signature-row:last-child {
          border-bottom: none;
        }

        .signature-cell {
          padding: 12px;
          text-align: center;
        }

        .signature-header {
          width: 50%;
          background: #f5f5f5;
          font-weight: bold;
          border-right: 1px solid #333;
          padding: 5px;
          font-size: 11px;
        }

        .signature-value {
          width: 50%;
          height: 50px;
          vertical-align: middle;
          font-size: 11px;
        }

        .signature-value-left {
          border-right: 1px solid #333;
        }

        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }

        .receipt-table thead {
          display: table-header-group;
        }

        .receipt-table tbody {
          display: table-row-group;
        }

        .receipt-table tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }

        .receipt-table th {
          background: #f5f5f5;
          border: 1px solid #333;
          padding: 6px 4px;
          font-size: 11px;
          font-weight: bold;
        }

        .receipt-table td {
          border: 1px solid #333;
          padding: 5px 4px;
          font-size: 10px;
          text-align: center;
        }

        .receipt-table input {
          text-align: center;
        }

        .receipt-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          line-height: 1.6;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }

        .action-buttons {
          position: fixed;
          top: 20px;
          right: 20px;
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn-print {
          background: #2563eb;
          color: white;
        }

        .btn-print:hover {
          background: #1d4ed8;
        }

        .btn-close {
          background: #dc2626;
          color: white;
        }

        .btn-close:hover {
          background: #b91c1c;
        }

        /* 피드백 양식 스타일 */
        .feedback-page {
          page-break-before: always;
          padding-top: 10mm;
        }

        .feedback-title {
          font-size: 28px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
        }

        .feedback-notice {
          text-align: center;
          color: #c00000;
          font-size: 12px;
          margin-bottom: 20px;
          line-height: 1.6;
        }

        .feedback-section {
          margin-bottom: 15px;
        }

        .feedback-row {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .feedback-label {
          font-weight: bold;
          width: 140px;
          flex-shrink: 0;
        }

        .feedback-value {
          flex: 1;
          color: #595959;
        }

        .feedback-underline {
          border-bottom: 1px solid #333;
          min-width: 100px;
          display: inline-block;
          margin: 0 5px;
        }

        .scenario-header {
          background: #d9d9d9;
          padding: 10px;
          font-weight: bold;
          font-size: 14px;
          text-align: center;
          margin: 20px 0 15px 0;
        }

        .feedback-textarea {
          border: 1px solid #999;
          min-height: 120px;
          width: 100%;
          margin-top: 5px;
        }

        .feedback-textarea-header {
          display: flex;
        }

        .feedback-textarea-label {
          background: #f2f2f2;
          border: 1px solid #999;
          border-right: none;
          padding: 10px;
          font-weight: bold;
          font-size: 13px;
          width: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .feedback-textarea-content {
          border: 1px solid #999;
          flex: 1;
          min-height: 120px;
          padding: 10px;
          font-size: 11px;
          font-style: italic;
          color: #808080;
          text-align: right;
        }

        .feedback-footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
        }

        .feedback-footer-email {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 10px;
        }

        .feedback-footer-notice {
          color: #666;
          font-size: 11px;
        }
      `}</style>

      <div className="action-buttons no-print">
        <button onClick={handlePrint} className="btn btn-print">
          <Printer size={16}/> 출력
        </button>
        <button onClick={onClose} className="btn btn-close">
          <X size={16}/> 닫기
        </button>
      </div>

      <div className="receipt-container receipt-print-area">
        <div className="receipt-header">
          <img src={logoImg} alt="Puritech Logo" className="receipt-logo" />
        </div>

        <div className="receipt-title">제 품 대 여 증</div>

        <div className="receipt-info">
          <div className="receipt-info-row">
            <div className="receipt-info-label">1. 대여 업체</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={editableData.borrower}
                onChange={e => updateField('borrower', e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-label">2. 담당자 / 연락처</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={`${editableData.contact_name}${editableData.contact_position ? ' ' + editableData.contact_position : ''} / ${editableData.contact_phone}`}
                onChange={e => {
                  const parts = e.target.value.split(' / ')
                  const contactPart = parts[0] || ''
                  const phonePart = parts[1] || ''

                  // 이름과 직급 분리 (마지막 공백 기준)
                  const lastSpaceIndex = contactPart.lastIndexOf(' ')
                  if (lastSpaceIndex > 0) {
                    updateField('contact_name', contactPart.substring(0, lastSpaceIndex))
                    updateField('contact_position', contactPart.substring(lastSpaceIndex + 1))
                  } else {
                    updateField('contact_name', contactPart)
                    updateField('contact_position', '')
                  }
                  updateField('contact_phone', phonePart)
                }}
                className={inputStyle}
              />
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-label">3. 대여일</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={editableData.rent_date}
                onChange={e => updateField('rent_date', e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-label">4. 반납일</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={editableData.expected_return}
                onChange={e => updateField('expected_return', e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-label">5. 대여 사유</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={editableData.purpose}
                onChange={e => updateField('purpose', e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        <div className="receipt-notice">
          대여 업체는 합의된 대여 기간 종료 즉시 본 장비를 원상태로 반납할 의무가 있으며,<br/>
          반납 지연·미반납·분실 또는 훼손으로 인하여 발생하는 모든 손해 및 비용은 전적으로 대여 업체가 부담합니다.
        </div>

        <div className="receipt-date">{today}</div>

        <div className="receipt-signature">
          <table className="signature-box">
            <tbody>
              <tr className="signature-row">
                <td className="signature-cell signature-header">대여 담당자</td>
                <td className="signature-cell signature-header">업체 담당자</td>
              </tr>
              <tr className="signature-row">
                <td className="signature-cell signature-value signature-value-left" style={{height: '50px'}}>
                  정재근 사원
                </td>
                <td className="signature-cell signature-value" style={{height: '50px'}}>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="receipt-table">
          <thead>
            <tr>
              <th style={{width: '24px'}}>No</th>
              <th style={{width: '120px'}}>품명</th>
              <th style={{width: '294px'}}>규격</th>
              <th style={{width: '100px'}}>Serial / IP</th>
              <th style={{width: '28px'}}>수량</th>
              <th style={{width: '100px'}}>비고</th>
            </tr>
          </thead>
          <tbody>
            {editableData.items.map((item, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>
                  <input
                    type="text"
                    value={item.item_name}
                    onChange={e => updateItem(idx, 'item_name', e.target.value)}
                    className={inputStyle}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    className={inputStyle}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.serial_ip}
                    onChange={e => updateItem(idx, 'serial_ip', e.target.value)}
                    className={inputStyle}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    className={inputStyle}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.note}
                    onChange={e => updateItem(idx, 'note', e.target.value)}
                    className={inputStyle}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-footer">
          서울특별시 구로구 경인로53길 90, STX-W타워 1301호, 한림퓨리텍 (주) 서울사무실<br/>
          #1301, STX-W Tower, 90, Gyeongin-ro 53-gil, Guro-gu, Seoul, Republic of Korea
        </div>

        {/* 장비 테스트 피드백 양식 - 2페이지 */}
        <div className="feedback-page">
          <div className="feedback-title">장비 테스트 피드백 양식</div>

          <div className="feedback-notice">
            *본 양식은 테스트 결과 및 사용 의견을 바탕으로 더욱 완성도 높은 맞춤형 솔루션을 제안해 드리기 위해 작성되었습니다.<br/>
            해당하는 항목에 <strong>O 표시</strong> 또는 내용을 <strong>기재</strong>하신 후, 장비 반납 시 함께 회신해주시기 바랍니다.
          </div>

          <div className="feedback-section">
            <div className="feedback-row">
              <div className="feedback-label">업체명 / 담당자</div>
              <div className="feedback-value">
                <span className="feedback-underline" style={{width: '180px'}}></span> /
                <span className="feedback-underline" style={{width: '120px'}}></span>
                (연락처 : <span className="feedback-underline" style={{width: '150px'}}></span>)
              </div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">대여 장비</div>
              <div className="feedback-value">SC44 &nbsp; / &nbsp; SC42 &nbsp; / &nbsp; SL52 &nbsp; / &nbsp; SM52</div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">운용 안테나</div>
              <div className="feedback-value">
                종류 : <span className="feedback-underline" style={{width: '80px'}}></span>
                &nbsp;&nbsp;이득(Gain) : <span className="feedback-underline" style={{width: '40px'}}></span> dBi
                &nbsp;&nbsp;<span style={{color: '#666'}}>지향성 / 무지향성</span>
              </div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">대여 기간</div>
              <div className="feedback-value">
                2026 . <span className="feedback-underline" style={{width: '30px'}}></span> . <span className="feedback-underline" style={{width: '30px'}}></span>
                &nbsp; ~ &nbsp;
                2026 . <span className="feedback-underline" style={{width: '30px'}}></span> . <span className="feedback-underline" style={{width: '30px'}}></span>
              </div>
            </div>
          </div>

          <div className="scenario-header">
            운용 시나리오 : <span className="feedback-underline" style={{width: '300px', borderColor: '#666'}}></span>
          </div>

          <div className="feedback-section">
            <div className="feedback-row">
              <div className="feedback-label">테스트 환경</div>
              <div className="feedback-value">
                위치 / 지형 : <span className="feedback-underline" style={{width: '200px'}}></span>
              </div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label"></div>
              <div className="feedback-value">
                운용거리 : 약 <span className="feedback-underline" style={{width: '50px'}}></span> m
                &nbsp;&nbsp;&nbsp;고도 : 약 <span className="feedback-underline" style={{width: '50px'}}></span> m
                &nbsp;&nbsp;&nbsp;장애물 여부 : <span style={{color: '#666'}}>유 / 무</span>
              </div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">운용 주파수 / 밴드폭</div>
              <div className="feedback-value">
                <span className="feedback-underline" style={{width: '120px'}}></span> MHz / <span className="feedback-underline" style={{width: '50px'}}></span> MHz
              </div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">통신 연결 상태</div>
              <div className="feedback-value" style={{color: '#666'}}>양호 &nbsp; / &nbsp; 보통 &nbsp; / &nbsp; 불량</div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">전송 데이터량 / 속도</div>
              <div className="feedback-value">
                <span className="feedback-underline" style={{width: '50px'}}></span> MB / <span className="feedback-underline" style={{width: '50px'}}></span> Mbps
              </div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">신호 품질 (평균)</div>
              <div className="feedback-value">
                RSSI : <span className="feedback-underline" style={{width: '50px'}}></span> / SNR : <span className="feedback-underline" style={{width: '50px'}}></span>
              </div>
            </div>
          </div>

          <div className="feedback-textarea-header">
            <div className="feedback-textarea-label">테스트 내용</div>
            <div className="feedback-textarea-content">
              *공유 가능한 테스트 사진은 이메일로 별도 첨부해 주시기 바랍니다.
            </div>
          </div>

          <div className="feedback-section" style={{marginTop: '15px'}}>
            <div className="feedback-row">
              <div className="feedback-label">종합 만족도</div>
              <div className="feedback-value" style={{color: '#666'}}>매우 만족 &nbsp; / &nbsp; 만족 &nbsp; / &nbsp; 보통 &nbsp; / &nbsp; 미흡 &nbsp; / &nbsp; 매우 미흡</div>
            </div>
            <div className="feedback-row">
              <div className="feedback-label">향후 프로젝트 적용 가능성</div>
              <div className="feedback-value" style={{color: '#666'}}>높음 &nbsp; / &nbsp; 검토 중 &nbsp; / &nbsp; 낮음 &nbsp; / &nbsp; 없음</div>
            </div>
          </div>

          <div className="feedback-textarea-header">
            <div className="feedback-textarea-label">운용 중<br/>불편 사항</div>
            <div className="feedback-textarea-content" style={{minHeight: '100px'}}></div>
          </div>

          <div className="feedback-footer">
            <div className="feedback-footer-email">회신처 : jkjeong@hlpuritech.com</div>
            <div className="feedback-footer-notice">
              본 양식은 귀사 맞춤형 솔루션 제안 목적으로만 활용되며,<br/>
              작성해 주신 모든 정보는 NDA에 따라 보호되어 외부로 유출되지 않습니다.
            </div>
            <div style={{marginTop: '20px', display: 'flex', justifyContent: 'center'}}>
              <img src={logoImg} alt="Logo" style={{height: '40px', width: 'auto'}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

