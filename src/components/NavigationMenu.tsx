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

export default function NavigationMenu({ segments }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const shouldReduceMotion = useReducedMotion()
  const hasTitle = segments.length > 1

  const navItemByLabel = new Map(navItems.map((i) => [i.label.toLowerCase(), i.href]))
  const activeHref =
    segments.length > 0
      ? navItemByLabel.get(segments[0].label.toLowerCase()) ?? null
      : null

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("nav-open")
    } else {
      document.body.classList.remove("nav-open")
    }
    return () => document.body.classList.remove("nav-open")
  }, [isOpen])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((o) => !o)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close()
        toggleRef.current?.focus()
        return
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const links = navRef.current?.querySelectorAll<HTMLAnchorElement>(".nav-link")
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
  }, [isOpen, close])

  useEffect(() => {
    if (isOpen) {
      const firstLink = navRef.current?.querySelector<HTMLAnchorElement>(".nav-link")
      window.setTimeout(() => firstLink?.focus(), 0)
    }
  }, [isOpen])

  useEffect(() => {
    function onPageLoad() {
      close()
    }
    document.addEventListener("astro:page-load", onPageLoad)
    return () => document.removeEventListener("astro:page-load", onPageLoad)
  }, [close])

  const handleNavClick = useCallback(() => {
    close()
  }, [close])

  const overlayTransition = {
    type: "tween" as const,
    duration: shouldReduceMotion ? 0 : 0.2,
    ease: "easeOut" as const,
  }

  return (
    <div ref={navRef} style={{ marginBottom: "var(--gap-after-breadcrumb, 2.5rem)" }}>
      <div className="nav-title">
        <a href="/" className="nav-home" data-sound="navigate" onClick={handleNavClick}>
          rnsh
        </a>
        {segments.map((seg, i) => (
          <span key={i}>
            <span className="mx-1" style={{ color: "var(--inactive)" }}>
              /
            </span>
            {i < segments.length - 1 && seg.href ? (
              <a href={seg.href} className="nav-parent" data-sound="navigate" onClick={handleNavClick}>
                {seg.label}
              </a>
            ) : i === segments.length - 1 && !hasTitle ? (
              <button
                ref={toggleRef}
                type="button"
                onClick={toggle}
                className="breadcrumb-toggle"
                data-sound="navigate"
                aria-expanded={isOpen}
                aria-label={`Open navigation — ${seg.label}`}
              >
                {seg.label}
              </button>
            ) : i === segments.length - 1 && hasTitle ? (
              <span className="nav-current">{seg.label}</span>
            ) : (
              <span style={{ color: "var(--inactive)" }}>{seg.label}</span>
            )}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
            className="fixed inset-0 z-40 overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            <motion.div
              initial={{ translateY: "-6px" }}
              animate={{ translateY: 0 }}
              exit={{ translateY: "-6px" }}
              transition={overlayTransition}
              className="mx-auto flex max-w-[640px] flex-col px-6 pt-32 pb-20 sm:px-8 sm:pt-36 lg:pt-40"
            >
              <div className="nav-title">
                <a href="/" className="nav-home" data-sound="navigate" onClick={handleNavClick}>
                  rnsh
                </a>
                {segments.slice(0, -1).map((seg, i) => (
                  <span key={i}>
                    <span className="mx-1" style={{ color: "var(--inactive)" }}>/</span>
                    {seg.href ? (
                      <a href={seg.href} className="nav-parent" data-sound="navigate" onClick={handleNavClick}>
                        {seg.label}
                      </a>
                    ) : (
                      <span className="nav-current">{seg.label}</span>
                    )}
                  </span>
                ))}
                <span className="mx-1" style={{ color: "var(--inactive)" }}>/</span>
                <span className="inline-block align-top">
                  <span className="nav-current">
                    {segments.length > 0 ? segments[segments.length - 1].label : ""}
                  </span>
                  <div className="nav-links" style={{ marginTop: "14px" }}>
                    {navItems.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className={`nav-link${activeHref === item.href ? " is-active" : ""}`}
                        data-sound="navigate"
                        onClick={handleNavClick}
                        style={{ marginBottom: "10px" }}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
