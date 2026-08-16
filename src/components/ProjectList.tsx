import type { PointerEvent } from "react"
import { sound } from "@/lib/sound"
import type { Project } from "@/data/projects"

export default function ProjectList({ projects }: { projects: Project[] }) {
  function handlePointerEnter(e: PointerEvent) {
    if (e.pointerType !== "mouse") return
    sound.play("tick", { volume: 0.06 })
  }

  function handleClick() {
    sound.play("navigate")
  }

  return (
    <div className="projects-list">
      {projects.map((project, index) => (
        <a
          key={`${project.title}-${index}`}
          href={project.href}
          className="project-item focus-ring"
          target={project.external ? "_blank" : undefined}
          rel={project.external ? "noopener noreferrer" : undefined}
          onPointerEnter={handlePointerEnter}
          onClick={handleClick}
        >
          <span className="project-title">{project.title}</span>
          <span className="project-description">{project.description}</span>
        </a>
      ))}
    </div>
  )
}
