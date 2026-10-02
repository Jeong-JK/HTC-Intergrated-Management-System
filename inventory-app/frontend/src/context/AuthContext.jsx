import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { getMe, logout as apiLogout } from '../api.js'

const AuthContext = createContext(null)

// 1시간 (밀리초)
const IDLE_TIMEOUT = 60 * 60 * 1000
// 활동 감지 throttle (1초) - 성능 최적화
const ACTIVITY_THROTTLE = 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const timeoutRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const throttleRef = useRef(null)

  const logout = useCallback(async (silent = false) => {
    try {
      await apiLogout()
    } catch (e) {
      // Ignore logout errors
    }
    setUser(null)
    if (!silent) {
      // Clear timeout on manual logout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  // 실제 경과 시간 기반으로 로그아웃 여부 확인
  const checkAndResetTimer = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastActivityRef.current

    // 이미 타임아웃 지났으면 로그아웃
    if (elapsed >= IDLE_TIMEOUT) {
      alert('1시간 동안 활동이 없어 자동 로그아웃됩니다.')
      logout(true)
      return
    }

    // 남은 시간으로 타이머 재설정
    lastActivityRef.current = now

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      alert('1시간 동안 활동이 없어 자동 로그아웃됩니다.')
      logout(true)
    }, IDLE_TIMEOUT)
  }, [logout])

  const resetIdleTimer = useCallback(() => {
    if (!user) return

    // Throttle: 마지막 리셋 후 1초 이내면 무시
    const now = Date.now()
    if (throttleRef.current && now - throttleRef.current < ACTIVITY_THROTTLE) {
      return
    }
    throttleRef.current = now

    checkAndResetTimer()
  }, [user, checkAndResetTimer])

  // Track user activity
  useEffect(() => {
    if (!user) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    const handleActivity = () => {
      resetIdleTimer()
    }

    // 탭이 다시 활성화될 때 실제 경과 시간 확인
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        const elapsed = Date.now() - lastActivityRef.current
        if (elapsed >= IDLE_TIMEOUT) {
          alert('1시간 동안 활동이 없어 자동 로그아웃됩니다.')
          logout(true)
        } else {
          // 남은 시간으로 타이머 재설정
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          timeoutRef.current = setTimeout(() => {
            alert('1시간 동안 활동이 없어 자동 로그아웃됩니다.')
            logout(true)
          }, IDLE_TIMEOUT - elapsed)
        }
      }
    }

    // Start idle timer
    checkAndResetTimer()

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      // Cleanup
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [user, resetIdleTimer, checkAndResetTimer, logout])

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await getMe()
      setUser(res.data.user)
    } catch (e) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = (userData) => {
    setUser(userData)
    lastActivityRef.current = Date.now()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
