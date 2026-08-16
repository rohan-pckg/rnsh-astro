import NavMenuItem from "@/components/NavMenuItem"
import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { springs } from "@/lib/motion"
import { sound } from "@/lib/sound"
import { navigate } from "astro:transitions/client"

type NavItem = {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Thoughts", href: "/blogs" },
  { label: "Projects", href: "/projects" },
  { label: "Contact", href: "/contact" },
  { label: "Design", href: "/design" },
]

export type BreadcrumbSegment = {
  label: string
  href?: string
}

type Props = {
  segments?: BreadcrumbSegment[]
  className?: string
}

export default function NavigationMenu({ segments = [], className }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light"
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  })

  const toggleRef = useRef<HTMLButtonElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => {
      const next = !prev
      if (next) {
        sound.play("open")
      } else {
        sound.play("back")
      }
      return next
    })
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    sound.play("back")
  }, [])

  const toggleTheme = useCallback(() => {
    const current =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light"
    const next = current === "dark" ? "light" : "dark"

    document.documentElement.classList.add("theme-transition")
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem("rnsh-theme", next)
    } catch {}
    setTheme(next)
    sound.play("toggle")
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition")
    }, 500)
  }, [])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeMenu()
      }
    },
    [closeMenu]
  )

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add("nav-open")
    } else {
      document.body.classList.remove("nav-open")
    }
    return () => document.body.classList.remove("nav-open")
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMenu()
        return
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const links = document.querySelectorAll<HTMLElement>(
          ".nav-overlay .nav-menu-item"
        )
        if (!links || links.length === 0) return
        const active = document.activeElement
        const idx = Array.from(links).indexOf(active as HTMLElement)
        const next =
          e.key === "ArrowDown"
            ? (idx + 1) % links.length
            : (idx - 1 + links.length) % links.length
        links[next]?.focus()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen, closeMenu])

  useEffect(() => {
    function onPageLoad() {
      setMenuOpen(false)
      if (typeof document !== "undefined") {
        setTheme(
          document.documentElement.dataset.theme === "dark" ? "dark" : "light"
        )
      }
    }
    document.addEventListener("astro:page-load", onPageLoad)
    return () => document.removeEventListener("astro:page-load", onPageLoad)
  }, [])

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      sound.play("navigate")
      setMenuOpen(false)
      if (href.startsWith("/")) {
        e.preventDefault()
        navigate(href)
      }
    },
    []
  )

  const navItemByLabel = new Map(
    navItems.map((i) => [i.label.toLowerCase(), i.href])
  )
  const activeHref =
    segments.length > 0
      ? (navItemByLabel.get(segments[0].label.toLowerCase()) ?? null)
      : null

  const enterTransition = shouldReduceMotion
    ? { duration: 0 }
    : springs.moderate
  const itemTransition = shouldReduceMotion ? { duration: 0 } : springs.fast

  const overlay =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                key="nav-overlay"
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -3 }}
                transition={enterTransition}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                className="nav-overlay"
                onClick={handleOverlayClick}
              >
                <div className="nav-overlay-shell">
                  <div className="nav-menu-block">
                    <motion.div
                      className="nav-overlay-links"
                      initial={shouldReduceMotion ? false : "closed"}
                      animate="open"
                    >
                      <motion.nav
                        className="nav-links"
                        aria-label="Navigation"
                        variants={{
                          closed: {},
                          open: {
                            transition: {
                              staggerChildren: 0.025,
                              delayChildren: 0.03,
                            },
                          },
                        }}
                      >
                        {navItems.map((item) => (
                          <motion.span
                            key={item.href}
                            variants={{
                              closed: { opacity: 0, y: -3 },
                              open: { opacity: 1, y: 0 },
                            }}
                            transition={itemTransition}
                          >
                            <NavMenuItem
                              href={item.href}
                              label={item.label}
                              isActive={activeHref === item.href}
                              onClick={(e) => handleNavClick(e, item.href)}
                            />
                          </motion.span>
                        ))}

                        <motion.span
                          key="theme-toggle"
                          variants={{
                            closed: { opacity: 0, y: -3 },
                            open: { opacity: 1, y: 0 },
                          }}
                          transition={itemTransition}
                          style={{ marginTop: "1.25rem" }}
                        >
                          <button
                            type="button"
                            onClick={toggleTheme}
                            className="nav-menu-item theme-menu-button focus-ring"
                            data-cuelume-press="press"
                            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                          >
                            Theme
                          </button>
                        </motion.span>
                      </motion.nav>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null

  return (
    <div className={`site-header-nav ${className ?? ""}`}>
      <button
        ref={toggleRef}
        type="button"
        onClick={toggleMenu}
        className={`menu-trigger focus-ring ${menuOpen ? "is-open" : ""}`}
        data-cuelume-press="press"
        data-cuelume-release="release"
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={menuOpen ? "close" : "menu"}
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.12 }}
            style={{ display: "inline-block" }}
          >
            {menuOpen ? "Close" : "Menu"}
          </motion.span>
        </AnimatePresence>
      </button>

      {overlay}
    </div>
  )
}
