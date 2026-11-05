import { useNavigate, Routes, Route } from 'react-router-dom'
import MainView from '../components/crm/MainView'

export default function CRMApp() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<MainView navigate={navigate} />} />
    </Routes>
  )
}
