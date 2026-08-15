import type { Transition } from "motion/react"

/**
 * Shared motion tokens. Every component should pull its timing from here
 * rather than inventing inline values, so the whole site moves at the same
 * pace. Modeled on the Fluid Functionalism "springs" approach: three named
 * speeds, exits one tier faster than entrances.
 */
export const springs: Record<"fast" | "moderate" | "slow", Transition> = {
  fast: { type: "spring", stiffness: 520, damping: 40, mass: 0.7 },
  moderate: { type: "spring", stiffness: 320, damping: 28, mass: 0.9 },
  slow: { type: "spring", stiffness: 170, damping: 22, mass: 1.1 },
}

export const durations = {
  fast: 0.15,
  moderate: 0.25,
  slow: 0.35,
} as const

export const easings: { out: [number, number, number, number] } = {
  out: [0.22, 1, 0.36, 1],
}

/** Entrance/exit fade used by overlay panels. Collapses to zero under reduced motion. */
export function fadeTransition(reduced: boolean): Transition {
  return reduced
    ? { duration: 0 }
    : { duration: durations.fast, ease: easings.out }
}
