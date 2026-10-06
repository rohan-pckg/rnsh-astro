/**
 * The site's navigation.
 *
 * The design has no header and no menu bar, so navigation is a vertical stack
 * of `++ /<name>` links rendered as page content: as a "Navigation" section on
 * the homepage, and in the footer of every other page. Both read this list, so
 * the two can never drift apart.
 *
 * Order follows the design's own homepage. `experiments` in the source is this
 * site's Lab, which is no longer listed here; the source's `everyday` has no
 * counterpart, and no route is invented to fill a gap.
 */

export type NavRoute = {
  /** The `++ /…` name, lowercase, as the design writes it. */
  label: string
  href: string
  /**
   * Additional path prefixes that count as being inside this route, so a post
   * under `/writing/…` still lights up `/thoughts`. Astro emits trailing
   * slashes, so these are matched against a normalised path.
   */
  prefixes: readonly string[]
}

export const navRoutes: readonly NavRoute[] = [
  { label: "thoughts", href: "/blogs", prefixes: ["/writing"] },
  { label: "gallery", href: "/gallery", prefixes: [] },
  { label: "projects", href: "/projects", prefixes: [] },
  { label: "about", href: "/about", prefixes: [] },
  { label: "designs", href: "/design", prefixes: [] },
  { label: "contact", href: "/contact", prefixes: [] },
]

/** Trailing slashes aside, which route is the current page inside? */
export function isNavRouteActive(route: NavRoute, pathname: string): boolean {
  const path =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/"
  if (path === route.href) return true
  return route.prefixes.some((prefix) => path.startsWith(`${prefix}/`))
}