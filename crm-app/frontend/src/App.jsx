import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CRMApp from './apps/CRMApp.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<CRMApp/>}/>
      </Routes>
    </BrowserRouter>
  )
}
