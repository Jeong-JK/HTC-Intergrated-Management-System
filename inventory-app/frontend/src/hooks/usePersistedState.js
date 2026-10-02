import { useState, useEffect } from 'react'

/**
 * localStorage에 자동 저장되는 state
 * @param {string} key - localStorage 키
 * @param {any} defaultValue - 기본값
 * @returns {[any, Function]} - [value, setValue]
 */
export function usePersistedState(key, defaultValue) {
  const storageKey = `persisted_${key}`

  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved !== null ? JSON.parse(saved) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (error) {
      console.warn('localStorage 저장 실패:', error)
    }
  }, [storageKey, value])

  return [value, setValue]
}
