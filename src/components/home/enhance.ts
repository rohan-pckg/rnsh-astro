import { createFluidHover } from "./fluid-hover"
import { initDrawer } from "./drawer"
import { initHomeSound } from "./home-sound"
import { initClock } from "./clock"

/** Wires the homepage's fluid hover, drawer, sounds and the clock. Returns a cleanup. */
export function initHome(): () => void {
  const main = document.querySelector<HTMLElement>(".home")
  if (!main) return () => {}

  // Focus rings are for keyboard users only: remember the last input type so
  // script-restored focus after a mouse click never draws a ring.
  const setInput = (v: "keyboard" | "pointer") => () => (main.dataset.input = v)
  const onKey = setInput("keyboard")
  const onPointer = setInput("pointer")
  document.addEventListener("keydown", onKey, true)
  document.addEventListener("pointerdown", onPointer, true)

  const sound = initHomeSound(main)
  const clock = initClock(main)
  const fluid = createFluidHover(main)
  const drawer = initDrawer(main, {
    cue: (name) => sound.cue(name),
    onOpen: () => fluid.hide(),
  })

  return () => {
    document.removeEventListener("keydown", onKey, true)
    document.removeEventListener("pointerdown", onPointer, true)
    drawer?.destroy()
    fluid.destroy()
    sound.destroy()
    clock()
  }
}
