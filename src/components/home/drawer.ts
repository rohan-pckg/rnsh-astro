/**
 * Blog drawer. A native modal <dialog> (focus trap, Escape, inert background
 * and focus return come from the platform) animated with the Web Animations
 * API. Right-hand panel on desktop, bottom sheet on phones.
 *
 * URL: `?post=<id>` is pushed on open, so the back button closes the drawer and
 * opening that URL directly opens it. Drawer back/forward traversals are kept
 * from Astro's ClientRouter (which would otherwise refetch and swap the page)
 * by an early popstate guard registered from an inline script on the page.
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
  const panel = dlg.querySelector<HTMLElement>("[data-sd-panel]")!
  const posts = [...dlg.querySelectorAll<HTMLElement>("[data-sd-post]")]
  const ids = posts.map((p) => p.dataset.sdPost!)
  const fluids: FluidHover[] = posts.map((p) => createFluidHover(p))

  const basePath = location.pathname
  let current: string | null = null
  let opener: HTMLElement | null = null
  let closing = false
  let anims: Animation[] = []

  const postUrl = (id: string) => `${basePath}?post=${id}`
  const postFromUrl = () => {
    const id = new URL(location.href).searchParams.get("post")
    return id && ids.includes(id) ? id : null
  }

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
  function cancelAnims() {
    anims.forEach((a) => a.cancel())
    anims = []
  }

  function panelFrames(open: boolean, from = "0px"): Keyframe[] {
    if (reduced()) {
      return open
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0 }]
    }
    const away = isSheet() ? "translateY(100%)" : "translateX(calc(100% + 16px))"
    const rest = isSheet() ? `translateY(${from})` : "translateX(0)"
    return open
      ? [{ transform: away }, { transform: "none" }]
      : [{ transform: rest }, { transform: away }]
  }

  function animateIn() {
    cancelAnims()
    const ms = reduced() ? 150 : OPEN_MS
    anims.push(
      panel.animate(panelFrames(true), { duration: ms, easing: EASE_OUT }),
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ms,
        easing: "ease-out",
      })
    )
    reveal()
  }

  /** Reveal: content fades and rises 8px, staggered 60ms, after the panel starts. */
  function reveal() {
    if (reduced()) return
    const post = posts.find((p) => p.dataset.sdPost === current)
    if (!post) return
    const targets = [
      ...post.querySelectorAll<HTMLElement>(
        ".sd-scroll > *:not(.sd-prose), .sd-prose > *"
      ),
    ].slice(0, 8)
    targets.forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 300,
          delay: 100 + i * 60,
          easing: EASE_OUT,
          fill: "backwards",
        }
      )
    })
  }

  function animateOut(fromY = "0px"): Promise<void> {
    cancelAnims()
    const ms = reduced() ? 120 : CLOSE_MS
    const a = panel.animate(panelFrames(false, fromY), {
      duration: ms,
      easing: EASE_IN,
      fill: "forwards",
    })
    const b = scrim.animate([{ opacity: parseFloat(scrim.style.opacity || "1") }, { opacity: 0 }], {
      duration: ms,
      easing: "ease-in",
      fill: "forwards",
    })
    anims.push(a, b)
    return a.finished.then(
      () => undefined,
      () => undefined
    )
  }

  /* ---- open / close --------------------------------------------------- */
  function showPost(id: string) {
    posts.forEach((p) => (p.hidden = p.dataset.sdPost !== id))
    const post = posts.find((p) => p.dataset.sdPost === id)!
    dlg!.setAttribute("aria-labelledby", `sd-title-${id}`)
    post.querySelector(".sd-scroll")!.scrollTop = 0
    current = id
  }

  function open(
    id: string,
    from: HTMLElement | null,
    push: boolean
  ) {
    if (!ids.includes(id)) return
    hooks.onOpen()
    fluids.forEach((f) => f.hide())
    if (dlg!.open) {
      showPost(id)
      if (push) history.pushState({ ...history.state, drawer: id }, "", postUrl(id))
      return
    }
    opener = from
    closing = false
    showPost(id)
    lockScroll()
    scrim.style.opacity = ""
    panel.style.transform = ""
    dlg!.showModal()
    // Focus lands on the dialog container (tabindex=-1, no outline), never on
    // the title or a button; the first Tab then reaches Close.
    dlg!.focus({ preventScroll: true })
    animateIn()
    if (push) history.pushState({ ...history.state, drawer: id }, "", postUrl(id))
  }

  async function finishClose(fromY = "0px") {
    if (closing || !dlg!.open) return
    closing = true
    await animateOut(fromY)
    cancelAnims()
    dlg!.close()
    unlockScroll()
    scrim.style.opacity = ""
    panel.style.transform = ""
    current = null
    closing = false
    opener?.focus({ preventScroll: true })
    opener = null
  }

  /** User asked to close: go through history when we pushed an entry. */
  function requestClose(source: "button" | "other" = "other", fromY = "0px") {
    if (!dlg!.open || closing) return
    // A click on Close already plays via data-cuelume-close.
    if (source !== "button") hooks.cue("close")
    if (history.state?.drawer) {
      cued = true
      pendingFromY = fromY
      history.back() // popstate handler closes it
    } else {
      history.replaceState(history.state, "", basePath)
      void finishClose(fromY)
    }
  }
  let pendingFromY = "0px"
  // Whether the close cue already played (UI close) before history.back().
  let cued = false

  /* ---- events --------------------------------------------------------- */
  const onClick = (e: MouseEvent) => {
    const t = e.target as Element
    const card = t.closest<HTMLElement>("[data-story]")
    if (card && !e.defaultPrevented) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      open(
        card.dataset.story!,
        card.querySelector<HTMLElement>("[data-story-link]") ?? card,
        true
      )
      return
    }
    if (t.closest("[data-sd-close]")) requestClose("button")
  }

  const onScrimClick = () => requestClose()
  // `cancel` is Escape: route it through the same path so history stays right.
  const onCancel = (e: Event) => {
    e.preventDefault()
    requestClose()
  }

  // Keep Tab inside the dialog (wrap first <-> last).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dlg.open) return
    const post = posts.find((p) => p.dataset.sdPost === current)
    if (!post) return
    const items = [
      ...post.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => !el.hasAttribute("disabled"))
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !post.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !post.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  // Back/forward between drawer states. Called from the page's early popstate
  // guard (see index.astro), which stops the event before Astro's ClientRouter
  // would refetch and swap the page. Returns true when it handled the event.
  const onPopState = (): boolean => {
    if (location.pathname !== basePath) return false
    const next = postFromUrl()
    if (next === current) return false
    if (next) open(next, opener, false)
    else {
      if (!cued) hooks.cue("close") // browser back/forward closed it
      void finishClose(pendingFromY)
    }
    cued = false
    pendingFromY = "0px"
    return true
  }

  /* ---- swipe down to close (bottom sheet) ----------------------------- */
  let drag: { y0: number; t0: number; dy: number; id: number } | null = null
  const onPointerDown = (e: PointerEvent) => {
    if (!isSheet() || !dlg.open || closing) return
    const zone = (e.target as Element).closest("[data-sd-drag]")
    if (!zone || (e.target as Element).closest("button, a")) return
    drag = { y0: e.clientY, t0: e.timeStamp, dy: 0, id: e.pointerId }
    zone.setPointerCapture(e.pointerId)
    cancelAnims()
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    drag.dy = Math.max(0, e.clientY - drag.y0)
    panel.style.transform = `translateY(${drag.dy}px)`
    scrim.style.opacity = String(Math.max(0, 1 - drag.dy / panel.offsetHeight))
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return
    const { dy, t0 } = drag
    const v = dy / Math.max(1, e.timeStamp - t0) // px per ms
    drag = null
    if (dy > 120 || (v > 0.6 && dy > 24)) {
      requestClose("other", `${dy}px`)
    } else {
      const a = panel.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
        { duration: 220, easing: EASE_OUT }
      )
      panel.style.transform = ""
      scrim.style.opacity = ""
      anims.push(a)
    }
  }

  main.addEventListener("click", onClick)
  scrim.addEventListener("click", onScrimClick)
  dlg.addEventListener("cancel", onCancel)
  dlg.addEventListener("keydown", onKeyDown)
  dlg.addEventListener("pointerdown", onPointerDown)
  dlg.addEventListener("pointermove", onPointerMove)
  dlg.addEventListener("pointerup", onPointerUp)
  dlg.addEventListener("pointercancel", onPointerUp)
  window.__homeDrawerPopstate = onPopState

  // Opening the URL directly.
  const initial = postFromUrl()
  if (initial) requestAnimationFrame(() => open(initial, null, false))

  return {
    destroy() {
      main.removeEventListener("click", onClick)
      window.__homeDrawerPopstate = undefined
      fluids.forEach((f) => f.destroy())
      cancelAnims()
      if (dlg.open) dlg.close()
      unlockScroll()
    },
  }
}
