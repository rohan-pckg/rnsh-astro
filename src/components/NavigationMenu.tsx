import NavMenuItem from "@/components/NavMenuItem"
import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"

type NavItem = {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: "About", href: "/about" },
  { label: "Thoughts", href: "/blogs" },
  { label: "Projects", href: "/projects" },
  { label: "Gallery", href: "/gallery" },
  { label: "Design", href: "/design" },
  { label: "Sketchbook", href: "/sketchbook" },
]

export type BreadcrumbSegment = {
  label: string
  href?: string
}

type Props = {
  segments: BreadcrumbSegment[]
}

const separator = (
  <span className="mx-1" style={{ color: "var(--inactive)" }}>
    /
  </span>
)

export default function NavigationMenu({ segments }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const shouldReduceMotion = useReducedMotion()
  const isHome = segments.length === 1 && segments[0].label === "Menu"
  const isArticle = segments.length > 1

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const openMenu = useCallback(() => {
    setMenuOpen(true)
  }, [])

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
        navRef.current?.querySelector<HTMLAnchorElement>(".nav-menu-item")?.focus()
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

  const overlayTransition = {
    type: "tween" as const,
    duration: shouldReduceMotion ? 0 : 0.2,
    ease: "easeOut" as const,
  }

  function renderCloseButton(useOverlayToggleRef: boolean) {
    return (
      <span className="nav-breadcrumb-part">
        {separator}
        <button
          ref={useOverlayToggleRef ? undefined : toggleRef}
          type="button"
          onClick={closeMenu}
          className="nav-current"
          aria-expanded
          aria-label="Close navigation"
        >
          close
        </button>
      </span>
    )
  }

  function renderBreadcrumb(isOverlay: boolean) {
    if (menuOpen) {
      if (isArticle) {
        return (
          <div className="nav-breadcrumb">
            {renderCloseButton(isOverlay)}
            <span className="nav-breadcrumb-part nav-breadcrumb-part-leaf">
              {separator}
              <span className="nav-current nav-breadcrumb-leaf">
                {segments[segments.length - 1].label}
              </span>
            </span>
          </div>
        )
      }

      return (
        <div className="nav-breadcrumb">{renderCloseButton(isOverlay)}</div>
      )
    }

    return (
      <div className="nav-breadcrumb">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1

          if (i === 0 && isArticle) {
            return (
              <span key={i} className="nav-breadcrumb-part">
                {separator}
                <button
                  ref={isOverlay ? undefined : toggleRef}
                  type="button"
                  onClick={openMenu}
                  className="nav-parent"
                  data-sound="navigate"
                  aria-expanded={false}
                  aria-label={`Open navigation — ${seg.label}`}
                >
                  {seg.label}
                </button>
              </span>
            )
          }

          if (!isArticle) {
            return (
              <span key={i} className="nav-breadcrumb-part">
                {separator}
                <button
                  ref={isOverlay ? undefined : toggleRef}
                  type="button"
                  onClick={openMenu}
                  className="nav-current"
                  data-sound="navigate"
                  aria-expanded={false}
                  aria-label={`Open navigation — ${isHome ? "menu" : seg.label}`}
                >
                  {isHome ? "menu" : seg.label}
                </button>
              </span>
            )
          }

          if (isLast) {
            return (
              <span
                key={i}
                className="nav-breadcrumb-part nav-breadcrumb-part-leaf"
              >
                {separator}
                <span className="nav-current nav-breadcrumb-leaf">
                  {seg.label}
                </span>
              </span>
            )
          }

          return (
            <span key={i} className="nav-breadcrumb-part">
              {separator}
              <span style={{ color: "var(--inactive)" }}>{seg.label}</span>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={navRef}
      style={{ marginBottom: "var(--gap-after-breadcrumb, 2.5rem)" }}
    >
      <div className="nav-title">
        <a
          href="/"
          className="nav-home"
          data-sound="navigate"
          onClick={handleNavClick}
        >
          rnsh
        </a>
        {renderBreadcrumb(false)}
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 z-40 overflow-x-hidden overflow-y-auto"
            style={{
              background: "var(--background)",
              scrollbarGutter: "stable",
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={overlayTransition}
              className="nav-overlay-panel mx-auto flex max-w-[640px] flex-col px-6 pt-32 pb-20 sm:px-8 sm:pt-36 lg:pt-40"
              style={{
                paddingBottom:
                  "max(5rem, calc(5rem + env(safe-area-inset-bottom, 0px)))",
              }}
            >
              <div className="nav-title">
                <a
                  href="/"
                  className="nav-home"
                  data-sound="navigate"
                  onClick={handleNavClick}
                >
                  rnsh
                </a>
                {renderBreadcrumb(true)}
              </div>

              <div className="nav-links">
                {navItems.map((item) => (
                  <NavMenuItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    isActive={activeHref === item.href}
                    onClick={handleNavClick}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
