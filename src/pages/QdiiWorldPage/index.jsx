import { Suspense, lazy } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import qdiiStyles from '../QdiiMonitor/QdiiMonitor.module.css'
import styles from '../QdiiMonitor/components/WorldView.module.css'

// 列表按需加载，页面标题和加载占位先显示。
const WorldView = lazy(() => import('../QdiiMonitor/components/WorldView'))

function WorldListLoading() {
  return (
    <div className={styles.loading} role="status" aria-label="正在加载其他市场基金列表">
      <div className={styles.loadingFilters} aria-hidden="true">
        {Array.from({ length: 11 }, (_, index) => <span key={index} />)}
      </div>
      <div className={styles.loadingFilters} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
        <span className={styles.loadingSearch} />
      </div>
      <div className={styles.loadingCard} aria-hidden="true">
        {Array.from({ length: 6 }, (_, row) => (
          <div className={styles.loadingRow} key={row}>
            {Array.from({ length: 5 }, (_, column) => <span key={column} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function QdiiWorldPage() {
  // 支持 /qdii/world?country=<id> 直达某地区（hero 地图圆点跳入）
  const [searchParams] = useSearchParams()
  const country = searchParams.get('country')

  return (
    <div className={qdiiStyles.page}>
      <section className={styles.world}>
        <Link to="/qdii" className={styles.backLink}>
          ← 返回 QDII 监控
        </Link>
        <div className={styles.titleRow}>
          <h2 className="section-title">其他市场</h2>
        </div>
        <Suspense fallback={<WorldListLoading />}>
          <WorldView initialSelectedId={country || 'all'} />
        </Suspense>
      </section>
    </div>
  )
}
