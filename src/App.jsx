import { Navigate, Route, Routes } from 'react-router-dom'
import CustomCursor from './components/common/CustomCursor'
import MainLayout from './components/layout/MainLayout'
import HomePage from './pages/Home/index.jsx'
import ProfilePage from './pages/Profile/index.jsx'
import ProjectDetailPage from './pages/ProjectDetail/index.jsx'
import ResumePage from './pages/Resume/index.jsx'
import ArticlesPage from './pages/Articles/index.jsx'
import QdiiMonitorPage from './pages/QdiiMonitor/index.jsx'

function App() {
  return (
    <>
      <CustomCursor />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<ProfilePage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/qdii" element={<QdiiMonitorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
