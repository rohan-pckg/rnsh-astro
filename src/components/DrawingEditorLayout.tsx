import type { ReactNode } from "react"

export function DrawingEditorLayout({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-6" aria-label="Drawing editor">
      {children}
    </section>
  )
}
