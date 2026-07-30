import type { Tool } from "./types"

export const PAPER_COLOR = "#EFEBE3"
export const INK_COLOR = "#000000"
export const MARKER_COLOR = "#3a3a3a"

export const STORAGE_KEY = "sketchbook-strokes"

export const toolLabels: Record<Tool, string> = {
  pen: "Pen",
  marker: "Marker",
  eraser: "Eraser",
}

export const toolShortcuts: Record<Tool, string> = {
  pen: "P",
  marker: "M",
  eraser: "E",
}

export const toolOptions: Record<
  Tool,
  {
    size: number
    thinning: number
    smoothing: number
    streamline: number
    simulatePressure: boolean
    color: string
    opacity: number
  }
> = {
  pen: {
    size: 4,
    thinning: 0.45,
    smoothing: 0.62,
    streamline: 0.5,
    simulatePressure: true,
    color: INK_COLOR,
    opacity: 0.92,
  },
  marker: {
    size: 20,
    thinning: 0.2,
    smoothing: 0.68,
    streamline: 0.56,
    simulatePressure: true,
    color: MARKER_COLOR,
    opacity: 0.4,
  },
  eraser: {
    size: 32,
    thinning: 0.08,
    smoothing: 0.5,
    streamline: 0.42,
    simulatePressure: true,
    color: PAPER_COLOR,
    opacity: 1,
  },
}
