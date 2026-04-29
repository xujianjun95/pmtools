import { NavLink } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import styles from './Header.module.css'

function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <NavLink to="/" className={styles.logo}>
          Pmtools
        </NavLink>
        <nav className={styles.nav}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            项目
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            关于
          </NavLink>
        </nav>
      </div>
      <ThemeToggle />
    </header>
  )
}

export default Header
