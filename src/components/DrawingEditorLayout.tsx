import { type ReactNode, type RefObject } from "react"

export function DrawingEditorLayout({
  children,
  editorRef,
}: {
  children: ReactNode
  editorRef?: RefObject<HTMLElement | null>
}) {
  return (
    <section ref={editorRef} className="sketch-editor" aria-label="Drawing editor">
      {children}
    </section>
  )
}