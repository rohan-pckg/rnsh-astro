/**
 * Theme switch with a glimm sweep (https://glimm.dev).
 *
 * A WebGL band travels left to right; the new theme is revealed behind it while
 * the old one stays ahead of it. glimm's React adapters do this for route
 * changes; this is the same recipe on glimm's framework-agnostic core:
 *
 *  1. startViewTransition() snapshots the old page and renders the new theme.
 *  2. The OLD snapshot sits on top and is clipped from the left, following the
 *     band: its edge is at x = -0.2 + progress * 1.4 of the viewport, exactly
 *     where the shader draws the band (glimm's `dirToUniforms`, margin 0.2).
 *  3. The canvas is its own transition layer, so it draws above both.
 *
 * It falls back to an instant switch (with the usual colour fade) for reduced
 * motion, no View Transitions, or no WebGL. glimm is loaded on demand.
 */
import type { ShaderController } from "glimm"

type Theme = "light" | "dark"

// A grey cosine palette: the band stays in the site's black and white. Swap for
// palette: "spectrum" (or any glimm preset) for colour.
const MONO = { a: [0.55, 0.55, 0.55], b: [0.45, 0.45, 0.45], c: [1, 1, 1], d: [0, 0, 0] } as {
  a: [number, number, number]
  b: [number, number, number]
  c: [number, number, number]
  d: [number, number, number]
}
const SWEEP_MS = 900
const OUTRO_MS = 200
const ATTR = "data-theme-sweep"

const STYLE = `
  html[${ATTR}] { view-transition-name: root !important; }
  html[${ATTR}] * { view-transition-name: none !important; }
  html[${ATTR}] [data-theme-sweep-layer] { view-transition-name: sweep-layer !important; }
  html[${ATTR}]::view-transition { pointer-events: none; }
  html[${ATTR}]::view-transition-group(*) { animation: none; }
  html[${ATTR}]::view-transition-image-pair(*) { isolation: auto; }
  html[${ATTR}]::view-transition-old(*),
  html[${ATTR}]::view-transition-new(*) { animation: none; mix-blend-mode: normal; opacity: 1; }
  html[${ATTR}]::view-transition-old(root) { z-index: 2; }
  html[${ATTR}]::view-transition-new(root) { z-index: 1; }
  html[${ATTR}]::view-transition-group(sweep-layer) { z-index: 2147483647; }
  html[${ATTR}]::view-transition-old(sweep-layer) { display: none; }
`

let glimm: Promise<typeof import("glimm")> | undefined
/** Start loading glimm (call on hover/focus of the toggle). */
export const warmThemeSweep = () => (glimm ??= import("glimm"))

let layer: { canvas: HTMLCanvasElement; ctrl: ShaderController } | undefined
let stop: (() => void) | undefined

async function getLayer(): Promise<typeof layer | null> {
  if (layer && !layer.canvas.isConnected) {
    layer.ctrl.destroy()
    layer = undefined
  }
  if (layer) return layer
  const { createShader } = await warmThemeSweep()
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647"
  document.body.append(canvas)
  const ctrl = createShader({ canvas, palette: MONO })
  if (!ctrl) {
    canvas.remove()
    return null
  }
  return (layer = { canvas, ctrl })
}

/** The old way: switch at once, colours easing over 0.45s (see global.css). */
function instant(apply: () => void) {
  const html = document.documentElement
  html.classList.add("theme-transition")
  apply()
  window.setTimeout(() => html.classList.remove("theme-transition"), 500)
}

/**
 * Switch theme. `apply` must do the whole switch synchronously (set
 * data-theme, store it, notify listeners). Resolves when the animation ends.
 */
export async function changeTheme(next: Theme, apply: () => void): Promise<void> {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduced || typeof document.startViewTransition !== "function") return instant(apply)

  stop?.() // a switch already in flight: land it, then start the next
  let l: typeof layer | null
  try {
    l = await getLayer()
  } catch {
    l = null
  }
  if (!l) return instant(apply)

  const { playSweep, EASINGS } = await warmThemeSweep()
  const root = document.documentElement
  const style = document.createElement("style")
  style.textContent = STYLE
  document.head.append(style)
  root.setAttribute(ATTR, "")
  l.canvas.setAttribute("data-theme-sweep-layer", "")
  l.ctrl.setAlpha(0)
  l.ctrl.setProgress(0)

  let clip: Animation | undefined
  let raf = 0
  let handle: ReturnType<typeof playSweep> | undefined
  let transition: ViewTransition | undefined
  let finished = false
  let settle!: () => void
  const done = new Promise<void>((r) => (settle = r))

  const end = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
    handle?.cancel()
    clip?.cancel()
    transition?.skipTransition()
    l!.ctrl.setAlpha(0)
    l!.ctrl.setProgress(0)
    l!.canvas.removeAttribute("data-theme-sweep-layer")
    root.removeAttribute(ATTR)
    style.remove()
    if (stop === end) stop = undefined
    settle()
  }
  stop = end

  try {
    transition = document.startViewTransition(apply)
    void transition.finished.catch(() => {})
    await transition.ready
  } catch {
    // Snapshot failed: make sure the theme is applied, then bail out.
    end()
    if (root.dataset.theme !== next) instant(apply)
    return
  }
  if (finished) return

  // Clip the old snapshot from the left, following the band.
  try {
    clip = root.animate(
      { clipPath: ["inset(0 0 0 0%)", "inset(0 0 0 100%)"] },
      { duration: 1000, fill: "both", easing: "linear", pseudoElement: "::view-transition-old(root)" }
    )
    clip.pause()
  } catch {
    clip = undefined
  }
  const follow = () => {
    if (finished) return
    const p = l!.ctrl.getProgress()
    if (clip) clip.currentTime = Math.max(0, Math.min(1, -0.2 + p * 1.4)) * 1000
    raf = requestAnimationFrame(follow)
  }

  handle = playSweep(l.ctrl, {
    sweepMs: SWEEP_MS,
    outroMs: OUTRO_MS,
    direction: "ltr",
    easing: EASINGS.easeInOutCubic,
    palette: MONO,
    brightness: next === "dark" ? 0.85 : 1,
  })
  follow()
  // The reveal is complete once the band has left the screen (progress 1);
  // the outro only fades the canvas out.
  await handle.done.catch(() => {})
  end()
  return done
}
