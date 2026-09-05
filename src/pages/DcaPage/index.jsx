import { Link } from 'react-router-dom'
import DcaSimulator from '../QdiiMonitor/components/DcaSimulator/index.jsx'
import styles from './DcaPage.module.css'

export default function DcaPage() {
  return (
    <div className={styles.page}>
      <Link to="/qdii" className={styles.back}>
        ← 返回 QDII 申购监控
      </Link>
      <DcaSimulator />
    </div>
  )
}
