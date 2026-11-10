import { useEffect, useRef } from 'react'

export function StatusBadge({ status }) {
  return <span className={`badge-${status} text-xs px-2 py-0.5 rounded-md font-medium whitespace-nowrap`}>{status}</span>
}


export function GradeBadge({ grade }) {
  const cls = grade === '새제품'
    ? 'bg-blue-50 border border-blue-200 text-blue-700'
    : 'bg-amber-50 border border-amber-200 text-amber-700'
  return <span className={`${cls} text-xs px-2 py-0.5 rounded-md font-medium`}>{grade}</span>
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        {sub && <p className="text-dim text-sm mt-0.5">{sub}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}

export function Spinner() {
  return (
    <tr><td colSpan={99} className="text-center py-16 text-dim">
      <div className="inline-block w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mr-2"/>
      불러오는 중...
    </td></tr>
  )
}

export function Empty() {
  return <tr><td colSpan={99} className="text-center py-16 text-dim text-sm">데이터가 없습니다</td></tr>
}

// cards: 폰 폭에선 행마다 카드("항목명 · 값" 줄)로 표시 — 칸마다 헤더 이름을 data-label로 붙임 (index.css .tbl-cards)
export function Table({ headers, children, cards = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!cards || !ref.current) return
    for (const tr of ref.current.querySelectorAll('tbody tr')) {
      let col = 0 // colSpan을 고려한 실제 열 위치
      for (const td of tr.children) {
        const h = headers[col]
        td.dataset.label = td.colSpan > 1 || typeof h !== 'string' ? '' : h
        // 값 없는 칸(빈칸, 묶음 표시 └ 〃)은 카드에서 숨김 — 체크박스/버튼 있는 칸은 유지
        td.dataset.mhide = !td.querySelector('input,button,select') && ['', '-', '└', '〃'].includes(td.textContent.trim()) ? '1' : ''
        col += td.colSpan || 1
      }
    }
  })
  return (
    <div ref={ref} className={`rounded-xl border border-border overflow-hidden shadow-sm bg-white ${cards ? 'tbl-cards' : ''}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border">
              {headers.map((h,i) => (
                <th key={i} className="px-4 py-3 text-left text-xs text-dim font-semibold whitespace-nowrap uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export function Btn({ onClick, children, variant='default', disabled=false, className='', type='button' }) {
  const base = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    default: "border border-border text-dim bg-white hover:bg-slate-50 hover:text-text",
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    yellow:  "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
    red:     "bg-red-500 text-white hover:bg-red-600 shadow-sm",
    blue:    "bg-sky-500 text-white hover:bg-sky-600 shadow-sm",
    green:   "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function Modal({ title, sub, onClose, children, footer, size = 'md' }) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl'
  }
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col border border-slate-200`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-text">{title}</h2>
            {sub && <p className="text-xs text-dim mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="text-dim hover:text-text transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
        {footer && <div className="flex gap-2 px-6 py-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, full=false }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-xs font-medium text-dim block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export const inputCls = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-text placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"

export function fmt(n) {
  if (!n && n !== 0) return '-'
  return Number(n).toLocaleString()
}

// 비고 텍스트 렌더링: !텍스트! 형식을 빨간색으로 표시
export function NoteText({ text }) {
  if (!text) return '-'

  const parts = []
  let lastIndex = 0
  const regex = /!(.*?)!/g
  let match

  while ((match = regex.exec(text)) !== null) {
    // 느낌표 앞의 일반 텍스트
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    // 느낌표 안의 빨간 텍스트 (인라인 스타일 사용)
    parts.push(<span key={match.index} style={{ color: '#ef4444', fontWeight: 600 }}>{match[1]}</span>)
    lastIndex = regex.lastIndex
  }

  // 마지막 느낌표 이후의 일반 텍스트
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? <>{parts}</> : text
}
