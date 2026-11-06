/**
 * The homepage drawer: ONE native modal <dialog> holding two independent
 * panels, animated with the Web Animations API.
 *
 *   hub     Contact, About, Work (Work has a Code / Design toggle); the far-right slot
 *   detail  routed content (blog posts, design write-ups), fetched on demand
 *           from /posts/<slug>.json (cached, prefetched on hover/focus). It docks
 *           just left of the hub, or takes the far-right slot when no hub is open.
 *
 * Desktop: both can be open and stay interactive. Phones: stacked bottom
 * sheets (the underlying one is made inert).
 *
 * State is { hub, view, post } and round-trips through the URL:
 *   /?page=work&view=design&post=riji
 * Opening pushes a history entry. Closing steps back to the matching earlier
 * entry when there is one (so Back never piles up), else replaces the URL.
 * Back/Forward/direct loads re-apply the state parsed from the URL. Drawer
 * popstates are kept from Astro's ClientRouter by an early guard registered
 * from an inline script on the page (see index.astro).
 */
import { createFluidHover, type FluidHover } from "./fluid-hover"

// A critically damped spring look: fast start, soft landing.
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)"
const EASE_IN = "cubic-bezier(0.4, 0, 0.6, 1)"
const OPEN_MS = 320
const CLOSE_MS = 220

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const isSheet = () => matchMedia("(max-width: 767px)").matches

declare global {
  interface Window {
    __homeDrawerPopstate?: () => boolean
  }
}

type Side = "detail" | "hub"
type View = "code" | "design"
interface Snap {
  hub: string | null
  view: View
  post: string | null
}
interface Item {
  id: string
  title: string
  /** Shown in the detail header until the body arrives. */
  date: string
  /** The hub that owns this item (writing | work | about). */
  hub: string
  kind: "story" | "writing" | "design" | "about"
}
interface PostData {
  title: string
  date: string
  html: string
  kind: Item["kind"]
  image: {
    src: string
    width: number
    height: number
    alt: string
    img: string
    box: string
  } | null
}
interface Panel {
  el: HTMLElement
  open: boolean
  opener: HTMLElement | null
  anims: Animation[]
  token: number
}

export interface Drawer {
  destroy(): void
}

