import { useEffect, useRef } from "react"
import { motion, useReducedMotion } from "motion/react"
import { springs } from "../lib/motion"

type Thought = {
  href: string
  title: string
  date: string
}

export default function ThoughtsList({ thoughts }: { thoughts: Thought[] }) {
  const reducedMotion = useReducedMotion()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotion) return
    listRef.current
      ?.querySelectorAll<HTMLElement>(".thought-item")
      .forEach((el) => {
        el.setAttribute("data-cuelume-hover", "tick")
      })
  }, [reducedMotion])

  return (
    <div className="thoughts-list" ref={listRef}>
      {thoughts.map((thought) => (
        <motion.a
          key={thought.href}
          href={thought.href}
          className="thought-item focus-ring"
          data-sound="navigate"
          whileHover={reducedMotion ? undefined : { x: 3 }}
          transition={springs.fast}
        >
          <span className="thought-title">{thought.title}</span>
          <span className="thought-date">{thought.date}</span>
        </motion.a>
      ))}
    </div>
  )
}
