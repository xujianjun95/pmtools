import { Link } from 'react-router-dom'
import FutureJourney from '../QdiiMonitor/components/DcaSimulator/FutureJourney'
import styles from '../DcaPage/DcaPage.module.css'

export default function FuturePage() {
  return (
    <div className={styles.page}>
      <Link to="/qdii" className={styles.back}>← 返回 QDII 申购监控</Link>
      <FutureJourney />
    </div>
  )
}
