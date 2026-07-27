import { motion } from "motion/react"

import { scale, spring } from "@/lib/animations"
import { playSound } from "@/lib/sound"

type Props = {
  fallbackHref?: string
}

export default function BackButton({ fallbackHref = "/writing" }: Props) {
  function goBack() {
    playSound("navigation")

    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.href = fallbackHref
  }

  return (
    <motion.button
      type="button"
      aria-label="Go back"
      className="surface-button"
      variants={scale}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      transition={spring}
      onClick={goBack}
    >
      <svg className="doodle-icon" aria-hidden="true">
        <use href="#doodle-arrow-left" />
      </svg>
    </motion.button>
  )
}
