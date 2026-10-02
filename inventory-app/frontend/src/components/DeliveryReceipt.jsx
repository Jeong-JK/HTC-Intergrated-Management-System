import { useEffect } from 'react'
import dayjs from 'dayjs'
import logoImg from '../assets/111222.png'

export default function DeliveryReceipt({ data, onClose }) {
  useEffect(() => {
    // 인쇄 시 페이지 제목 임시 제거
    const originalTitle = document.title
    document.title = ''

    // body에 인쇄 모드 클래스 추가
    document.body.classList.add('printing-receipt')

    // 창이 로드되면 자동으로 인쇄 다이얼로그 열기
    const timer = setTimeout(() => {
      window.print()
      // 인쇄 후 원래 상태 복원
      setTimeout(() => {
        document.title = originalTitle
        document.body.classList.remove('printing-receipt')
      }, 100)
    }, 500)

    return () => {
      clearTimeout(timer)
      document.title = originalTitle
      document.body.classList.remove('printing-receipt')
    }
  }, [])

  const today = dayjs().format('YYYY. M. D')

  return (
    <div className="receipt-container receipt-print-area">
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

          /* receipt-container와 자식들만 보이기 */
          body.printing-receipt .receipt-container,
          body.printing-receipt .receipt-container * {
            visibility: visible !important;
          }

          body.printing-receipt {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* receipt-container 위치 설정 */
          body.printing-receipt .receipt-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
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
        }

        .receipt-container {
          max-width: 190mm;
          width: 100%;
          min-height: 277mm;
          margin: 0 auto;
          padding: 10mm 0;
          background: white;
          font-family: 'Malgun Gothic', sans-serif;
          box-sizing: border-box;
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

        .receipt-instruction {
          text-align: center;
          font-size: 11px;
          margin: 15px 0;
          color: #666;
          line-height: 1.5;
        }

        .receipt-signature {
          display: flex;
          justify-content: flex-end;
          margin: 15px 0;
        }

        .signature-box {
          border: 1px solid #333;
          width: 300px;
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
        }

        .signature-value {
          width: 50%;
          height: 80px;
          vertical-align: middle;
        }

        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
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

        .receipt-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          line-height: 1.6;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }

        .close-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 10px 20px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .close-btn:hover {
          background: #b91c1c;
        }
      `}</style>

      <button onClick={onClose} className="close-btn no-print">닫기</button>

      <div className="receipt-header">
        <img src={logoImg} alt="Puritech Logo" className="receipt-logo" />
      </div>

      <div className="receipt-title">인 수 증</div>

      <div className="receipt-info">
        <div className="receipt-info-row">
          <div className="receipt-info-label">1. 납품일</div>
          <div className="receipt-info-value">{data.delivery_date}</div>
        </div>
        <div className="receipt-info-row">
          <div className="receipt-info-label">2. 업체명</div>
          <div className="receipt-info-value">{data.client}</div>
        </div>
        <div className="receipt-info-row">
          <div className="receipt-info-label">3. 담당자</div>
          <div className="receipt-info-value">{data.contact_name}</div>
        </div>
        <div className="receipt-info-row">
          <div className="receipt-info-label">4. 연락처</div>
          <div className="receipt-info-value">{data.contact_phone}</div>
        </div>
      </div>

      <div className="receipt-notice">
        인수자는 상기 물품에 대하여 검수를 완료하였으며, 수량 및 상태에 이상이 없음을 확인하고 인수합니다.
      </div>

      <div className="receipt-date">{today}</div>

      <div className="receipt-instruction">
        본 인수증에 서명 후, 아래 회신처로 회신을 요청드립니다.<br/>
        Fax) 02-6925-3529<br/>
        E-mail) jkjeong@hlpuritech.com
      </div>

      <div className="receipt-signature">
        <table className="signature-box">
          <tbody>
            <tr className="signature-row">
              <td className="signature-cell signature-header">인계 담당자</td>
              <td className="signature-cell signature-header">인수 담당자</td>
            </tr>
            <tr className="signature-row">
              <td className="signature-cell signature-value" style={{height: '60px'}}>
                정재근 사원
              </td>
              <td className="signature-cell signature-value" style={{height: '60px'}}>
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
          {data.items.map((item, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{item.item_name}</td>
              <td>{item.description}</td>
              <td>{item.serial_ip}</td>
              <td>{item.quantity}</td>
              <td>{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-footer">
        서울특별시 구로구 경인로53길 90, STX-W타워 1301호, 한림퓨리텍 (주) 서울사무실<br/>
        #1301, STX-W Tower, 90, Gyeongin-ro 53-gil, Guro-gu, Seoul, Republic of Korea
      </div>
    </div>
  )
}
