import {
  useRef,
  useState,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"

import type { Tool } from "@/lib/drawing"
import { toolLabels, toolShortcuts } from "@/lib/drawing"

type DoodleIconName =
  | "pen"
  | "marker"
  | "eraser"
  | "undo"
  | "redo"
  | "trash"
  | "download"

type ExportItem = {
  label: string
  onExport: () => void
}

type DrawingToolbarProps = {
  tool: Tool
  onToolChange: (tool: Tool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  exportItems: ExportItem[]
}

const tools: Tool[] = ["pen", "marker", "eraser"]

const toolIcons: Record<Tool, DoodleIconName> = {
  pen: "pen",
  marker: "marker",
  eraser: "eraser",
}

function DoodleIcon({ name }: { name: DoodleIconName }) {
  return (
    <svg className="doodle-icon doodle-icon--lg" aria-hidden="true">
      <use href={`#doodle-${name}`} />
    </svg>
  )
}

export default function DrawingToolbar({
  tool,
  onToolChange,
  canUndo,
  canRedo,
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

    if (event.key === "Home") {
      event.preventDefault()
      items[0]?.focus()
    }

    if (event.key === "End") {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  return (
    <div className="sketch-toolbar" aria-label="Drawing tools">
      <div className="sketch-control-group" aria-label="Drawing tools">
        {tools.map((item) => (
          <button
            key={item}
            type="button"
            className="sketch-action"
            aria-pressed={tool === item}
            aria-label={`${toolLabels[item]} (${toolShortcuts[item]})`}
            title={`${toolLabels[item]} (${toolShortcuts[item]})`}
            data-tooltip={`${toolLabels[item]} (${toolShortcuts[item]})`}
            onClick={() => onToolChange(item)}
          >
            <DoodleIcon name={toolIcons[item]} />
          </button>
        ))}
      </div>

      <div className="sketch-toolbar-divider" aria-hidden="true" />

      <div className="sketch-control-group" aria-label="Editing actions">
        <button
          type="button"
          className="sketch-action"
          disabled={!canUndo}
          aria-label="Undo (Cmd/Ctrl+Z)"
          title="Undo (Cmd/Ctrl+Z)"
          data-tooltip="Undo (Cmd/Ctrl+Z)"
          onClick={onUndo}
        >
          <DoodleIcon name="undo" />
        </button>
        <button
          type="button"
          className="sketch-action"
          disabled={!canRedo}
          aria-label="Redo (Shift+Cmd/Ctrl+Z)"
          title="Redo (Shift+Cmd/Ctrl+Z)"
          data-tooltip="Redo (Shift+Cmd/Ctrl+Z)"
          onClick={onRedo}
        >
          <DoodleIcon name="redo" />
        </button>
        <button
          type="button"
          className="sketch-action"
          disabled={!canUndo}
          aria-label="Clear"
          title="Clear"
          data-tooltip="Clear"
          onClick={onClear}
        >
          <DoodleIcon name="trash" />
        </button>
      </div>

      <div className="sketch-toolbar-divider" aria-hidden="true" />

      <div
        className="sketch-control-group sketch-export-group"
        aria-label="Export actions"
      >
        <div className="sketch-download" ref={exportMenuRef}>
          <button
            ref={downloadButtonRef}
            type="button"
            className="sketch-action"
            aria-label="Download"
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
            title="Download"
            data-tooltip="Download"
            onClick={() => setIsExportMenuOpen((open) => !open)}
          >
            <DoodleIcon name="download" />
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
