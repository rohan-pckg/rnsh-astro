import NavMenuItem from "@/components/NavMenuItem"
import ThemeToggle from "@/components/ThemeToggle"
import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { durations, easings } from "@/lib/motion"

type NavItem = {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Thoughts", href: "/blogs" },
  { label: "Projects", href: "/projects" },
  { label: "Contact", href: "mailto:rnsh.space@gmail.com" },
]

export type BreadcrumbSegment = {
  label: string
  href?: string
}

type Props = {
  segments: BreadcrumbSegment[]
}

export default function NavigationMenu({ segments }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const shouldReduceMotion = useReducedMotion()

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const openMenu = useCallback(() => {
    setMenuOpen(true)
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
        const links =
          navRef.current?.querySelectorAll<HTMLAnchorElement>(".nav-menu-item")
        if (!links || links.length === 0) return
        const active = document.activeElement
        const idx = Array.from(links).indexOf(active as HTMLAnchorElement)
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
    window.setTimeout(() => {
      if (menuOpen) {
        navRef.current
          ?.querySelector<HTMLAnchorElement>(".nav-menu-item")
          ?.focus()
      } else {
        toggleRef.current?.focus()
      }
    }, 0)
  }, [menuOpen])

  useEffect(() => {
    function onPageLoad() {
      closeMenu()
    }
    document.addEventListener("astro:page-load", onPageLoad)
    return () => document.removeEventListener("astro:page-load", onPageLoad)
  }, [closeMenu])

  const handleNavClick = useCallback(() => {
    closeMenu()
  }, [closeMenu])

  const navItemByLabel = new Map(
    navItems.map((i) => [i.label.toLowerCase(), i.href])
  )
  const activeHref =
    segments.length > 0
      ? (navItemByLabel.get(segments[0].label.toLowerCase()) ?? null)
      : null

  const enterTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: durations.moderate, ease: easings.out }

  return (
    <div
      ref={navRef}
      style={{ marginBottom: "var(--gap-after-breadcrumb, 2.5rem)" }}
    >
      <div className="site-header">
        <ThemeToggle />
        <div className="nav-breadcrumb">
          <button
            ref={toggleRef}
            type="button"
            onClick={openMenu}
            className="menu-trigger focus-ring"
            data-cuelume-press="press"
            data-cuelume-release="release"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-label="Open navigation"
          >
            Menu
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={enterTransition}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="nav-overlay fixed inset-0 z-40 flex flex-col items-end overflow-x-hidden overflow-y-auto px-6 pt-2 pb-24 sm:px-8"
            style={{
              background: "var(--background)",
            }}
            onClick={handleOverlayClick}
          >
            <nav className="nav-links" aria-label="Navigation">
              {navItems.map((item) => (
                <NavMenuItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  isActive={activeHref === item.href}
                  onClick={handleNavClick}
                />
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
