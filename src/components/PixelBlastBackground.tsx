import { useEffect, useState } from "react"
import PixelBlast from "@/components/PixelBlast"

/**
 * The ambient page background.
 *
 * A barely-visible Pixel Blast fixed behind the content plane: same orange
 * family as the `--accent` links, held far below their visual weight by a
 * sparse density, a slow drift and a low CSS opacity (see
 * `.pixel-blast-fixed` in `global.css`). On fine-pointer devices a very soft
 * cursor response gently lifts nearby pixels and warms them toward the brand
 * accent — same colour family, no trail, no halo. Decorative only —
 * `aria-hidden`, never intercepts input, renders nothing under
 * `prefers-reduced-motion`.
 */

const DARK_COLOR = "#ff8700"
const LIGHT_COLOR = "#ff5800"

function readTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "light"
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}

export default function PixelBlastBackground() {
  // Lazy initialisers read the live DOM on hydration, so the first paint
  // already matches the stored theme — the effect below only subscribes.
  const [theme, setTheme] = useState<"dark" | "light">(readTheme)
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const sync = (next: unknown) =>
      setTheme(next === "dark" || next === "light" ? next : readTheme())
    const onThemeChange = (event: Event) =>
      sync((event as CustomEvent<unknown>).detail)
    const onSwap = () => sync(readTheme())

    window.addEventListener("rnsh-theme-change", onThemeChange)
    document.addEventListener("astro:after-swap", onSwap)
    document.addEventListener("astro:page-load", onSwap)

    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onMotion = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches)
    query.addEventListener("change", onMotion)

    return () => {
      window.removeEventListener("rnsh-theme-change", onThemeChange)
      document.removeEventListener("astro:after-swap", onSwap)
      document.removeEventListener("astro:page-load", onSwap)
      query.removeEventListener("change", onMotion)
    }
  }, [])

  if (reducedMotion) return null

  return (
    <div className="pixel-blast-fixed" aria-hidden="true">
      <PixelBlast
        variant="square"
        pixelSize={6}
        color={theme === "dark" ? DARK_COLOR : LIGHT_COLOR}
        patternScale={3}
        patternDensity={0.55}
        pixelSizeJitter={0}
        edgeFade={0.5}
        speed={0.2}
        hoverRadius={220}
        hoverAccentStrength={0.32}
        hoverColorStrength={1}
      />
    </div>
  )
}
