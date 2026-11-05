// 월간 캘린더 공용: 제목 직접 입력 + 끝까지 스크롤 후 휠로 달 넘기기 (업무일지/대여캘린더)
import { useState, useEffect, useRef } from 'react'
import dayjs from 'dayjs'

// 제목 클릭 → 직접 입력 (type: month | date)
export function TitleInput({ type, value, label, onChange, className, hoverClass = 'hover:text-orange-600' }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        type={type}
        autoFocus
        defaultValue={value}
        onChange={e => {
          const v = e.target.value
          const d = dayjs(type === 'month' ? `${v}-01` : v)
          if (v && d.isValid()) onChange(d)
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={e => (e.key === 'Enter' || e.key === 'Escape') && setEditing(false)}
        className="border border-slate-300 rounded-lg px-2 py-1 text-base font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    )
  }
  return (
    <h2 onClick={() => setEditing(true)} title="클릭해서 직접 입력" className={`${className} cursor-pointer ${hoverClass}`}>
      {label}
    </h2>
  )
}

const WHEEL_STEP = 300 // 끝에서 이만큼 더 굴리면 한 달 넘어감 (마우스 휠 약 3칸)

function scrollParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return document.scrollingElement
}

// 평소엔 그냥 스크롤. 맨 아래(위)에서 더 굴리면 서서히 당겨지다가 기준을 넘으면 다음(이전) 달로 휙.
// boxRef: 휠을 받을 영역, animRef: 넘어갈 때 미끄러지는 요소, onStep(+1|-1)
export function useMonthWheel(boxRef, animRef, onStep) {
  const [drag, setDrag] = useState(0)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    let acc = 0
    let resetTimer
    let lockedUntil = 0
    const reset = () => { acc = 0; setDrag(0) }
    const onWheel = (e) => {
      if (!e.deltaY) return
      const sc = scrollParent(el)
      const down = e.deltaY > 0
      const atEdge = down ? sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2 : sc.scrollTop <= 0
      if (!atEdge) { if (acc) reset(); return } // 아직 끝이 아니면 평소 스크롤
      e.preventDefault()
      if (Date.now() < lockedUntil) return // 넘어간 직후 관성 스크롤 무시
      if (acc && (acc > 0) !== down) acc = 0 // 방향 바뀌면 처음부터
      acc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY // 줄 단위 휠(파이어폭스) 보정
      clearTimeout(resetTimer)
      if (Math.abs(acc) >= WHEEL_STEP) {
        const dir = acc > 0 ? 1 : -1
        reset()
        lockedUntil = Date.now() + 450
        stepRef.current(dir)
        sc.scrollTop = dir > 0 ? 0 : sc.scrollHeight // 다음 달은 위부터, 이전 달은 아래부터
        animRef.current?.animate(
          [{ transform: `translateY(${dir * 60}px)`, opacity: 0.3 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 250, easing: 'ease-out' }
        )
      } else {
        setDrag(acc)
        resetTimer = setTimeout(reset, 250) // 덜 굴리고 멈추면 제자리로
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel); clearTimeout(resetTimer) }
  }, [boxRef, animRef])
  return drag
}

// 당기는 동안의 밀림/흐려짐
export const dragStyle = (drag) => ({
  transform: `translateY(${-drag * 0.15}px)`,
  opacity: 1 - Math.min(Math.abs(drag) / WHEEL_STEP, 1) * 0.35,
  transition: drag ? 'none' : 'transform 200ms, opacity 200ms',
})
