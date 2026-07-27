import type { Stroke } from "@/lib/drawing"
import { getStroke, getStrokePath, toolOptions } from "@/lib/drawing"

export const POSTCARD_RATIO = 3 / 2
export const DRAWING_FRACTION = 0.62
export const DRAWING_PADDING = 0.07
export const POSTCARD_WIDTH = 760
export const POSTCARD_HEIGHT = POSTCARD_WIDTH / POSTCARD_RATIO
export const DRAWING_HEIGHT = POSTCARD_HEIGHT * DRAWING_FRACTION

export type PostcardTemplateId =
  | "classic"
  | "polaroid"
  | "notebook"
  | "sticky-note"
  | "letter"

export type PostcardTheme = {
  id: PostcardTemplateId
  label: string
  description: string
  paper: string
  ink: string
  marker: string
  border: string
  margin: number
  background: (width: number, height: number, drawingHeight: number) => string
}

export type PostcardDrawing = {
  strokes: Stroke[]
}

export type PostcardData = {
  drawing: PostcardDrawing
  message: string
  author: string
  theme: PostcardTheme
}

function classicBackground(width: number) {
  return `<rect width="${width}" height="100%" rx="8" fill="#faf6f0"/><path d="M 0 18 H ${width}" stroke="#fff" stroke-opacity=".45"/>`
}

function polaroidBackground(
  width: number,
  height: number,
  drawingHeight: number
) {
  return `<rect width="${width}" height="${height}" fill="#fff"/><rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="#fff"/><rect x="12" y="12" width="${width - 24}" height="${drawingHeight - 12}" fill="#fbfaf8"/>`
}

function notebookBackground(width: number, height: number) {
  const lines = Array.from({ length: 12 }, (_, index) => {
    const lineY = 24 + index * 25
    return `<path d="M 0 ${lineY} H ${width}" stroke="#9bb4c7" stroke-opacity=".28" />`
  }).join("")
  const holes = Array.from({ length: 5 }, (_, index) => {
    const holeY = 44 + index * 54
    return `<circle cx="20" cy="${holeY}" r="5" fill="#e8e1d5" stroke="#d1c7b7" />`
  }).join("")
  return `<rect width="${width}" height="${height}" fill="#fffdf5"/>${lines}${holes}`
}

function stickyNoteBackground(width: number) {
  return `<rect width="${width}" height="100%" rx="4" fill="#f8ed9c"/><path d="M ${width - 56} 0 H ${width} V 56 Z" fill="#e8d878"/><path d="M ${width - 56} 0 L ${width} 56 L ${width - 56} 56 Z" fill="#d9c765" opacity=".65"/>`
}

function letterBackground(width: number, height: number) {
  return `<rect width="${width}" height="${height}" fill="#f8f1e4"/><rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="none" stroke="#ded2c0" stroke-opacity=".6"/>`
}

export const postcardThemes: Record<PostcardTemplateId, PostcardTheme> = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Warm paper and a quiet editorial layout.",
    paper: "#faf6f0",
    ink: "#2c2c2c",
    marker: "#a95f48",
    border: "#e0d8cc",
    margin: 32,
    background: classicBackground,
  },
  polaroid: {
    id: "polaroid",
    label: "Polaroid",
    description: "A white instant-photo frame with room to sign.",
    paper: "#ffffff",
    ink: "#282828",
    marker: "#9d634c",
    border: "#ece7df",
    margin: 32,
    background: polaroidBackground,
  },
  notebook: {
    id: "notebook",
    label: "Notebook",
    description: "Ruled paper with the charm of a torn-out page.",
    paper: "#fffdf5",
    ink: "#26323a",
    marker: "#5d7892",
    border: "#d8d1c4",
    margin: 32,
    background: notebookBackground,
  },
  "sticky-note": {
    id: "sticky-note",
    label: "Sticky Note",
    description: "A soft yellow note with a folded corner.",
    paper: "#f8ed9c",
    ink: "#4b4228",
    marker: "#b47a39",
    border: "#e2cf71",
    margin: 32,
    background: stickyNoteBackground,
  },
  letter: {
    id: "letter",
    label: "Letter",
    description: "Cream paper with generous, handwritten margins.",
    paper: "#f8f1e4",
    ink: "#3b332c",
    marker: "#96705d",
    border: "#ded2c0",
    margin: 48,
    background: letterBackground,
  },
}

