/**
 * Contact channels shown in the homepage's CONTACT drawer. One line per channel:
 * add, remove or reorder rows here.
 *
 * Sourced from the existing /contact page and src/lib/social-links.ts.
 */
export interface HomeContact {
  label: string
  value: string
  href: string
  /** Opens in a new tab with rel="noopener noreferrer" and shows ↗. */
  external?: boolean
}

export const homeContacts: HomeContact[] = [
  { label: "Email", value: "rnsh.space@gmail.com", href: "mailto:rnsh.space@gmail.com" },
  { label: "GitHub", value: "rohan-pckg", href: "https://github.com/rohan-pckg", external: true },
  { label: "X", value: "rnsh_twt", href: "https://twitter.com/rnsh_twt", external: true },
  { label: "Reddit", value: "rohan_pckg", href: "https://reddit.com/user/rohan_pckg", external: true },
  { label: "LinkedIn", value: "rnsh-lnkdn", href: "https://www.linkedin.com/in/rohan-singh-5bb59b197", external: true },
]

const HAS_SCHEME = /^(https?:|mailto:|tel:)/i

/**
 * Makes a contact href safe to render: keeps http(s)/mailto/tel and internal
 * paths ("/..." or "#...") as they are, and prefixes anything else with
 * "https://" so a scheme-less "www.example.com/x" can never be treated as a
 * relative path.
 */
export function normalizeHref(href: string): string {
  const h = href.trim()
  if (HAS_SCHEME.test(h) || h.startsWith("/") || h.startsWith("#")) return h
  return `https://${h}`
}

/** External = any http(s) URL: opens in a new tab with noopener noreferrer. */
export const isExternalHref = (href: string) => /^https?:/i.test(href)
