import { Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import { countryById } from '../QdiiMonitor/worldFunds'
import qdiiStyles from '../QdiiMonitor/QdiiMonitor.module.css'

// 世界地图 chunk 懒加载：只在进入本页时下载
const WorldView = lazy(() => import('../QdiiMonitor/components/WorldView'))

// /qdii/world?country=392：从 Hero 小地图点进来时保持选中连贯
export default function QdiiWorldPage() {
  const [params] = useSearchParams()
  const q = params.get('country')
  const initial = q === 'all' || countryById(q) ? q : 'all'

  return (
    <div className={qdiiStyles.page}>
      <Suspense fallback={null}>
        <WorldView key={initial} initialSelectedId={initial} />
      </Suspense>
    </div>
  )
}
