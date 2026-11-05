import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import MainHub from './pages/MainHub.jsx'
import LoginPage from './pages/LoginPage.jsx'
import UserManagement from './pages/UserManagement.jsx'
import BoardPage from './pages/BoardPage.jsx'
import AdminDrive from './pages/AdminDrive.jsx'
import WorkLogPage from './pages/WorkLogPage.jsx'
import InventoryApp from './apps/InventoryApp.jsx'
import { SITE } from './site.js'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-slate-500 text-sm">로딩 중...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-slate-500 text-sm">로딩 중...</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      {/* inv/cal 서브도메인은 해당 화면만 루트에 */}
      {SITE === 'inventory' && <Route path="/*" element={<ProtectedRoute><InventoryApp /></ProtectedRoute>} />}
      {SITE === 'worklog' && <Route path="/*" element={<ProtectedRoute><WorkLogPage /></ProtectedRoute>} />}
      {SITE === 'hub' && <>
      <Route path="/" element={<ProtectedRoute><MainHub /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/admin-drive" element={<ProtectedRoute><AdminDrive /></ProtectedRoute>} />
      <Route path="/board" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
      <Route path="/work-log" element={<ProtectedRoute><WorkLogPage /></ProtectedRoute>} />
      <Route path="/inventory/*" element={<ProtectedRoute><InventoryApp /></ProtectedRoute>} />
      </>}
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
