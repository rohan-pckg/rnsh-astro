import { motion } from "motion/react"

import { scale, spring } from "@/lib/animations"

type Props = {
  fallbackHref?: string
}

export default function BackButton({ fallbackHref = "/writing" }: Props) {
  function goBack() {
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
      className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      variants={scale}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      transition={spring}
      onClick={goBack}
    >
      <i className="ri-arrow-left-line" aria-hidden="true" />
    </motion.button>
  )
}
