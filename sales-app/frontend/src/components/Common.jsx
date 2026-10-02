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
        <h1 className="text-xl font-semibold text-text">{title}</h1>
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

export function Table({ headers, children }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-white">
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
