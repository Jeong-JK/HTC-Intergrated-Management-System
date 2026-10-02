import { useState } from 'react'
import dayjs from 'dayjs'
import { Printer, X } from 'lucide-react'
import logoImg from '../assets/111222.png'

export default function EditableDeliveryReceipt({ data, onClose }) {
  const [editableData, setEditableData] = useState({
    client: data.client || '',
    contact_name: data.contact_name || '',
    contact_position: data.contact_position || '',
    contact_phone: data.contact_phone || '',
    delivery_date: data.delivery_date || '',
    expected_return: '',
    purpose: '',
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

        <div className="receipt-title">인 수 증</div>

        <div className="receipt-info">
          <div className="receipt-info-row">
            <div className="receipt-info-label">1. 납품일</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={editableData.delivery_date}
                onChange={e => updateField('delivery_date', e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-label">2. 업체명</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={editableData.client}
                onChange={e => updateField('client', e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-label">3. 담당자</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={`${editableData.contact_name}${editableData.contact_position ? ' ' + editableData.contact_position : ''}`}
                onChange={e => {
                  const contactPart = e.target.value || ''
                  // 이름과 직급 분리 (마지막 공백 기준)
                  const lastSpaceIndex = contactPart.lastIndexOf(' ')
                  if (lastSpaceIndex > 0) {
                    updateField('contact_name', contactPart.substring(0, lastSpaceIndex))
                    updateField('contact_position', contactPart.substring(lastSpaceIndex + 1))
                  } else {
                    updateField('contact_name', contactPart)
                    updateField('contact_position', '')
                  }
                }}
                className={inputStyle}
              />
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-label">4. 연락처</div>
            <div className="receipt-info-value">
              <input
                type="text"
                value={editableData.contact_phone}
                onChange={e => updateField('contact_phone', e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        <div className="receipt-notice">
          인수처는 본 장비를 정상적으로 인수하였으며,<br/>
          장비의 하자 및 누락 사항에 대해 확인하였음을 확인합니다.
        </div>

        <div className="receipt-date">{today}</div>

        <div className="receipt-signature">
          <table className="signature-box">
            <tbody>
              <tr className="signature-row">
                <td className="signature-cell signature-header">납품 담당자</td>
                <td className="signature-cell signature-header">인수 담당자</td>
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
      </div>
    </div>
  )
}
