import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react"
import { useEffect } from "react"

import { spring } from "@/lib/animations"

export default function ReadingProgress() {
  const progress = useMotionValue(0)
  const smoothProgress = useSpring(progress, spring)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY
      const max =
        document.documentElement.scrollHeight - window.innerHeight || 1
      progress.set(Math.min(1, Math.max(0, scrollTop / max)))
    }

    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)

    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [progress])

  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 z-50 h-0.5 w-full origin-left bg-foreground"
      style={{ scaleX: reduceMotion ? progress : smoothProgress }}
    />
  )
}
