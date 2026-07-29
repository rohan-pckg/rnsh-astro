import getStroke_ from "perfect-freehand"

export type Tool = "pen" | "marker" | "eraser"
export type Point = [number, number, number]
export type Stroke = {
  id: string
  tool: Tool
  points: Point[]
}

export const toolOptions: Record<
  Tool,
  { size: number; thinning: number; smoothing: number; streamline: number }
> = {
  pen: { size: 4, thinning: 0.45, smoothing: 0.62, streamline: 0.5 },
  marker: { size: 14, thinning: 0.2, smoothing: 0.68, streamline: 0.56 },
  eraser: { size: 26, thinning: 0.08, smoothing: 0.5, streamline: 0.42 },
}

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

export function getStrokePath(points: number[][]) {
  if (points.length < 1) return ""

  const first = points[0]
  if (!first) return ""

  const d = [`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`]

  for (let i = 1; i < points.length; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    if (!current) continue

    if (next) {
      const x = (current[0] + next[0]) / 2
      const y = (current[1] + next[1]) / 2
      d.push(
        `Q ${current[0].toFixed(2)} ${current[1].toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`,
      )
    } else {
      d.push(`L ${current[0].toFixed(2)} ${current[1].toFixed(2)}`)
    }
  }

  return `${d.join(" ")} Z`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  palette: { ink: string; marker: string; paper: string },
) {
      const outline = getStroke_(stroke.points, {
    ...toolOptions[stroke.tool],
    simulatePressure: true,
  })
  const path = new Path2D(getStrokePath(outline))

  ctx.save()
  if (stroke.tool === "eraser") {
    ctx.fillStyle = palette.paper
    ctx.globalAlpha = 1
  } else if (stroke.tool === "marker") {
    ctx.fillStyle = palette.marker
    ctx.globalAlpha = 0.32
  } else {
    ctx.fillStyle = palette.ink
    ctx.globalAlpha = 0.92
  }
  ctx.fill(path)
  ctx.restore()
}

export function renderStrokesToCanvas(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  currentStroke: Stroke | null,
  width?: number,
  height?: number,
) {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const w = width ?? rect.width
  const h = height ?? rect.height
  canvas.width = Math.max(1, Math.round(w * dpr))
  canvas.height = Math.max(1, Math.round(h * dpr))

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const styles = window.getComputedStyle(canvas)
  const palette = {
    paper: styles.backgroundColor,
    ink: styles.color,
    marker: styles.color,
  }

  ctx.fillStyle = palette.paper
  ctx.fillRect(0, 0, w, h)

  strokes.forEach((s) => drawStroke(ctx, s, palette))
  if (currentStroke) drawStroke(ctx, currentStroke, palette)
}

export function getStrokesAsSvg(
  strokes: Stroke[],
  _width: number,
  _height: number,
  paper: string,
  ink: string,
) {
  const paths = strokes
    .map((stroke) => {
  const outline = getStroke_(stroke.points, {
        ...toolOptions[stroke.tool],
        simulatePressure: true,
      })
      const fill = stroke.tool === "eraser" ? paper : ink
      const opacity = stroke.tool === "marker" ? 0.32 : 0.92
      return `<path d="${getStrokePath(outline)}" fill="${fill}" opacity="${opacity}" />`
    })
    .join("")

  return `<rect width="100%" height="100%" fill="${paper}" />${paths}`
}

export function makePdfFromCanvas(
  canvas: HTMLCanvasElement,
  pageWidth = 760,
) {
  const width = canvas.width
  const height = canvas.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const imageData = ctx.getImageData(0, 0, width, height).data
  const rgb = new Uint8Array(width * height * 3)

  for (let i = 0, j = 0; i < imageData.length; i += 4, j += 3) {
    rgb[j] = imageData[i] ?? 255
    rgb[j + 1] = imageData[i + 1] ?? 255
    rgb[j + 2] = imageData[i + 2] ?? 255
  }

  const pageHeight = Math.round((height / width) * pageWidth)
  const encoder = new TextEncoder()
  const chunks: BlobPart[] = []
  const offsets: number[] = [0]
  let cursor = 0

  function push(value: string | Uint8Array) {
    const chunk = typeof value === "string" ? encoder.encode(value) : value
    const copy = new Uint8Array(chunk.length)
    copy.set(chunk)
    chunks.push(copy.buffer)
    cursor += chunk.length
  }

  function object(
    id: number,
    body: string | Uint8Array,
    prefix = "",
    suffix = "",
  ) {
    offsets[id] = cursor
    push(`${id} 0 obj\n`)
    if (prefix) push(prefix)
    push(body)
    if (suffix) push(suffix)
    push("\nendobj\n")
  }

  push("%PDF-1.4\n")
  object(1, "<< /Type /Catalog /Pages 2 0 R >>")
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  )
  object(
    4,
    rgb,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>\nstream\n`,
    "\nendstream",
  )

  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`
  object(
    5,
    content,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n`,
    "endstream",
  )

  const xref = cursor
  push(`xref\n0 6\n0000000000 65535 f \n`)
  for (let i = 1; i <= 5; i += 1) {
    push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`)
  }
  push(`trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`)

  return new Blob(chunks, { type: "application/pdf" })
}
