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
        const links = navRef.current?.querySelectorAll<HTMLAnchorElement>(
          ".nav-link"
        )
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
          ?.querySelector<HTMLAnchorElement>(".nav-link")
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
      ? navItemByLabel.get(segments[0].label.toLowerCase()) ?? null
      : null

  const overlayTransition = {
    type: "tween" as const,
    duration: shouldReduceMotion ? 0 : 0.2,
    ease: "easeOut" as const,
  }

  function renderBreadcrumb(isOverlay: boolean) {
    if (menuOpen) {
      if (isArticle) {
        return (
          <>
            <span>
              {separator}
              <button
                ref={isOverlay ? undefined : toggleRef}
                type="button"
                onClick={closeMenu}
                className="nav-current"
                aria-expanded
                aria-label="Close navigation"
              >
                close
              </button>
            </span>
            <span>
              {separator}
              <span className="nav-current">
                {segments[segments.length - 1].label}
              </span>
            </span>
          </>
        )
      }
      return (
        <span>
          {separator}
          <button
            ref={isOverlay ? undefined : toggleRef}
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

    return segments.map((seg, i) => (
      <span key={i}>
        {separator}
        {i === 0 && isArticle ? (
          <button
            ref={toggleRef}
            type="button"
            onClick={openMenu}
            className="nav-parent"
            data-sound="navigate"
            aria-expanded={false}
            aria-label={`Open navigation — ${seg.label}`}
          >
            {seg.label}
          </button>
        ) : !isArticle ? (
          <button
            ref={toggleRef}
            type="button"
            onClick={openMenu}
            className="nav-current"
            data-sound="navigate"
            aria-expanded={false}
            aria-label={`Open navigation — ${isHome ? "menu" : seg.label}`}
          >
            {isHome ? "menu" : seg.label}
          </button>
        ) : i === segments.length - 1 ? (
          <span className="nav-current">{seg.label}</span>
        ) : (
          <span style={{ color: "var(--inactive)" }}>{seg.label}</span>
        )}
      </span>
    ))
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
            className="fixed inset-0 z-40 overflow-y-auto"
            style={{
              background: "var(--background)",
              scrollbarGutter: "stable",
            }}
          >
            <motion.div
              initial={{ translateY: "-4px" }}
              animate={{ translateY: 0 }}
              exit={{ translateY: "-4px" }}
              transition={overlayTransition}
              className="mx-auto flex max-w-[640px] flex-col px-6 pt-32 pb-20 sm:px-8 sm:pt-36 lg:pt-40"
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

              <div
                className="nav-links"
                style={{
                  marginTop: "14px",
                  paddingLeft: "calc(5ch + 8px)",
                }}
              >
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`nav-link${
                      activeHref === item.href ? " is-active" : ""
                    }`}
                    data-sound="navigate"
                    onClick={handleNavClick}
                    style={{ marginBottom: "10px" }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
