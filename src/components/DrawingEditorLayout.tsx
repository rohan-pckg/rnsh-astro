import type { ReactNode, RefObject } from "react"

export function DrawingEditorLayout({
  children,
  editorRef,
}: {
  children: ReactNode
  editorRef?: RefObject<HTMLElement | null>
}) {
  return (
    <section
      ref={editorRef}
      className="sketch-editor relative space-y-6"
      aria-label="Drawing editor"
    >
      {children}
    </section>
  )
}
