import { toolOptions } from "./constants"
import type { Point, Stroke } from "./types"

function pointDistance(a: Point, b: Point, width: number, height: number) {
  const dx = (a[0] - b[0]) * width
  const dy = (a[1] - b[1]) * height
  return Math.hypot(dx, dy)
}

function isPointErased(
  point: Point,
  eraserPoints: Point[],
  radius: number,
  width: number,
  height: number
) {
  for (const eraserPoint of eraserPoints) {
    if (pointDistance(point, eraserPoint, width, height) <= radius) {
      return true
    }
  }
  return false
}

function splitStroke(
  stroke: Stroke,
  eraserPoints: Point[],
  radius: number,
  width: number,
  height: number
): Stroke[] {
  const chunks: Point[][] = []
  let current: Point[] = []

  for (const point of stroke.points) {
    if (isPointErased(point, eraserPoints, radius, width, height)) {
      if (current.length > 1) chunks.push(current)
      current = []
      continue
    }
    current.push(point)
  }

  if (current.length > 1) chunks.push(current)

  return chunks.map((points) => ({
    ...stroke,
    id: crypto.randomUUID(),
    points,
  }))
}

export function eraseStrokes(
  strokes: Stroke[],
  eraserPoints: Point[],
  width: number,
  height: number
): Stroke[] {
  if (eraserPoints.length === 0) return strokes

  const radius = toolOptions.eraser.size / 2
  const next: Stroke[] = []

  for (const stroke of strokes) {
    next.push(...splitStroke(stroke, eraserPoints, radius, width, height))
  }

  return next
}
