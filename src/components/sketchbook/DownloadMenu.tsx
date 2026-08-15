import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { sound } from "@/lib/sound"
import { fadeTransition } from "@/lib/motion"

type ExportItem = {
  label: string
  onExport: () => void
}

type DownloadMenuProps = {
  items: ExportItem[]
  editorRef: RefObject<HTMLElement | null>
  onOpenChange?: (open: boolean) => void
}

function getPanelStyle(trigger: HTMLButtonElement | null): CSSProperties {
  if (!trigger) return {}

  const isMobile = window.matchMedia("(max-width: 767px)").matches
  if (isMobile) return {}

  const rect = trigger.getBoundingClientRect()
  return {
    top: `${rect.bottom + 12}px`,
    left: `${rect.left}px`,
  }
}

export default function DownloadMenu({
  items,
  editorRef,
  onOpenChange,
}: DownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const shouldReduceMotion = useReducedMotion()

  const close = useCallback(() => {
    setOpen(false)
    setPortalTarget(null)
    onOpenChange?.(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [onOpenChange])

  const openMenu = useCallback(() => {
    const target = editorRef.current
    if (!target) return

    setPanelStyle(getPanelStyle(triggerRef.current))
    setPortalTarget(target)
    setOpen(true)
    onOpenChange?.(true)
  }, [editorRef, onOpenChange])

  useEffect(() => {
    if (open) {
      document.body.classList.add("sketch-download-open")
    } else {
      document.body.classList.remove("sketch-download-open")
    }

    return () => document.body.classList.remove("sketch-download-open")
  }, [open])

  useEffect(() => {
    if (!open) return

    function onResize() {
      setPanelStyle(getPanelStyle(triggerRef.current))
    }

    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [open])

  useEffect(() => {
    if (!open) return

    window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus()
    })
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
        return
      }

      const menuItems = Array.from(
        panelRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]'
        ) ?? []
      )

      if (menuItems.length === 0) return

      const activeIndex = menuItems.indexOf(
        document.activeElement as HTMLButtonElement
      )

      if (event.key === "ArrowDown") {
        event.preventDefault()
        menuItems[(activeIndex + 1) % menuItems.length]?.focus()
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        menuItems[
          (activeIndex - 1 + menuItems.length) % menuItems.length
        ]?.focus()
      }

      if (event.key === "Tab") {
        event.preventDefault()
        const nextIndex = event.shiftKey
          ? (activeIndex - 1 + menuItems.length) % menuItems.length
          : (activeIndex + 1) % menuItems.length
        menuItems[nextIndex]?.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, close])

  function selectExport(exporter: () => void) {
    exporter()
    sound.play("open")
    close()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`sketch-action sketch-download-trigger${open ? "is-active" : ""}`}
        aria-label="Download"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Download"
        onClick={() => (open ? close() : openMenu())}
      >
        Download
      </button>

      {portalTarget
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <>
                  <motion.button
                    type="button"
                    className="sketch-download-scrim"
                    aria-label="Close download menu"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={fadeTransition(!!shouldReduceMotion)}
                    onClick={close}
                  />
                  <motion.div
                    ref={panelRef}
                    id={menuId}
                    role="menu"
                    aria-label="Download options"
                    className="sketch-download-panel"
                    style={panelStyle}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={fadeTransition(!!shouldReduceMotion)}
                  >
                    {items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        className="sketch-download-option"
                        onClick={() => selectExport(item.onExport)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            portalTarget
          )
        : null}
    </>
  )
}
