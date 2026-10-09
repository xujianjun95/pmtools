import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import HomePage from './pages/Home/index.jsx'
import ProfilePage from './pages/Profile/index.jsx'
import ProjectDetailPage from './pages/ProjectDetail/index.jsx'
import ResumePage from './pages/Resume/index.jsx'
import ArticlesPage from './pages/Articles/index.jsx'
import QdiiMonitorPage from './pages/QdiiMonitor/index.jsx'
import QdiiWorldPage from './pages/QdiiWorldPage/index.jsx'
import DcaPage from './pages/DcaPage/index.jsx'

// 后台独立懒加载 chunk：Vditor/ECharts 不进入主站首屏依赖（spec §7.5）
const BackgroundPage = lazy(() => import('./pages/Background/Background.jsx'))
const MarketDashboardPage = lazy(() => import('./pages/MarketDashboard/index.jsx'))
const FuturePage = lazy(() => import('./pages/FuturePage/index.jsx'))

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<ProfilePage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="/resume" element={<ResumePage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/qdii" element={<QdiiMonitorPage />} />
        <Route path="/qdii/dashboard" element={<Suspense fallback={<p role="status">正在加载全球行情…</p>}><MarketDashboardPage /></Suspense>} />
        <Route path="/qdii/world" element={<QdiiWorldPage />} />
        <Route path="/qdii/dca" element={<DcaPage />} />
        <Route path="/qdii/future" element={<Suspense fallback={<p role="status">正在加载未来推演…</p>}><FuturePage /></Suspense>} />
      </Route>
      <Route
        path="/background/*"
        element={
          <Suspense fallback={null}>
            <BackgroundPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
