import type { ReactNode } from "react"

export function SketchbookFooterCallout({
  children,
}: {
  children?: ReactNode
}) {
  return (
    <p className="body-text text-muted-foreground">
      {children ?? (
        <>
          Want to leave something more personal?{" "}
          <a
            href="/postcards/new"
            data-sound-category="navigation"
            className="underline decoration-border decoration-1 underline-offset-2 transition-colors duration-200 ease-in-out hover:decoration-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            Create a postcard instead.
          </a>
        </>
      )}
    </p>
  )
}
