import styles from './Mockups.module.css'
import dangCover from '../../assets/mockups/dang-analysis-cover@2x.png'

function MockupDangAnalysis() {
  return (
    <div className={styles.mockDang}>
      <img className={styles.mockupImage} src={dangCover} alt="Dang Analysis 封面预览" />
    </div>
  )
}

export default MockupDangAnalysis
