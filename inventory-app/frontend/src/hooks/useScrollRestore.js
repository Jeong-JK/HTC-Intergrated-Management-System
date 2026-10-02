import { useEffect, useRef } from 'react'

/**
 * 페이지 스크롤 위치를 자동으로 저장하고 복원하는 Hook
 * main 컨테이너의 스크롤을 감지합니다 (window가 아닌 main 요소)
 * @param {string} key - sessionStorage에 저장할 고유 키
 * @param {Array} deps - 스크롤 위치를 복원할 의존성 배열 (데이터 로딩 완료 시점)
 */
export function useScrollRestore(key, deps = []) {
  const scrollKey = `scroll_${key}`
  const restoreTimeoutRef = useRef(null)
  const hasRestoredRef = useRef(false) // 복원 여부 추적

  // 스크롤 컨테이너 찾기 (main 태그)
  const getScrollContainer = () => {
    return document.querySelector('main')
  }

  // 스크롤 위치 복원 - 초기 로드 시 한 번만
  useEffect(() => {
    // 이미 복원했으면 스킵
    if (hasRestoredRef.current) return

    // 데이터가 유효한지 확인
    const hasData = deps.every(dep => {
      if (Array.isArray(dep)) return dep.length >= 0 // 배열은 빈 배열도 OK
      return dep !== null && dep !== undefined
    })

    if (!hasData) return

    const savedPosition = sessionStorage.getItem(scrollKey)
    if (savedPosition) {
      // 이전 타이머 취소
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current)
      }

      // DOM 렌더링 완료 후 스크롤 복원
      restoreTimeoutRef.current = setTimeout(() => {
        const container = getScrollContainer()
        if (container) {
          container.scrollTop = parseInt(savedPosition, 10)
          hasRestoredRef.current = true // 복원 완료 표시
        }
      }, 100)
    } else {
      hasRestoredRef.current = true // 저장된 위치 없으면 복원 완료로 간주
    }

    return () => {
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current)
      }
    }
  }, deps)

  // 스크롤 위치 저장 - 스크롤할 때마다
  useEffect(() => {
    const container = getScrollContainer()
    if (!container) return

    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          sessionStorage.setItem(scrollKey, container.scrollTop.toString())
          ticking = false
        })
        ticking = true
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [scrollKey])
}
