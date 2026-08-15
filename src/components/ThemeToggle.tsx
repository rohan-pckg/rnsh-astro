import { useCallback, useState } from "react"
import { sound } from "../lib/sound"

const STORAGE_KEY = "rnsh-theme"

function readTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light"
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(readTheme)

  const toggle = useCallback(() => {
    const next = readTheme() === "dark" ? "light" : "dark"

    document.documentElement.classList.add("theme-transition")
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage may be unavailable; the DOM attribute still applies.
    }
    setTheme(next)
    sound.play("toggle")
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition")
    }, 500)
  }, [])

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      suppressHydrationWarning
      onClick={toggle}
    >
      <span className="theme-dot" aria-hidden="true" />
    </button>
  )
}
