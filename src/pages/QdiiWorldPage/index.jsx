import { Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import qdiiStyles from '../QdiiMonitor/QdiiMonitor.module.css'

// 世界地图 chunk 懒加载：只在进入本页时下载
const WorldView = lazy(() => import('../QdiiMonitor/components/WorldView'))

export default function QdiiWorldPage() {
  // 支持 /qdii/world?country=<id> 直达某地区（hero 地图圆点跳入）
  const [searchParams] = useSearchParams()
  const country = searchParams.get('country')

  return (
    <div className={qdiiStyles.page}>
      <Suspense fallback={null}>
        <WorldView initialSelectedId={country || 'all'} />
      </Suspense>
    </div>
  )
}
