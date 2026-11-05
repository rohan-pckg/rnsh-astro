/**
 * Live local date/time for the hero ("DD-MM-YY hh:mm AM/PM").
 *
 * - Updates on the minute boundary with a single timeout (no fast interval).
 * - Pauses while the tab is hidden and refreshes when it becomes visible.
 * - Only runs while the element is shown (desktop, >= 768px); on phones the
 *   element is display:none and nothing runs.
 */
const pad = (n: number) => String(n).padStart(2, "0")

export function formatClock(d: Date): string {
  const h = d.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${pad(d.getFullYear() % 100)} ${pad(h12)}:${pad(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`
}

export function initClock(root: HTMLElement): () => void {
  const el = root.querySelector<HTMLTimeElement>("[data-clock]")
  if (!el) return () => {}

  const wide = matchMedia("(min-width: 768px)")
  let timer = 0

  const stop = () => {
    clearTimeout(timer)
    timer = 0
  }
  const tick = () => {
    stop()
    const now = new Date()
    el.textContent = formatClock(now)
    el.dateTime = now.toISOString()
    // Next minute boundary (+50ms so we land just after it).
    timer = window.setTimeout(tick, 60_000 - (now.getTime() % 60_000) + 50)
  }
  const sync = () => {
    if (wide.matches && !document.hidden) tick()
    else stop()
  }

  sync()
  document.addEventListener("visibilitychange", sync)
  wide.addEventListener("change", sync)

  return () => {
    stop()
    document.removeEventListener("visibilitychange", sync)
    wide.removeEventListener("change", sync)
  }
}
