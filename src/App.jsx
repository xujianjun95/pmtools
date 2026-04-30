import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import HomePage from './pages/Home/index.jsx'
import ProfilePage from './pages/Profile/index.jsx'
import ProjectDetailPage from './pages/ProjectDetail/index.jsx'
import ResumePage from './pages/Resume/index.jsx'
import HeGotMarriedPage from './pages/HeGotMarried/index.jsx'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/resume" element={<ResumePage />} />
        <Route path="/hegotmarried" element={<HeGotMarriedPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