export const postcardTemplateList = Object.values(postcardThemes)

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

function getFittedOutlines(
  outlines: number[][][],
  width: number,
  height: number
) {
  const bounds = outlines.reduce<Bounds>(
    (current, outline) =>
      outline.reduce(
        (next, point) => ({
          minX: Math.min(next.minX, point[0] ?? next.minX),
          minY: Math.min(next.minY, point[1] ?? next.minY),
          maxX: Math.max(next.maxX, point[0] ?? next.maxX),
          maxY: Math.max(next.maxY, point[1] ?? next.maxY),
        }),
        current
      ),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return outlines
  }

  const sourceWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const sourceHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const contentWidth = Math.max(width * (1 - DRAWING_PADDING * 2), 1)
  const contentHeight = Math.max(height * (1 - DRAWING_PADDING * 2), 1)
  const scale = Math.min(
    contentWidth / sourceWidth,
    contentHeight / sourceHeight
  )
  const offsetX = (width - sourceWidth * scale) / 2 - bounds.minX * scale
  const offsetY = (height - sourceHeight * scale) / 2 - bounds.minY * scale

  return outlines.map((outline) =>
    outline.map((point) => [
      (point[0] ?? 0) * scale + offsetX,
      (point[1] ?? 0) * scale + offsetY,
    ])
  )
}

export function getFittedDrawingPaths(
  strokes: Stroke[],
  width = POSTCARD_WIDTH,
  height = DRAWING_HEIGHT
) {
  const outlines = strokes.map((stroke) =>
    getStroke(stroke.points, {
      ...toolOptions[stroke.tool],
      simulatePressure: true,
    })
  )
  const fitted = getFittedOutlines(outlines, width, height)

  return strokes.map((stroke, index) => ({
    d: getStrokePath(fitted[index] ?? []),
    fill: stroke.tool === "eraser" ? "paper" : "ink",
    opacity: stroke.tool === "marker" ? 0.32 : 0.92,
  }))
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function textLines(value: string, maxCharacters: number) {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && next.length > maxCharacters) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawingSvg(data: PostcardData, width: number, height: number) {
  const paths = getFittedDrawingPaths(data.drawing.strokes, width, height)
    .map(
      (path) =>
        `<path d="${path.d}" fill="${path.fill === "paper" ? data.theme.paper : data.theme.ink}" opacity="${path.opacity}" />`
    )
    .join("")
  return `<g>${paths}</g>`
}

export function renderPostcardSvg(data: PostcardData, width = POSTCARD_WIDTH) {
  const height = width / POSTCARD_RATIO
  const bodyTop = DRAWING_HEIGHT * (width / POSTCARD_WIDTH)
  const lines = textLines(data.message, Math.max(18, Math.floor(width / 18)))
  const textMarkup = lines
    .map(
      (line, index) =>
        `<tspan x="${data.theme.margin}" dy="${index ? 28 : 0}">${escapeXml(line)}</tspan>`
    )
    .join("")
  const body = data.message
    ? `<text y="${bodyTop + 40}" fill="${data.theme.ink}" font-family="Caveat, cursive" font-size="22">${textMarkup}</text>`
    : ""
  const author = data.author
    ? `<text x="${width - data.theme.margin}" y="${height - 30}" text-anchor="end" fill="${data.theme.ink}" font-family="Caveat, cursive" font-size="20">~ ${escapeXml(data.author)}</text>`
    : ""
  const divider = `<path d="M ${data.theme.margin} ${height - 64} H ${width - data.theme.margin}" stroke="${data.theme.border}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${data.theme.background(width, height, bodyTop)}<g>${drawingSvg(data, width, bodyTop)}</g>${divider}${body}${author}</svg>`
}
