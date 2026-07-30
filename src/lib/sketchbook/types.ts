export type Tool = "pen" | "marker" | "eraser"

/** Normalized coordinates: x and y are 0–1 relative to canvas size; z is pressure. */
export type Point = [number, number, number]

export type Stroke = {
  id: string
  tool: Tool
  color: string
  width: number
  opacity: number
  points: Point[]
}

export type CanvasSize = {
  width: number
  height: number
}
