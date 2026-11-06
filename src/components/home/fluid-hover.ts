/**
 * Fluid hover: ONE shared highlight that glides to whichever item is hovered
 * or keyboard-focused, then fades out when the pointer leaves.
 *
 * Principles taken from fluidfunctionalism.com/docs/fluid-hover: a single
 * element positioned from the item's measured box (relative to the container),
 * re-measured on demand, fading in fresh at its new position when it was
 * hidden, gliding when it was already visible. The highlight is an overlay
 * (`pointer-events: none`, absolutely positioned) so it can never shift layout.
 *
 * Scopes can nest (the page, and the drawer inside it): an item belongs to its
 * nearest `[data-fluid-scope]`, so each scope's highlight only handles its own
 * items.
 *
 * Item options (data attributes):
 *   data-fluid-item          marks an item
 *   data-fluid-pad="y x"     grow the pill beyond the item's box, in px
 *   data-fluid-tint="0.012"  pill opacity (black); default is the CSS 4%. Large
 *                            cards use the Figma's 1.2% so they read as white.
 */
export interface FluidHover {
  hide(): void
  destroy(): void
}

const canHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches

export function createFluidHover(
  container: HTMLElement,
  itemSelector = "[data-fluid-item]"
): FluidHover {
  container.dataset.fluidScope = ""
  const hl = document.createElement("div")
  hl.className = "fluid-hl"
  hl.setAttribute("aria-hidden", "true")
  container.append(hl)

  let active: HTMLElement | null = null
  let shown = false
  let mode: "pointer" | "focus" = "pointer"
  let lx = -1
  let ly = -1
  let raf = 0

  function itemFor(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null
    const item = target.closest<HTMLElement>(itemSelector)
    if (!item) return null
    return item.closest("[data-fluid-scope]") === container ? item : null
  }

  function box(el: HTMLElement) {
    const c = container.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const [py, px = py] = (el.dataset.fluidPad ?? "0")
      .split(/\s+/)
      .map(Number)
    return {
      x: r.left - c.left - px,
      y: r.top - c.top - py,
      w: r.width + px * 2,
      h: r.height + py * 2,
      radius: parseFloat(getComputedStyle(el).borderRadius) || 4,
    }
  }

  function apply(el: HTMLElement) {
    const b = box(el)
    hl.style.width = `${b.w}px`
    hl.style.height = `${b.h}px`
    hl.style.transform = `translate(${b.x}px, ${b.y}px)`
    hl.style.borderRadius = `${b.radius}px`
    const tint = el.dataset.fluidTint
    hl.style.background = tint ? `rgba(0, 0, 0, ${tint})` : ""
  }

  function show(el: HTMLElement) {
    if (el === active && shown) return
    active = el
    if (!shown) {
      // Fade in fresh at the new position instead of sliding from the last one.
      hl.classList.add("is-snap")
      apply(el)
      void hl.offsetWidth
      hl.classList.remove("is-snap")
      hl.style.opacity = "1"
      shown = true
    } else {
      apply(el)
    }
  }

  function hide() {
    active = null
    shown = false
    hl.style.opacity = "0"
  }

  const onOver = (e: PointerEvent) => {
    if (e.pointerType === "touch" || !canHover()) return
    lx = e.clientX
    ly = e.clientY
    mode = "pointer"
    const item = itemFor(e.target)
    if (item) show(item)
    else hide()
  }
  const onLeave = () => {
    if (mode === "pointer") hide()
  }
  const onFocusIn = (e: FocusEvent) => {
    const item = itemFor(e.target)
    if (item && item.matches(":focus-visible")) {
      mode = "focus"
      show(item)
    }
  }
  const onFocusOut = (e: FocusEvent) => {
    if (itemFor(e.target)) hide()
  }

  // Scrolling/resizing moves items under a still pointer: re-resolve.
  const onMove = () => {
    if (!shown || raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      if (!shown || !active) return
      if (mode === "pointer") {
        const item = itemFor(document.elementFromPoint(lx, ly))
        if (item) show(item)
        else hide()
        if (item) {
          hl.classList.add("is-snap")
          apply(item)
          void hl.offsetWidth
          hl.classList.remove("is-snap")
        }
      } else {
        hl.classList.add("is-snap")
        apply(active)
        void hl.offsetWidth
        hl.classList.remove("is-snap")
      }
    })
  }

  container.addEventListener("pointerover", onOver)
  container.addEventListener("pointerleave", onLeave)
  container.addEventListener("focusin", onFocusIn)
  container.addEventListener("focusout", onFocusOut)
  // Capture: scroll does not bubble, and the drawer scrolls an inner element.
  addEventListener("scroll", onMove, { passive: true, capture: true })
  addEventListener("resize", onMove)

  return {
    hide,
    destroy() {
      container.removeEventListener("pointerover", onOver)
      container.removeEventListener("pointerleave", onLeave)
      container.removeEventListener("focusin", onFocusIn)
      container.removeEventListener("focusout", onFocusOut)
      removeEventListener("scroll", onMove, { capture: true })
      removeEventListener("resize", onMove)
      cancelAnimationFrame(raf)
      hl.remove()
      delete container.dataset.fluidScope
    },
  }
}
