import styles from './Mockups.module.css'
import yessirCover from '../../assets/mockups/yessir-cover@2x.jpg'

function MockupYesSir() {
  return (
    <div className={styles.mockYessir}>
      <img className={styles.mockupImage} src={yessirCover} alt="YesSir 封面预览" />
    </div>
  )
}

export default MockupYesSir
