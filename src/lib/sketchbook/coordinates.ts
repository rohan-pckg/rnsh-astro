import { toolOptions } from "./constants"
import type { Point, Stroke } from "./types"

function isLegacyPoint(point: Point) {
  return point[0] > 1 || point[1] > 1
}

function normalizeLegacyPoints(points: Point[]): Point[] {
  if (!points.some(isLegacyPoint)) return points

  let maxX = 1
  let maxY = 1
  for (const point of points) {
    maxX = Math.max(maxX, point[0])
    maxY = Math.max(maxY, point[1])
  }

  return points.map((point) => [
    maxX > 0 ? point[0] / maxX : 0,
    maxY > 0 ? point[1] / maxY : 0,
    point[2],
  ])
}

export function normalizePoint(
  x: number,
  y: number,
  pressure: number,
  width: number,
  height: number
): Point {
  return [width > 0 ? x / width : 0, height > 0 ? y / height : 0, pressure]
}

export function denormalizePoint(
  point: Point,
  width: number,
  height: number
): Point {
  return [point[0] * width, point[1] * height, point[2]]
}

export function denormalizePoints(
  points: Point[],
  width: number,
  height: number
): Point[] {
  return points.map((point) => denormalizePoint(point, width, height))
}

export function migrateLegacyStrokes(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []

    const record = item as Record<string, unknown>
    const tool = record.tool
    const points = record.points

    if (
      (tool !== "pen" && tool !== "marker" && tool !== "eraser") ||
      !Array.isArray(points) ||
      points.length === 0
    ) {
      return []
    }

    if (tool === "eraser") return []

    const options = toolOptions[tool]
    const normalizedPoints = normalizeLegacyPoints(points as Point[])

    return [
      {
        id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
        tool,
        color: typeof record.color === "string" ? record.color : options.color,
        width: typeof record.width === "number" ? record.width : options.size,
        opacity:
          typeof record.opacity === "number" ? record.opacity : options.opacity,
        points: normalizedPoints,
      },
    ]
  })
}
