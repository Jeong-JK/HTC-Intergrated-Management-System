import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SalesApp from './apps/SalesApp.jsx'
import BoardPage from './pages/BoardPage.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/board" element={<BoardPage/>}/>
          <Route path="/*" element={<SalesApp/>}/>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
