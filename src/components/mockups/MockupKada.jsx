import styles from './Mockups.module.css'
import kadaCover from '../../assets/mockups/kada-cover@2x.jpg'

function MockupKada() {
  return (
    <div className={styles.mockKada}>
      <img className={styles.mockupImage} src={kadaCover} alt="咔哒封面预览" />
    </div>
  )
}

export default MockupKada
