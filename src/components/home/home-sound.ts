/**
 * Homepage sounds (Cuelume), always on, never before the first interaction.
 *
 * - The markup carries Cuelume's own attributes (`data-cuelume-tap|open|close`);
 *   they stay inert until `bind()` runs.
 * - Cuelume is imported lazily: preloaded when the browser is idle (so it never
 *   touches first paint), then `bind()` + `unlock()` run on the first
 *   pointerdown / keydown / touchstart, which is also the gesture the browser
 *   needs to allow audio. Nothing plays before that.
 * - prefers-reduced-motion: sounds are skipped entirely (the attributes are
 *   removed, so no other `bind()` on the page can sound them either).
 */
import type * as Cuelume from "cuelume"

export interface HomeSound {
  /** Imperative cue for events that are not a click on a marked element. */
  cue(name: Cuelume.SoundName): void
  destroy(): void
}

const FIRST_EVENTS = ["pointerdown", "keydown", "touchstart"] as const

export function initHomeSound(root: HTMLElement): HomeSound {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.querySelectorAll<HTMLElement>("*").forEach((el) => {
      for (const name of el.getAttributeNames()) {
        if (name.startsWith("data-cuelume-")) el.removeAttribute(name)
      }
    })
    return { cue() {}, destroy() {} }
  }

  let api: typeof Cuelume | null = null
  let started = false
  let loading: Promise<typeof Cuelume> | null = null
  const load = () => (loading ??= import("cuelume").then((m) => (api = m)))

  // Preload when idle so the module is ready before the first interaction.
  const idle: (fn: () => void) => number =
    window.requestIdleCallback ?? ((fn) => window.setTimeout(fn, 300))
  const idleId = idle(() => void load())

  const start = () => {
    if (started) return
    started = true
    FIRST_EVENTS.forEach((ev) => document.removeEventListener(ev, start, true))
    const go = (m: typeof Cuelume) => {
      m.bind()
      void m.unlock()
    }
    // Module already preloaded: bind synchronously, in time for this very click.
    if (api) go(api)
    else void load().then(go)
  }
  FIRST_EVENTS.forEach((ev) =>
    document.addEventListener(ev, start, { capture: true, passive: true })
  )

  const cue = (name: Cuelume.SoundName) => {
    if (started && api) api.play(name)
  }
  const onNavigate = () => cue("navigate")
  document.addEventListener("astro:before-preparation", onNavigate)

  return {
    cue,
    destroy() {
      FIRST_EVENTS.forEach((ev) => document.removeEventListener(ev, start, true))
      document.removeEventListener("astro:before-preparation", onNavigate)
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleId)
    },
  }
}
