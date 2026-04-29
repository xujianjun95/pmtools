import styles from './TechTag.module.css'

function TechTag({ children, className = '' }) {
  return <span className={`${styles.tag} ${className}`.trim()}>{children}</span>
}

export default TechTag
