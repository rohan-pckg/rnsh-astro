import { useCallback, useEffect, useState } from "react"
import type { MouseEvent, ReactNode } from "react"
import { sound } from "@/lib/sound"
import { navigate } from "astro:transitions/client"

type NavItem = {
  label: string
  href: string
  match: (path: string) => boolean
  icon: ReactNode
}

function icon(path: ReactNode) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  )
}

const homeIcon = icon(<path d="M2.5 7.2 8 2.8l5.5 4.4v5.2a.6.6 0 0 1-.6.6H3.1a.6.6 0 0 1-.6-.6V7.2Z" />)
const aboutIcon = icon(
  <>
    <circle cx="8" cy="5.2" r="2.3" />
    <path d="M3.2 13.4c.7-2.3 2.6-3.5 4.8-3.5s4.1 1.2 4.8 3.5" />
  </>
)
const designIcon = icon(
  <>
    <path d="M9.8 2.6 13.4 6.2 6.1 13.5l-3.9 1 1-3.9 6.6-8Z" />
    <path d="M8.6 3.8l3.6 3.6" />
  </>
)
const projectsIcon = icon(
  <>
    <rect x="2.4" y="2.8" width="11.2" height="8.4" rx="1.4" />
    <path d="M2.4 6.2h11.2M5 13.4h6" />
  </>
)
const contactIcon = icon(
  <>
    <rect x="2.2" y="3.4" width="11.6" height="9.2" rx="1.4" />
    <path d="m3 5 5 3.6L13 5" />
  </>
)
const thoughtsIcon = icon(
  <>
    <path d="M3 2.8h10v10.4H3z" />
    <path d="M5.2 5.3h5.6M5.2 7.9h5.6M5.2 10.5h3.4" />
  </>
)
const moonIcon = icon(<path d="M13.2 9.4A5.2 5.2 0 0 1 6.6 2.8a5.2 5.2 0 1 0 6.6 6.6Z" />)
const sunIcon = icon(
  <>
    <circle cx="8" cy="8" r="2.6" />
    <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.7 3.7l1 1M11.3 11.3l1 1M12.3 3.7l-1 1M4.7 11.3l-1 1" />
  </>
)

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    match: (p) => p === "/",
    icon: homeIcon,
  },
  {
    label: "About",
    href: "/about",
    match: (p) => p === "/about",
    icon: aboutIcon,
  },
  {
    label: "Design",
    href: "/design",
    match: (p) => p === "/design" || p.startsWith("/design/"),
    icon: designIcon,
  },
  {
    label: "Projects",
    href: "/projects",
    match: (p) => p === "/projects",
    icon: projectsIcon,
  },
  {
    label: "Thoughts",
    href: "/blogs",
    match: (p) => p === "/blogs" || p.startsWith("/writing/"),
    icon: thoughtsIcon,
  },
  {
    label: "Contact",
    href: "/contact",
    match: (p) => p === "/contact",
    icon: contactIcon,
  },
]

function currentPath(): string {
  if (typeof window === "undefined") return "/"
  return window.location.pathname || "/"
}

// Astro emits trailing slashes (e.g. "/about/"); normalize so route
// matching works identically for SSR props and client-side state.
function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1)
  return p || "/"
}

export default function NavigationMenu({ path }: { path?: string }) {
  const [activePath, setActivePath] = useState<string>(() =>
    normalizePath(path ?? currentPath())
  )
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)
  // Always start at "light" so the first client render matches SSR HTML.
  // The mount effect below then syncs the real (possibly dark) theme from
  // the DOM without a hydration mismatch.
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const sync = () => {
      setActivePath(normalizePath(currentPath()))
      setHoveredHref(null)
      if (typeof document !== "undefined") {
        setTheme(
          document.documentElement.dataset.theme === "dark" ? "dark" : "light"
        )
      }
    }
    sync()
    document.addEventListener("astro:page-load", sync)
    return () => document.removeEventListener("astro:page-load", sync)
  }, [])

  const toggleTheme = useCallback(() => {
    const current =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light"
    const next = current === "dark" ? "light" : "dark"
    document.documentElement.classList.add("theme-transition")
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem("rnsh-theme", next)
    } catch {
      // Storage may be unavailable; the DOM attribute still applies.
    }
    setTheme(next)
    sound.play("toggle")
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition")
    }, 500)
  }, [])

  const handleNavClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, href: string) => {
      sound.play("navigate")
      setHoveredHref(null)
      if (href.startsWith("/")) {
        e.preventDefault()
        // Move the pill before ClientRouter swaps the page.
        setActivePath(normalizePath(href))
        navigate(href)
      }
    },
    []
  )

  // A hovered navigation item always takes precedence over the current route.
  // Theme deliberately never participates in either state.
  const activeHref: string | null =
    navItems.find((item) => item.match(activePath))?.href ?? null
  const expandedHref = hoveredHref ?? activeHref

  return (
    <nav className="pill-nav" aria-label="Primary">
      <div className="pill-nav-inner">
        <ul
          className="pill-nav-list"
          onPointerLeave={() => setHoveredHref(null)}
          onMouseLeave={() => setHoveredHref(null)}
        >
        {navItems.map((item) => {
          const expanded = expandedHref === item.href
          return (
            <li key={item.href}>
              <a
                href={item.href}
                className={`pill${expanded ? " is-expanded" : ""}`}
                aria-current={activeHref === item.href ? "page" : undefined}
                aria-label={item.label}
                data-sound="navigate"
                onClick={(e) => handleNavClick(e, item.href)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHoveredHref(item.href)
                }}
                onMouseEnter={() => setHoveredHref(item.href)}
                onFocus={() => setHoveredHref(item.href)}
                onBlur={() => setHoveredHref(null)}
              >
                <span className="pill-icon">{item.icon}</span>
                <span className="pill-label" aria-hidden={!expanded}>
                  <span>{item.label}</span>
                </span>
              </a>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className="pill"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title="Toggle theme"
            onClick={toggleTheme}
            onPointerEnter={() => setHoveredHref(null)}
            onMouseEnter={() => setHoveredHref(null)}
          >
            <span className="pill-icon">
              {theme === "dark" ? sunIcon : moonIcon}
            </span>
          </button>
        </li>
        </ul>
      </div>
    </nav>
  )
}
