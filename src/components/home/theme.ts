/**
 * Homepage light/dark toggle (the dot-matrix sun/moon in the hero's corner).
 *
 * Uses the same contract as ThemeControl.astro: `data-theme` on <html>, the
 * choice stored under "rnsh-theme", and an "rnsh-theme-change" event. The
 * bootstrap in layouts/main.astro applies the stored theme before first paint.
 */
const label = (dark: boolean) =>
  dark ? "Switch to light theme" : "Switch to dark theme"

export function initTheme(root: HTMLElement): () => void {
  const btn = root.querySelector<HTMLButtonElement>("[data-theme-btn]")
  if (!btn) return () => {}

  const sync = () => {
    const dark = document.documentElement.dataset.theme === "dark"
    btn.setAttribute("aria-label", label(dark))
    btn.setAttribute("aria-pressed", String(dark))
  }
  const onClick = () => {
    const html = document.documentElement
    const next = html.dataset.theme === "dark" ? "light" : "dark"
    html.classList.add("theme-transition")
    html.dataset.theme = next
    try {
      localStorage.setItem("rnsh-theme", next)
    } catch {
      // Storage may be unavailable; the attribute still applies.
    }
    sync()
    window.dispatchEvent(new CustomEvent("rnsh-theme-change", { detail: next }))
    window.setTimeout(() => html.classList.remove("theme-transition"), 500)
  }

  sync()
  btn.addEventListener("click", onClick)
  return () => btn.removeEventListener("click", onClick)
}
