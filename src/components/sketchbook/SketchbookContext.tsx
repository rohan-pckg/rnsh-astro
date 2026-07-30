import { createContext, useContext } from "react"

import type { Stroke, Tool } from "@/lib/sketchbook/types"

export type SketchbookContextValue = {
  tool: Tool
  strokes: Stroke[]
  isDrawing: boolean
  canUndo: boolean
  canRedo: boolean
  canClear: boolean
  setTool: (tool: Tool) => void
  getDraftStroke: () => Stroke | null
  beginStroke: (
    event: React.PointerEvent<HTMLCanvasElement>,
    width: number,
    height: number
  ) => void
  updateStroke: (
    event: React.PointerEvent<HTMLCanvasElement>,
    width: number,
    height: number
  ) => void
  finishStroke: (
    event: React.PointerEvent<HTMLCanvasElement>,
    width: number,
    height: number
  ) => void
  undo: () => void
  redo: () => void
  clear: () => void
  exportPng: (width: number, height: number) => void
  exportSvg: (width: number, height: number) => void
  exportPdf: (width: number, height: number) => void
}

export const SketchbookContext = createContext<SketchbookContextValue | null>(
  null
)

export function useSketchbook() {
  const context = useContext(SketchbookContext)
  if (!context) {
    throw new Error("useSketchbook must be used within SketchbookProvider")
  }
  return context
}
