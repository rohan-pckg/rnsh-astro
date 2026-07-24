import type { Variants } from "motion/react"

export const spring = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
} as const

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
}

export const stagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
    },
  },
}

export const scale: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 0.98 },
}

export const pageTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
} as const
