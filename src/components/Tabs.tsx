import { useId, useRef, type ReactNode } from "react"

export type TabItem = {
  /** Stable identity, also used to wire the tab to its panel. */
  id: string
  label: string
}

type TabsProps = {
  /** Names the group for assistive tech, e.g. "About sections". */
  label: string
  items: readonly TabItem[]
  /** Which tab is selected. The caller owns the state. */
  value: string
  onValueChange: (id: string) => void
  /** The selected panel's content. */
  children: ReactNode
  className?: string
}

/**
 * Tabs.
 *
 * One widget for the whole site, so a second tabbed section is a matter of
 * passing different `items` — not a second copy of the styling or of the
 * keyboard handling.
 *
 * Follows the WAI-ARIA tabs pattern with automatic activation: arrow keys move
 * between tabs and select as they go, Home/End jump to the ends, and only the
 * selected tab is in the tab order, so Tab moves past the group rather than
 * through it. The styling lives in `.tablist` / `.tab` / `.tabpanel`.
 */
export default function Tabs({
  label,
  items,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const base = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function focusTab(id: string) {
    onValueChange(id)
    refs.current[id]?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const index = items.findIndex((item) => item.id === value)
    if (index === -1) return

    let next: number | null = null
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % items.length
        break
      case "ArrowLeft":
        next = (index - 1 + items.length) % items.length
        break
      case "Home":
        next = 0
        break
      case "End":
        next = items.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    focusTab(items[next].id)
  }

  return (
    <div className={["tabs", className].filter(Boolean).join(" ")}>
      <div className="tablist" role="tablist" aria-label={label}>
        {items.map((item) => {
          const selected = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${base}-${item.id}`}
              className="tab"
              aria-selected={selected}
              aria-controls={`panel-${base}-${item.id}`}
              tabIndex={selected ? 0 : -1}
              ref={(element) => {
                refs.current[item.id] = element
              }}
              onClick={() => onValueChange(item.id)}
              onKeyDown={onKeyDown}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${base}-${value}`}
        aria-labelledby={`tab-${base}-${value}`}
        className="tabpanel"
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  )
}