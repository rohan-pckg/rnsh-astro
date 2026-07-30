import { useState, type RefObject } from "react"

import DownloadMenu from "@/components/sketchbook/DownloadMenu"
import type { Tool } from "@/lib/sketchbook/types"
import { toolLabels, toolShortcuts } from "@/lib/sketchbook/constants"
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
  editorRef: RefObject<HTMLElement | null>
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
  editorRef,
}: DrawingToolbarProps) {
  const [isDownloadOpen, setIsDownloadOpen] = useState(false)

  return (
    <div
      className={`sketch-toolbar${isDownloadOpen ? "is-download-open" : ""}`}
      aria-label="Drawing tools"
    >
      <div
        className="sketch-control-group hover-list"
        aria-label="Drawing tools"
      >
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

      <div
        className="sketch-control-group hover-list"
        aria-label="Editing actions"
      >
        <button
          type="button"
          className="sketch-action hover-item"
          disabled={!canUndo}
          aria-label="Undo (Cmd/Ctrl+Z)"
          title="Undo (Cmd/Ctrl+Z)"
          onClick={onUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="sketch-action hover-item"
          disabled={!canRedo}
          aria-label="Redo (Shift+Cmd/Ctrl+Z)"
          title="Redo (Shift+Cmd/Ctrl+Z)"
          onClick={onRedo}
        >
          Redo
        </button>
        <button
          type="button"
          className="sketch-action hover-item"
          disabled={!canClear}
          aria-label="Clear all drawings"
          title="Clear all drawings"
          onClick={() => {
            if (!window.confirm("Clear all drawings?")) return
            onClear()
          }}
        >
          Clear
        </button>
      </div>

      <div className="sketch-control-group" aria-label="Export actions">
        <DownloadMenu
          items={exportItems}
          editorRef={editorRef}
          onOpenChange={setIsDownloadOpen}
        />
      </div>
    </div>
  )
}
