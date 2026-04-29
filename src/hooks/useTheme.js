import { useEffect, useMemo, useState } from 'react'

const THEME_KEY = 'theme'

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  return saved || getSystemTheme()
}

function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)
  const isDark = useMemo(() => theme === 'dark', [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (event) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(event.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  const toggleTheme = () => {
    setTheme((current) => {
      const nextTheme = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, nextTheme)
      return nextTheme
    })
  }

  return { theme, isDark, toggleTheme }
}

export default useTheme
