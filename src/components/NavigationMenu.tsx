import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"

type NavItem = {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: "About", href: "/about" },
  { label: "Thoughts", href: "/blogs" },
  { label: "Projects", href: "/design" },
  { label: "Gallery", href: "/gallery" },
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
    if (!isOpen) return

    function onPointer(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        close()
      }
    }

    const id = window.setTimeout(() => window.addEventListener("pointerdown", onPointer), 0)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener("pointerdown", onPointer)
    }
  }, [isOpen, close])

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

  return (
    <div ref={navRef} className="mb-10">
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
            initial={{ opacity: 0, translateY: "-6px" }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: "-6px" }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
            className="nav-links"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`nav-link${activeHref === item.href ? " is-active" : ""}`}
                data-sound="navigate"
                onClick={handleNavClick}
              >
                {item.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
