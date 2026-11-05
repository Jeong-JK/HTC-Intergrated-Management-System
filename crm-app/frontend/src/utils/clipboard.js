// 클립보드 복사 유틸리티 함수 (fallback 포함)
export const copyToClipboard = async (text, label = '내용') => {
  try {
    // 최신 Clipboard API 사용
    await navigator.clipboard.writeText(text)
    alert(`${label}이(가) 복사되었습니다.`)
  } catch (err) {
    // fallback: execCommand 사용
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (successful) {
        alert(`${label}이(가) 복사되었습니다.`)
      } else {
        alert('복사에 실패했습니다.')
      }
    } catch (fallbackErr) {
      console.error('복사 실패:', fallbackErr)
      alert('복사에 실패했습니다. 브라우저가 지원하지 않습니다.')
    }
  }
}
