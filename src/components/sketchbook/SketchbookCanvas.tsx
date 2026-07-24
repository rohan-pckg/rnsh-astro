import getStroke from "perfect-freehand"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { playSound } from "@/lib/sound"

type Tool = "pen" | "marker" | "eraser"
type Point = [number, number, number]

type Stroke = {
  id: string
  tool: Tool
  points: Point[]
}

const STORAGE_KEY = "sketchbook-strokes"
const DEFAULT_SIZE = { width: 760, height: 540 }

const toolLabels: Record<Tool, string> = {
  pen: "Pen",
  marker: "Marker",
  eraser: "Eraser",
}

const toolOptions: Record<
  Tool,
  {
    size: number
    thinning: number
    smoothing: number
    streamline: number
  }
> = {
  pen: { size: 4, thinning: 0.45, smoothing: 0.62, streamline: 0.5 },
  marker: { size: 14, thinning: 0.2, smoothing: 0.68, streamline: 0.56 },
  eraser: { size: 26, thinning: 0.08, smoothing: 0.5, streamline: 0.42 },
}

function getStrokePath(points: number[][]) {
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
        `Q ${current[0].toFixed(2)} ${current[1].toFixed(2)} ${x.toFixed(
          2
        )} ${y.toFixed(2)}`
      )
    } else {
      d.push(`L ${current[0].toFixed(2)} ${current[1].toFixed(2)}`)
    }
  }

  return `${d.join(" ")} Z`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function makePdfFromCanvas(canvas: HTMLCanvasElement) {
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

  const pageWidth = DEFAULT_SIZE.width
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

  function object(id: number, body: string | Uint8Array, prefix = "", suffix = "") {
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
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  )
  object(
    4,
    rgb,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>\nstream\n`,
    "\nendstream"
  )

  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`
  object(5, content, `<< /Length ${encoder.encode(content).length} >>\nstream\n`, "endstream")

  const xref = cursor
  push(`xref\n0 6\n0000000000 65535 f \n`)
  for (let i = 1; i <= 5; i += 1) {
    push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`)
  }
  push(`trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`)

  return new Blob(chunks, { type: "application/pdf" })
}

export default function SketchbookCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const [tool, setTool] = useState<Tool>("pen")
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  const canUndo = strokes.length > 0
  const canRedo = redoStack.length > 0

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) setStrokes(JSON.parse(saved) as Stroke[])
    } catch {
      setStrokes([])
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(strokes))
  }, [strokes])

  const drawStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      stroke: Stroke,
      palette: { ink: string; marker: string; paper: string }
    ) => {
      const outline = getStroke(stroke.points, {
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
    },
    []
  )

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))

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
    ctx.fillRect(0, 0, rect.width, rect.height)

    strokes.forEach((stroke) => drawStroke(ctx, stroke, palette))
    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current, palette)
    }
  }, [drawStroke, strokes])

  useEffect(() => {
    render()
  }, [render])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => render())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [render])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMod = event.metaKey || event.ctrlKey

      if (isMod && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault()
        redo()
        return
      }

      if (isMod && event.key.toLowerCase() === "z") {
        event.preventDefault()
        undo()
        return
      }

      if (event.key.toLowerCase() === "p") setTool("pen")
      if (event.key.toLowerCase() === "e") setTool("eraser")
      if (event.key === "Escape") setTool("pen")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return [
      event.clientX - rect.left,
      event.clientY - rect.top,
      event.pressure > 0 ? event.pressure : 0.45,
    ]
  }

  function beginStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    playSound("draw")
    const point = pointFromEvent(event)
    currentStrokeRef.current = {
      id: crypto.randomUUID(),
      tool,
      points: [point],
    }
    setIsDrawing(true)
    render()
  }

  function updateStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!currentStrokeRef.current) return
    currentStrokeRef.current.points.push(pointFromEvent(event))
    render()
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!currentStrokeRef.current) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const completed = currentStrokeRef.current
    currentStrokeRef.current = null
    setIsDrawing(false)
    setRedoStack([])
    setStrokes((current) => [...current, completed])
  }

  function undo() {
    setStrokes((current) => {
      const next = current.slice(0, -1)
      const removed = current[current.length - 1]
      if (removed) setRedoStack((redo) => [removed, ...redo])
      if (removed) playSound("edit")
      return next
    })
  }

  function redo() {
    setRedoStack((current) => {
      const [restored, ...rest] = current
      if (restored) {
        setStrokes((existing) => [...existing, restored])
        playSound("edit")
      }
      return rest
    })
  }

  function clear() {
    if (!strokes.length) return
    playSound("clear")
    setRedoStack([])
    setStrokes([])
  }

  function exportPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    playSound("export")
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, "sketchbook.png")
    }, "image/png")
  }

  function exportSvg() {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const styles = window.getComputedStyle(canvas)
    const paper = styles.backgroundColor
    const ink = styles.color

    const paths = strokes
      .map((stroke) => {
        const outline = getStroke(stroke.points, {
          ...toolOptions[stroke.tool],
          simulatePressure: true,
        })
        const fill = stroke.tool === "eraser" ? paper : ink
        const opacity = stroke.tool === "marker" ? 0.32 : 0.92
        return `<path d="${getStrokePath(outline)}" fill="${fill}" opacity="${opacity}" />`
      })
      .join("")

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}"><rect width="100%" height="100%" fill="${paper}" />${paths}</svg>`
    playSound("export")
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "sketchbook.svg")
  }

  function exportPdf() {
    const canvas = canvasRef.current
    if (!canvas) return

    const pdf = makePdfFromCanvas(canvas)
    if (!pdf) return

    playSound("export")
    downloadBlob(pdf, "sketchbook.pdf")
  }

  const tools = useMemo<Tool[]>(() => ["pen", "marker", "eraser"], [])

  return (
    <section className="space-y-6" aria-label="Sketchbook canvas">
      <div className="sketch-toolbar" aria-label="Sketchbook tools">
        <div
          className="sketch-control-group sketch-tool-group"
          aria-label="Drawing tools"
        >
          {tools.map((item) => (
            <button
              key={item}
              type="button"
              className={`sketch-action ${
                tool === item
                  ? "bg-background text-foreground"
                  : ""
              }`}
              aria-pressed={tool === item}
              onClick={() => setTool(item)}
            >
              {toolLabels[item]}
            </button>
          ))}
        </div>

        <div className="sketch-control-group" aria-label="History actions">
          <button
            type="button"
            className="sketch-action"
            disabled={!canUndo}
            onClick={undo}
          >
            Undo
          </button>
          <button
            type="button"
            className="sketch-action"
            disabled={!canRedo}
            onClick={redo}
          >
            Redo
          </button>
          <button
            type="button"
            className="sketch-action"
            disabled={!canUndo}
            onClick={clear}
          >
            Clear
          </button>
        </div>

        <div className="sketch-control-group sketch-export-group" aria-label="Export actions">
          <button type="button" className="sketch-action" onClick={exportPng}>
            PNG
          </button>
          <button type="button" className="sketch-action" onClick={exportSvg}>
            SVG
          </button>
          <button type="button" className="sketch-action" onClick={exportPdf}>
            PDF
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={`h-[68vh] max-h-[620px] min-h-[420px] w-full touch-none rounded-lg border border-border bg-card text-foreground transition-colors duration-150 ${
          isDrawing ? "cursor-crosshair" : "cursor-cell"
        }`}
        aria-label="Drawing canvas"
        role="img"
        onPointerDown={beginStroke}
        onPointerMove={updateStroke}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />

      <p className="caption">
        P for pen, E for eraser, Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z to redo.
      </p>
    </section>
  )
}