export function initDrawer(
  main: HTMLElement,
  hooks: { cue(name: "close"): void; onOpen(): void }
): Drawer | null {
  const dlg = main.querySelector<HTMLDialogElement>(".story-drawer")
  if (!dlg) return null
  const scrim = dlg.querySelector<HTMLElement>("[data-sd-scrim]")!
  const live = dlg.querySelector<HTMLElement>("[data-sd-live]")
  const detailEl = dlg.querySelector<HTMLElement>(".sd-detail")!
  const hubsEl = dlg.querySelector<HTMLElement>(".sd-hubs")!
  const detailArticle = detailEl.querySelector<HTMLElement>(".sd-post")!
  const hubs = [...hubsEl.querySelectorAll<HTMLElement>("[data-sd-hub]")]
  const hubIds = hubs.map((h) => h.dataset.sdHub!)
  const tablist = hubsEl.querySelector<HTMLElement>("[data-sd-tabs]")
  const tabs = [...hubsEl.querySelectorAll<HTMLElement>("[data-sd-tab]")]
  const views = [...hubsEl.querySelectorAll<HTMLElement>("[data-sd-view]")]

  const items: Item[] = JSON.parse(dlg.dataset.items ?? "[]")
  const itemIds = items.map((t) => t.id)
  const hubOf = (post: string) => items.find((t) => t.id === post)?.hub ?? null

  const fluids: FluidHover[] = [detailArticle, ...hubs].map((el) =>
    createFluidHover(el)
  )

  const panels: Record<Side, Panel> = {
    detail: { el: detailEl, open: false, opener: null, anims: [], token: 0 },
    hub: { el: hubsEl, open: false, opener: null, anims: [], token: 0 },
  }
  /** Open panels, oldest first: the last one is topmost. */
  let stack: Side[] = []
  let scrimAnims: Animation[] = []

  const basePath = location.pathname

  /* ---- state <-> URL -------------------------------------------------- */
  const EMPTY: Snap = { hub: null, view: "code", post: null }
  let cur: Snap = EMPTY

  const norm = (s: Snap): Snap => ({
    hub: s.hub,
    view: s.hub === "work" ? s.view : "code",
    post: s.post,
  })
  const same = (a: Snap, b: Snap) => {
    const x = norm(a)
    const y = norm(b)
    return x.hub === y.hub && x.view === y.view && x.post === y.post
  }
  const urlFor = (s: Snap) => {
    const n = norm(s)
    const q = new URLSearchParams()
    // An item with no hub (the hub was closed) is written as an empty page=,
    // so a bare legacy ?post=<slug> can still be told apart and normalized.
    if (n.hub) q.set("page", n.hub)
    else if (n.post) q.set("page", "")
    if (n.hub === "work" && n.view === "design") q.set("view", "design")
    if (n.post) q.set("post", n.post)
    const qs = q.toString()
    return basePath + (qs ? `?${qs}` : "")
  }
  /** A URL -> a state. `legacy` means it was not in the canonical schema. */
  function fromUrl(u: URL): { snap: Snap; legacy: boolean } {
    const sp = u.searchParams
    let hub = sp.get("page")
    let post = sp.get("post")
    let legacy = false
    // Old contact URL.
    if (post === "contact" && !hub) {
      hub = "contact"
      post = null
      legacy = true
    }
    const validPost = post && itemIds.includes(post) ? post : null
    let validHub = hub && hubIds.includes(hub) ? hub : null
    // Legacy ?post=<slug> (no page key, or the wrong hub): the post's own hub
    // opens too. An explicit empty page= means "item only, hub closed".
    const hubless = sp.has("page") && !sp.get("page")
    if (validPost && !hubless && validHub !== hubOf(validPost)) {
      validHub = hubOf(validPost)
      legacy = true
    }
    // A design write-up lives under the Design view unless the URL says otherwise.
    const design =
      sp.get("view") === "design" ||
      (!sp.has("view") && !!validPost && hubOf(validPost) === "work")
    return {
      snap: norm({
        hub: validHub,
        view: design ? "design" : "code",
        post: validPost,
      }),
      legacy,
    }
  }
  const parse = (): Snap => fromUrl(new URL(location.href)).snap

  /**
   * An internal link found inside rendered content -> the state it should open,
   * or null when it is not one of ours (e.g. /sketchbook), which then navigates
   * normally. Matches the drawer URLs and the old /writing, /design and /about.
   */
  function internalTarget(u: URL): Snap | null {
    const path = u.pathname.replace(/\/+$/, "") || "/"
    const m = /^\/(writing|design)\/([^/]+)$/.exec(path)
    if (m && itemIds.includes(m[2]))
      return norm({ hub: hubOf(m[2]), view: "design", post: m[2] })
    if (path === "/about") return norm({ hub: "about", view: "code", post: "full" })
    if (path === basePath) {
      const { snap } = fromUrl(u)
      return snap.hub || snap.post ? snap : null
    }
    return null
  }

  // History bookkeeping: `d` numbers the entries this page-load pushed.
  let d = history.state?.d ?? 0
  const snaps = new Map<number, Snap>()
  /** Element that initiated the next open (focus returns to it on close). */
  let trigger: HTMLElement | null = null
  /** What opened the drawer in the first place (focus returns there at the end). */
  let dialogOpener: HTMLElement | null = null
  /** The close cue already played before history.go() (avoid a double cue). */
  let cued = false
  let pendingFromY = "0px"

  /* ---- scroll lock ---------------------------------------------------- */
  const html = document.documentElement
  function lockScroll() {
    const bar = innerWidth - html.clientWidth
    html.style.overflow = "hidden"
    if (bar > 0) html.style.paddingRight = `${bar}px`
  }
  function unlockScroll() {
    html.style.overflow = ""
    html.style.paddingRight = ""
  }

  /* ---- animation ------------------------------------------------------ */
  /** Gap between the two docked panels, and the page gutter. */
  const GAP = 16

  /** How far the detail panel sits left of the far-right slot (0 = no hub). */
  const hubOffset = () =>
    !isSheet() && panels.hub.open ? hubsEl.offsetWidth + GAP : 0

  /** Current horizontal translation of an element, in px. */
  const currentX = (el: HTMLElement) => {
    const t = getComputedStyle(el).transform
    return t && t !== "none" ? new DOMMatrix(t).m41 : 0
  }

  const OFFSCREEN_RIGHT = `translateX(calc(100% + ${GAP}px))`

  function frames(side: Side, open: boolean, from = "0px"): Keyframe[] {
    if (reduced()) {
      return open
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0 }]
    }
    if (isSheet()) {
      return open
        ? [{ transform: "translateY(100%)" }, { transform: "none" }]
        : [{ transform: `translateY(${from})` }, { transform: "translateY(100%)" }]
    }
    if (side === "hub") {
      return open
        ? [{ transform: OFFSCREEN_RIGHT }, { transform: "none" }]
        : [{ transform: "none" }, { transform: OFFSCREEN_RIGHT }]
    }
    // detail: with a hub open it emerges from behind it (and returns behind it);
    // alone it slides in from the right edge like the hub does.
    const x = currentX(detailEl)
    const behind = hubOffset() > 0 || x < 0
    if (open) {
      return behind
        ? [
            { transform: "translateX(0)", opacity: 0 },
            { transform: `translateX(${x}px)`, opacity: 1 },
          ]
        : [
            { transform: OFFSCREEN_RIGHT, opacity: 0 },
            { transform: "none", opacity: 1 },
          ]
    }
    return behind && hubOffset() > 0
      ? [
          { transform: `translateX(${x}px)`, opacity: 1 },
          { transform: "translateX(0)", opacity: 0 },
        ]
      : [
          { transform: `translateX(${x}px)`, opacity: 1 },
          { transform: OFFSCREEN_RIGHT, opacity: 0 },
        ]
  }

  /**
   * Park the detail panel next to the hub (or in the far-right slot). Called
   * when the hub opens or closes: the panel glides with a CSS transform
   * transition (none for reduced motion), or snaps when `animate` is false.
   */
  function placeDetail(animate: boolean) {
    const x = hubOffset()
    detailEl.style.transition = animate && !reduced() ? "" : "none"
    detailEl.style.transform = x ? `translateX(${-x}px)` : ""
    if (!animate || reduced()) {
      void detailEl.offsetWidth // commit without a transition, then restore
      detailEl.style.transition = ""
    }
  }

  function animatePanel(side: Side, open: boolean, fromY = "0px") {
    const p = panels[side]
    p.anims.forEach((a) => a.cancel())
    const ms = reduced() ? (open ? 150 : 120) : open ? OPEN_MS : CLOSE_MS
    const a = p.el.animate(frames(side, open, fromY), {
      duration: ms,
      easing: open ? EASE_OUT : EASE_IN,
      fill: open ? undefined : "forwards",
    })
    p.anims = [a]
    return a.finished.then(
      () => undefined,
      () => undefined
    )
  }

  function animateScrim(open: boolean) {
    scrimAnims.forEach((a) => a.cancel())
    const ms = reduced() ? (open ? 150 : 120) : open ? OPEN_MS : CLOSE_MS
    const a = scrim.animate(
      [
        { opacity: open ? 0 : parseFloat(scrim.style.opacity || "1") },
        { opacity: open ? 1 : 0 },
      ],
      {
        duration: ms,
        easing: open ? "ease-out" : "ease-in",
        fill: open ? undefined : "forwards",
      }
    )
    scrimAnims = [a]
    return a.finished.then(
      () => undefined,
      () => undefined
    )
  }

  const fade = (el: HTMLElement, out: boolean, ms: number) =>
    el
      .animate(
        out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
        {
          duration: ms,
          easing: out ? "ease-out" : EASE_OUT,
          fill: out ? "forwards" : undefined,
        }
      )
      .finished.then(
        () => undefined,
        () => undefined
      )

  /** Content rises in, staggered, when a hub panel opens or changes. */
  function reveal(article: HTMLElement) {
    if (reduced()) return
    const targets = [
      ...article.querySelectorAll<HTMLElement>(
        ".sd-scroll > *:not(.sd-prose):not(.sd-views), .sd-prose > *, .sd-contacts > li"
      ),
    ].slice(0, 8)
    targets.forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 300, delay: 100 + i * 60, easing: EASE_OUT, fill: "backwards" }
      )
    })
  }

  /* ---- small DOM helpers --------------------------------------------- */
  const mk = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    text?: string
  ) => {
    const n = document.createElement(tag)
    if (className) n.className = className
    if (text !== undefined) n.textContent = text
    return n
  }
  const activeHub = () => hubs.find((h) => !h.hidden) ?? null
  const scrollOf = (side: Side) =>
    side === "detail"
      ? detailEl.querySelector<HTMLElement>(".sd-scroll")
      : (activeHub()?.querySelector<HTMLElement>(".sd-scroll") ?? null)

  function announce(text: string) {
    if (!live) return
    live.textContent = ""
    window.setTimeout(() => (live.textContent = text), 50)
  }

  /** Keeps aria-labelledby, stacking order and inertness fresh. */
  function syncChrome() {
    const top = stack[stack.length - 1]
    const hubLabel = activeHub()?.querySelector<HTMLElement>("[data-sd-label]")?.id
    if (hubLabel) hubsEl.setAttribute("aria-labelledby", hubLabel)
    detailEl.setAttribute("aria-labelledby", "sd-title-post")
    const labelId = top === "detail" ? "sd-title-post" : hubLabel
    if (labelId) dlg!.setAttribute("aria-labelledby", labelId)
    if (isSheet()) {
      // Stacked sheets: the most recently opened is on top.
      stack.forEach((s, i) => (panels[s].el.style.zIndex = String(i + 1)))
    } else {
      // Side by side: the hub stays above the detail panel that glides out of it.
      hubsEl.style.zIndex = "2"
      detailEl.style.zIndex = "1"
    }
    // Stacked sheets: only the top one is interactive.
    detailEl.inert = false
    hubsEl.inert = false
    if (stack.length === 2 && isSheet()) panels[stack[0]].el.inert = true
  }

  /* ---- post bodies: fetched on demand, cached, prefetched ------------- */
  const cache = new Map<string, Promise<PostData>>()
  function getPost(id: string): Promise<PostData> {
    let p = cache.get(id)
    if (!p) {
      p = fetch(`/posts/${id}.json`).then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<PostData>
      })
      cache.set(id, p)
      p.catch(() => cache.delete(id)) // a failed fetch can be retried
    }
    return p
  }
  const prefetch = (id: string) => {
    if (itemIds.includes(id) && !cache.has(id)) void getPost(id).catch(() => {})
  }

  const TITLE_CLASS =
    "font-geist mt-6 text-[14px] leading-normal font-medium opacity-80"
  function titleEl(text: string) {
    const h = mk("h2", TITLE_CLASS, text)
    h.id = "sd-title-post"
    return h
  }

  function skeleton(title: string) {
    const frag = document.createDocumentFragment()
    const bars = mk("div", "sd-skel")
    bars.setAttribute("aria-hidden", "true")
    bars.append(mk("i"), mk("i"), mk("i"))
    frag.append(titleEl(title), bars)
    return frag
  }

  function errorState(id: string, kind: Item["kind"]) {
    const box = mk("div", "sd-error")
    box.setAttribute("role", "alert")
    box.append(mk("p", "", "Couldn't load this."))
    const retry = mk("button", "", "Try again")
    retry.type = "button"
    retry.dataset.sdRetry = ""
    box.append(retry)
    const full =
      kind === "design"
        ? `/design/${id}`
        : kind === "writing"
          ? `/writing/${id}`
          : kind === "about"
            ? "/about"
            : null
    if (full) {
      const a = mk("a", "", "Open the full page")
      a.href = `${full}?full=1`
      box.append(a)
    }
    return box
  }

  /**
   * Links inside rendered content: external ones open in a new tab; internal
   * ones we know (another post, a design project, the About content) are
   * rewritten to their drawer URL and opened in the left column in place.
   */
  function enhanceLinks(root: HTMLElement) {
    root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      let u: URL
      try {
        u = new URL(a.getAttribute("href")!, location.href)
      } catch {
        return
      }
      if (u.origin !== location.origin) {
        if (/^https?:$/.test(u.protocol)) {
          a.target = "_blank"
          a.rel = "noopener noreferrer"
          if (!a.querySelector(".sr-only"))
            a.append(mk("span", "sr-only", " (opens in a new tab)"))
        }
        return
      }
      const target = internalTarget(u)
      if (target?.post) {
        a.href = urlFor(target)
        a.dataset.post = target.post
      }
    })
  }

  async function renderDetail(id: string) {
    const t = items.find((x) => x.id === id)
    if (!t) return
    const content = detailArticle.querySelector<HTMLElement>("[data-sd-content]")!
    const date = detailArticle.querySelector<HTMLElement>("[data-sd-date]")!
    date.textContent = t.date
    detailArticle.setAttribute("aria-busy", "true")
    content.replaceChildren(skeleton(t.title))
    const sc = scrollOf("detail")
    if (sc) sc.scrollTop = 0
    try {
      const data = await getPost(id)
      if (cur.post !== id) return // the user moved on
      const frag = document.createDocumentFragment()
      if (data.image) {
        const art = mk("div", `sd-art ${data.image.box}`)
        const img = mk("img", data.image.img)
        img.src = data.image.src
        img.alt = data.image.alt
        img.width = data.image.width
        img.height = data.image.height
        img.loading = "lazy"
        img.decoding = "async"
        art.append(img)
        frag.append(art)
      }
      frag.append(titleEl(data.title))
      const prose = mk("div", "sd-prose")
      prose.innerHTML = data.html // built from our own content at build time
      enhanceLinks(prose)
      frag.append(prose)
      date.textContent = data.date
      content.replaceChildren(frag)
      content.animate(
        reduced()
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: "translateY(8px)" },
              { opacity: 1, transform: "none" },
            ],
        { duration: reduced() ? 120 : 220, easing: EASE_OUT }
      )
    } catch {
      if (cur.post !== id) return
      content.replaceChildren(titleEl(t.title), errorState(id, t.kind))
    } finally {
      if (cur.post === id) detailArticle.removeAttribute("aria-busy")
    }
  }

  /* ---- panels: open / swap / close ------------------------------------ */
  function showHub(id: string, view: View) {
    hubs.forEach((h) => (h.hidden = h.dataset.sdHub !== id))
    const sc = scrollOf("hub")
    if (sc) sc.scrollTop = 0
    if (id === "work") void applyView(view, false)
  }

  function openDialog() {
    if (dlg!.open) return
    hooks.onOpen()
    fluids.forEach((f) => f.hide())
    lockScroll()
    scrim.style.opacity = ""
    dlg!.showModal()
    dlg!.focus({ preventScroll: true }) // the container; never a title or wrapper
    void animateScrim(true)
  }

  function openPanel(side: Side) {
    const p = panels[side]
    if (p.open) return
    p.open = true
    p.token++
    p.opener = trigger
    trigger = null
    p.el.hidden = false
    if (side === "detail") placeDetail(false)
    else p.el.style.transform = ""
    const first = !dlg!.open
    if (first) dialogOpener = p.opener
    stack = stack.filter((s) => s !== side)
    stack.push(side)
    openDialog()
    syncChrome()
    // A hub opening (or closing) moves a detail panel that is already open.
    if (side === "hub" && panels.detail.open) placeDetail(true)
    void animatePanel(side, true)
    if (!first) panels[side].el.focus({ preventScroll: true })
    const art = side === "hub" ? activeHub() : null
    if (art) reveal(art)
  }

  async function closePanel(side: Side) {
    const p = panels[side]
    if (!p.open) return
    p.open = false
    const token = ++p.token
    const fromY = pendingFromY
    pendingFromY = "0px"
    stack = stack.filter((s) => s !== side)
    const last = stack.length === 0
    syncChrome()
    if (side === "hub" && panels.detail.open) placeDetail(true)
    await Promise.all([
      animatePanel(side, false, fromY),
      last ? animateScrim(false) : Promise.resolve(),
    ])
    if (p.token !== token) return // reopened meanwhile
    p.anims.forEach((a) => a.cancel())
    p.el.hidden = true
    p.el.style.transform = ""
    if (side === "detail")
      detailArticle.querySelector("[data-sd-content]")?.replaceChildren()
    if (last) {
      scrimAnims.forEach((a) => a.cancel())
      scrim.style.opacity = ""
      dlg!.close()
      unlockScroll()
    }
    syncChrome()
    // Return focus to whatever opened this panel (if it is still around).
    // The last panel to close falls back to what opened the whole drawer.
    const usable = (el: HTMLElement | null): el is HTMLElement =>
      !!el && el.isConnected && !el.closest("[hidden]")
    const o = p.opener
    p.opener = null
    if (last) {
      const target = usable(o) ? o : usable(dialogOpener) ? dialogOpener : null
      dialogOpener = null
      target?.focus({ preventScroll: true })
    } else if (usable(o) && dlg!.contains(o)) o.focus({ preventScroll: true })
    else dlg!.focus({ preventScroll: true })
  }

  async function swapHub(id: string, view: View) {
    const from = activeHub()
    if (from && !reduced()) await fade(from, true, 110)
    from?.getAnimations().forEach((a) => a.cancel())
    showHub(id, view)
    syncChrome()
    const to = activeHub()
    if (to) {
      void fade(to, false, reduced() ? 120 : 180)
      reveal(to)
    }
    panels.hub.el.focus({ preventScroll: true })
    announce(to?.querySelector("[data-sd-label]")?.textContent?.trim() ?? "")
  }

  let swapToken = 0
  async function swapDetail(id: string) {
    const token = ++swapToken
    if (!reduced()) {
      await fade(detailArticle, true, 110)
      if (token !== swapToken) return
    }
    detailArticle.getAnimations().forEach((a) => a.cancel())
    void renderDetail(id)
    void fade(detailArticle, false, reduced() ? 120 : 180)
    panels.detail.el.focus({ preventScroll: true })
    announce(items.find((t) => t.id === id)?.title ?? "")
  }

  /** Work: the Code / Design toggle (quick crossfade, scroll reset). */
  let viewToken = 0
  async function applyView(view: View, animate: boolean) {
    const token = ++viewToken
    tabs.forEach((t) => {
      const on = t.dataset.sdTab === view
      t.setAttribute("aria-selected", String(on))
      t.tabIndex = on ? 0 : -1
    })
    if (tablist) tablist.dataset.active = view
    const to = views.find((v) => v.dataset.sdView === view)
    const from = views.find((v) => !v.hidden && v !== to)
    if (!to) return
    if (animate && from && !reduced()) {
      await fade(from, true, 90)
      if (token !== viewToken) return
    }
    from?.getAnimations().forEach((a) => a.cancel())
    views.forEach((v) => (v.hidden = v !== to))
    const sc = scrollOf("hub")
    if (sc) sc.scrollTop = 0
    if (animate) void fade(to, false, reduced() ? 100 : 140)
  }

  /** The open item's row/card in the hub gets aria-current (and a soft fill). */
  function markCurrent() {
    hubsEl.querySelectorAll<HTMLElement>("[data-post]").forEach((el) => {
      if (el.dataset.post === cur.post) el.setAttribute("aria-current", "true")
      else el.removeAttribute("aria-current")
    })
  }

  /** Make the UI match a state (used for user actions and for Back/Forward). */
  function applyState(next: Snap) {
    const prev = cur
    cur = next
    // right (hub)
    if (next.hub !== prev.hub) {
      if (!next.hub) void closePanel("hub")
      else if (!panels.hub.open) {
        showHub(next.hub, next.view)
        openPanel("hub")
      } else void swapHub(next.hub, next.view)
    } else if (next.hub === "work" && next.view !== prev.view) {
      void applyView(next.view, true)
    }
    // left (routed content)
    if (next.post !== prev.post) {
      if (!next.post) void closePanel("detail")
      else if (!panels.detail.open) {
        void renderDetail(next.post)
        openPanel("detail")
      } else void swapDetail(next.post)
    }
    markCurrent()
  }

  /** A user action that opens/changes something: push a history entry. */
  function go(next: Snap) {
    next = norm(next)
    if (same(next, cur)) return
    applyState(next)
    for (const k of [...snaps.keys()]) if (k > d) snaps.delete(k)
    d++
    history.pushState({ ...history.state, drawer: true, d }, "", urlFor(next))
    snaps.set(d, next)
  }

  /** A user action that closes something. */
  function closeTo(target: Snap, source: "button" | "other", fromY = "0px") {
    target = norm(target)
    if (same(target, cur)) return
    // A click on Close already plays via data-cuelume-close.
    if (source !== "button") hooks.cue("close")
    pendingFromY = fromY
    // Prefer stepping back to an earlier entry that already is the target.
    for (let j = d - 1; j >= 0; j--) {
      const sj = snaps.get(j)
      if (sj && same(sj, target)) {
        cued = true
        history.go(j - d)
        return
      }
    }
    applyState(target)
    history.replaceState({ ...history.state, drawer: true, d }, "", urlFor(target))
    snaps.set(d, target)
  }

  const withoutSide = (side: Side): Snap =>
    side === "detail" ? { ...cur, post: null } : { ...cur, hub: null }
  const closeSide = (side: Side, source: "button" | "other", fromY = "0px") =>
    closeTo(withoutSide(side), source, fromY)
  const closeAll = (source: "button" | "other") => closeTo(EMPTY, source)

  /* ---- events --------------------------------------------------------- */
  const modified = (e: MouseEvent) =>
    e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

  const onClick = (e: MouseEvent) => {
    const t = e.target as Element
    if (t.closest("[data-sd-retry]")) {
      if (cur.post) void renderDetail(cur.post)
      return
    }
    const closeBtn = t.closest("[data-sd-close]")
    if (closeBtn) {
      const side = closeBtn.closest<HTMLElement>("[data-sd-side]")?.dataset
        .sdSide as Side | undefined
      if (side) closeSide(side, "button")
      return
    }
    const tab = t.closest<HTMLElement>("[data-sd-tab]")
    if (tab) {
      go({ ...cur, view: tab.dataset.sdTab as View })
      return
    }
    const opener = t.closest<HTMLElement>("[data-hub],[data-post]")
    if (opener && !e.defaultPrevented) {
      if (modified(e)) return // new tab etc. keep working (real hrefs)
      e.preventDefault()
      trigger =
        opener.querySelector<HTMLElement>("[data-story-link]") ?? opener
      const post = opener.dataset.post || null
      // A bare data-post opens in its own hub; Work items are design write-ups.
      const hub = opener.dataset.hub ?? (post ? hubOf(post) : null)
      if (!hub) return
      go({
        ...cur,
        hub,
        view: hub === "work" ? (post ? "design" : cur.hub === "work" ? cur.view : "code") : "code",
        post: post ?? (hub === cur.hub ? cur.post : null),
      })
    }
  }

  // Arrow keys / Home / End move between the Code / Design tabs.
  const onTabKeys = (e: KeyboardEvent) => {
    const tab = (e.target as Element).closest<HTMLElement>("[data-sd-tab]")
    if (!tab) return
    const i = tabs.indexOf(tab)
    let n = -1
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length
    else if (e.key === "Home") n = 0
    else if (e.key === "End") n = tabs.length - 1
    if (n < 0) return
    e.preventDefault()
    go({ ...cur, view: tabs[n].dataset.sdTab as View })
    tabs[n].focus({ preventScroll: true })
  }

  // Warm the cache when a card or row is hovered or focused.
  const onIntent = (e: Event) => {
    const id = (e.target as Element).closest<HTMLElement>("[data-post]")
      ?.dataset.post
    if (id) prefetch(id)
  }

  const onScrimClick = () => closeAll("other")
  // `cancel` is Escape: close the topmost panel first, then the next.
  const onCancel = (e: Event) => {
    e.preventDefault()
    const top = stack[stack.length - 1]
    if (top) closeSide(top, "other")
  }

  // Keep Tab inside the dialog, across both panels (wrap first <-> last).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dlg.open) return
    const focusables = [
      ...dlg.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])'
      ),
    ].filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.hasAttribute("disabled") &&
        !el.closest("[hidden], [inert]")
    )
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement as HTMLElement | null
    const inside = active ? focusables.includes(active) : false
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault()
      first.focus()
    }
  }

  // Back/forward. Called from the page's early popstate guard; returns true
  // when it handled the event (so Astro's ClientRouter never sees it).
  const onPopState = (): boolean => {
    if (location.pathname !== basePath) return false
    const next = parse()
    const nd = history.state?.d ?? 0
    if (same(next, cur)) {
      d = nd
      return false
    }
    const closed = (cur.hub && !next.hub) || (cur.post && !next.post)
    if (closed && !cued) hooks.cue("close") // browser back/forward closed it
    cued = false
    d = nd
    snaps.set(d, next)
    applyState(next)
    return true
  }

  /* ---- swipe down to close (bottom sheets) ---------------------------- */
  let drag: { side: Side; y0: number; t0: number; dy: number; id: number } | null =
    null
  const onPointerDown = (e: PointerEvent) => {
    if (!isSheet() || !dlg.open) return
    const zone = (e.target as Element).closest("[data-sd-drag]")
    const sideEl = zone?.closest<HTMLElement>("[data-sd-side]")
    if (!zone || !sideEl || (e.target as Element).closest("button, a")) return
    const side = sideEl.dataset.sdSide as Side
    if (!panels[side].open) return
    drag = { side, y0: e.clientY, t0: e.timeStamp, dy: 0, id: e.pointerId }
    zone.setPointerCapture(e.pointerId)
    panels[side].anims.forEach((a) => a.cancel())
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    drag.dy = Math.max(0, e.clientY - drag.y0)
    const el = panels[drag.side].el
    el.style.transform = `translateY(${drag.dy}px)`
    if (stack.length === 1)
      scrim.style.opacity = String(Math.max(0, 1 - drag.dy / el.offsetHeight))
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const { side, dy, t0 } = drag
    const v = dy / Math.max(1, e.timeStamp - t0) // px per ms
    drag = null
    const el = panels[side].el
    if (dy > 120 || (v > 0.6 && dy > 24)) {
      closeSide(side, "other", `${dy}px`)
    } else {
      const a = el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
        { duration: 220, easing: EASE_OUT }
      )
      el.style.transform = ""
      scrim.style.opacity = ""
      panels[side].anims = [a]
    }
  }

  const sheetMq = matchMedia("(max-width: 767px)")
  const onBreakpoint = () => {
    syncChrome()
    placeDetail(false)
  }

  main.addEventListener("click", onClick)
  main.addEventListener("pointerover", onIntent)
  main.addEventListener("focusin", onIntent)
  tablist?.addEventListener("keydown", onTabKeys)
  scrim.addEventListener("click", onScrimClick)
  dlg.addEventListener("cancel", onCancel)
  dlg.addEventListener("keydown", onKeyDown)
  dlg.addEventListener("pointerdown", onPointerDown)
  dlg.addEventListener("pointermove", onPointerMove)
  dlg.addEventListener("pointerup", onPointerUp)
  dlg.addEventListener("pointercancel", onPointerUp)
  sheetMq.addEventListener("change", onBreakpoint)
  window.__homeDrawerPopstate = onPopState

  // Opening the URL directly (right panel first, then the one on top of it).
  const { snap: initial, legacy } = fromUrl(new URL(location.href))
  // Legacy URLs (?post=<blog>, ?post=contact) are rewritten in place.
  if (legacy) history.replaceState(history.state, "", urlFor(initial))
  snaps.set(d, initial)
  if (!same(initial, EMPTY)) requestAnimationFrame(() => applyState(initial))

  return {
    destroy() {
      main.removeEventListener("click", onClick)
      main.removeEventListener("pointerover", onIntent)
      main.removeEventListener("focusin", onIntent)
      sheetMq.removeEventListener("change", onBreakpoint)
      window.__homeDrawerPopstate = undefined
      fluids.forEach((f) => f.destroy())
      panels.detail.anims.forEach((a) => a.cancel())
      panels.hub.anims.forEach((a) => a.cancel())
      if (dlg.open) dlg.close()
      unlockScroll()
    },
  }
}
