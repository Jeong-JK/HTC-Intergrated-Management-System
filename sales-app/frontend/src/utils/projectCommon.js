// 상태 옵션
export const STATUS_OPTIONS = ['진행중', '완료', '납기체크', '수금필요']

// 프로젝트 번호별 색상 할당 (위클리와 동일)
export const PROJECT_COLORS = [
  '#93c5fd', // blue-300
  '#86efac', // green-300
  '#fcd34d', // yellow-300
  '#f9a8d4', // pink-300
  '#c4b5fd', // purple-300
  '#fdba74', // orange-300
  '#67e8f9', // cyan-300
  '#fca5a5', // red-300
  '#d8b4fe', // violet-300
  '#a7f3d0', // emerald-300
]

// 날짜 파싱 함수 (다양한 형식 지원 - 복사/붙여넣기용)
export const parseDate = (input) => {
  if (!input) return ''
  const str = String(input).trim()

  // 이미 YYYY-MM-DD 형식이면 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // YY.MM.DD 또는 YY-MM-DD 형식
  let match = str.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
  if (match) {
    const year = parseInt(match[1]) < 50 ? '20' + match[1] : '19' + match[1]
    return `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }

  // YYYY.MM.DD 또는 YYYY/MM/DD 형식
  match = str.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }

  // YYYYMMDD 형식 (8자리 숫자)
  match = str.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }

  // YYMMDD 형식 (6자리 숫자)
  match = str.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (match) {
    const year = parseInt(match[1]) < 50 ? '20' + match[1] : '19' + match[1]
    return `${year}-${match[2]}-${match[3]}`
  }

  return str // 파싱 실패시 원본 반환
}

// 공급사 옵션
export const SUPPLIER_OPTIONS = ['Silvus', 'SWA', '한림', 'Octane', '퓨리원', '국제전파', 'Bren-Tronics']

// 입고여부 옵션
export const RECEIVED_STATUS_OPTIONS = ['미입고', '입고완료', '부분입고']
