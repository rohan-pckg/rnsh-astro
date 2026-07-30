import getStroke from "perfect-freehand"

import { PAPER_COLOR, toolOptions } from "./constants"
import { denormalizePoints } from "./coordinates"
import type { Stroke } from "./types"

function getStrokePath(points: number[][]) {
  if (points.length < 1) return ""

  const first = points[0]
  const d = [`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`]

  for (let i = 1; i < points.length; i += 1) {
    const current = points[i]
    const next = points[i + 1]

    if (next) {
      const x = (current[0] + next[0]) / 2
      const y = (current[1] + next[1]) / 2
      d.push(
        `Q ${current[0].toFixed(2)} ${current[1].toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`
      )
    } else {
      d.push(`L ${current[0].toFixed(2)} ${current[1].toFixed(2)}`)
    }
  }

  return `${d.join(" ")} Z`
}

function strokeOutline(stroke: Stroke, width: number, height: number) {
  const absolute = denormalizePoints(stroke.points, width, height)
  const options = toolOptions[stroke.tool]
  return getStroke(absolute, {
    size: stroke.width,
    thinning: options.thinning,
    smoothing: options.smoothing,
    streamline: options.streamline,
    simulatePressure: options.simulatePressure,
  })
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number
) {
  if (stroke.points.length === 0) return

  const outline = strokeOutline(stroke, width, height)
  const path = new Path2D(getStrokePath(outline))

  ctx.save()
  ctx.fillStyle = stroke.color
  ctx.globalAlpha = stroke.opacity
  ctx.fill(path)
  ctx.restore()
}

export function renderStrokes(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  draftStroke: Stroke | null,
  width: number,
  height: number
) {
  const dpr = window.devicePixelRatio || 1
  width = Math.max(1, width)
  height = Math.max(1, height)

  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = PAPER_COLOR
  ctx.fillRect(0, 0, width, height)

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, width, height)
  }

  if (draftStroke) {
    drawStroke(ctx, draftStroke, width, height)
  }
}

export function getStrokesAsSvg(
  strokes: Stroke[],
  width: number,
  height: number
) {
  const paths = strokes
    .map((stroke) => {
      const outline = strokeOutline(stroke, width, height)
      return `<path d="${getStrokePath(outline)}" fill="${stroke.color}" opacity="${stroke.opacity}" />`
    })
    .join("")

  return `<rect width="100%" height="100%" fill="${PAPER_COLOR}" />${paths}`
}

export function renderToOffscreenCanvas(
  strokes: Stroke[],
  draftStroke: Stroke | null,
  width: number,
  height: number
) {
  const canvas = document.createElement("canvas")
  renderStrokes(canvas, strokes, draftStroke, width, height)
  return canvas
}
