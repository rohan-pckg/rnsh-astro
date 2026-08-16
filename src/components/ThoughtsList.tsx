import type { PointerEvent } from "react"
import { sound } from "@/lib/sound"

type Thought = {
  href: string
  title: string
  date: string
}

export default function ThoughtsList({ thoughts }: { thoughts: Thought[] }) {
  function handlePointerEnter(e: PointerEvent) {
    if (e.pointerType !== "mouse") return
    sound.play("tick", { volume: 0.06 })
  }

  function handleClick() {
    sound.play("navigate")
  }

  return (
    <div className="thoughts-list">
      {thoughts.map((thought) => (
        <a
          key={thought.href}
          href={thought.href}
          className="thought-item focus-ring"
          onPointerEnter={handlePointerEnter}
          onClick={handleClick}
        >
          <span className="thought-title">{thought.title}</span>
          <span className="thought-date">{thought.date}</span>
        </a>
      ))}
    </div>
  )
}
