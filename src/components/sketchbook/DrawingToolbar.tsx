import {
  useRef,
  useState,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"

import type { Tool } from "@/lib/drawing"
import { toolLabels, toolShortcuts } from "@/lib/drawing"
import { sound } from "@/lib/sound"

type ExportItem = {
  label: string
  onExport: () => void
}

type DrawingToolbarProps = {
  tool: Tool
  onToolChange: (tool: Tool) => void
  canUndo: boolean
  canRedo: boolean
  canClear: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  exportItems: ExportItem[]
}

const tools: Tool[] = ["pen", "marker", "eraser"]

export default function DrawingToolbar({
  tool,
  onToolChange,
  canUndo,
  canRedo,
  canClear,
  onUndo,
  onRedo,
  onClear,
  exportItems,
}: DrawingToolbarProps) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const downloadButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isExportMenuOpen) return

    function closeExportMenu() {
      setIsExportMenuOpen(false)
      window.requestAnimationFrame(() => downloadButtonRef.current?.focus())
    }

    function onPointerDown(event: PointerEvent) {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        closeExportMenu()
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeExportMenu()
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    window.requestAnimationFrame(() =>
      exportMenuRef.current
        ?.querySelector<HTMLButtonElement>(".sketch-download-item")
        ?.focus()
    )

    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [isExportMenuOpen])

  function exportAndClose(exporter: () => void) {
    sound.play("open")
    exporter()
    setIsExportMenuOpen(false)
    window.requestAnimationFrame(() => downloadButtonRef.current?.focus())
  }

  function onDownloadMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        ".sketch-download-item"
      )
    )
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement
    )

    if (event.key === "ArrowDown") {
      event.preventDefault()
      items[(currentIndex + 1) % items.length]?.focus()
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      items[(currentIndex - 1 + items.length) % items.length]?.focus()
    }
  }

  return (
    <div className="sketch-toolbar" aria-label="Drawing tools">
      <div className="sketch-control-group hover-list" aria-label="Drawing tools">
        {tools.map((item) => (
          <button
            key={item}
            type="button"
            className="sketch-action hover-item"
            aria-pressed={tool === item}
            aria-label={`${toolLabels[item]} (${toolShortcuts[item]})`}
            title={`${toolLabels[item]} (${toolShortcuts[item]})`}
            onClick={() => {
              sound.play("tool-switch")
              onToolChange(item)
            }}
          >
            {toolLabels[item]}
          </button>
        ))}
      </div>

      <div className="sketch-control-group hover-list" aria-label="Editing actions">
        <button
          type="button"
          className="sketch-action hover-item"
          disabled={!canUndo}
          aria-label="Undo (Cmd/Ctrl+Z)"
          title="Undo (Cmd/Ctrl+Z)"
          onClick={() => {
            sound.play("back")
            onUndo()
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="sketch-action hover-item"
          disabled={!canRedo}
          aria-label="Redo (Shift+Cmd/Ctrl+Z)"
          title="Redo (Shift+Cmd/Ctrl+Z)"
          onClick={() => {
            sound.play("open")
            onRedo()
          }}
        >
          Redo
        </button>
        <button
          type="button"
          className="sketch-action hover-item"
          disabled={!canClear}
          aria-label="Clear"
          title="Clear"
          onClick={() => {
            sound.play("clear")
            onClear()
          }}
        >
          Clear
        </button>
      </div>

      <div className="sketch-control-group" aria-label="Export actions">
        <div className="sketch-download" ref={exportMenuRef}>
          <button
            ref={downloadButtonRef}
            type="button"
            className="sketch-action"
            aria-label="Download"
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
            title="Download"
            onClick={() => setIsExportMenuOpen((open) => !open)}
          >
            Download
          </button>

          {isExportMenuOpen ? (
            <>
              <button
                type="button"
                className="sketch-download-backdrop"
                aria-label="Close download menu"
                onClick={() => {
                  setIsExportMenuOpen(false)
                  window.requestAnimationFrame(() =>
                    downloadButtonRef.current?.focus()
                  )
                }}
              />
              <div
                className="sketch-download-menu"
                role="menu"
                onKeyDown={onDownloadMenuKeyDown}
              >
                <div className="sketch-download-title">Download</div>
                {exportItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="sketch-download-item"
                    role="menuitem"
                    onClick={() => exportAndClose(item.onExport)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
