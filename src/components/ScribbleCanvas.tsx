import { useCallback, useEffect, useRef, useState } from "react"

/**
 * The scribble sheet.
 *
 * A full-bleed plane of accent-coloured paper at the foot of every page, with
 * nothing on it but a white pen. There is no toolbar, no palette, no undo and
 * no save button: the surface is the interface.
 *
 * Implementation notes, kept deliberately small:
 *  - Pointer Events throughout, so mouse, touch and stylus share one path.
 *  - Two canvases: an offscreen one holding every finished stroke, and the
 *    visible one, which is that bitmap plus the stroke currently in progress.
 *    A frame therefore costs one blit and one path, no matter how much has
 *    been drawn — which is what keeps it responsive.
 *  - Strokes are stored in CSS pixels and replayed on resize, so a drawing
 *    survives a resize (clipped where it no longer fits) and a mobile
 *    URL-bar collapse never shifts what is already on the paper.
 *  - The bitmap is sized in device pixels, so strokes stay crisp on retina.
 */

type Point = { x: number; y: number }
type Tool = "pen" | "marker" | "eraser"
type Stroke = { points: Point[]; tool: Tool; size: number; color?: string }

const STORAGE_KEY = "rnsh-scribble"
/** Bounds memory and replay cost on an unbounded canvas. */
const MAX_POINTS = 40000
/** Beyond 2x there is nothing visible left to gain, only memory to lose. */
const MAX_DPR = 2
const PEN_WIDTH = 2.5
const MARKER_WIDTH = 9
const ERASER_WIDTH = 16
/** Stroke width multiplier bounds, so a brush can never vanish or dominate. */
const MIN_SIZE = 0.4
const MAX_SIZE = 3.2

type HistoryAction =
  | { type: "add"; stroke: Stroke }
  | { type: "clear"; removed: Stroke[] }

function strokeSpec(stroke: Stroke) {
  const size = stroke.size || 1
  if (stroke.tool === "marker") {
    return { width: MARKER_WIDTH * size, alpha: 0.45 }
  }
  if (stroke.tool === "eraser") {
    return { width: ERASER_WIDTH * size, alpha: 1 }
  }
  return { width: PEN_WIDTH * size, alpha: 1 }
}

function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[]
) {
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = "#ffffff"
  ctx.fillStyle = "#ffffff"

  for (const stroke of strokes) {
    const { width, alpha } = strokeSpec(stroke)
    ctx.lineWidth = width
    ctx.globalAlpha = alpha
    const ink = stroke.color || "#ffffff"
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    // The eraser erases actual stroke pixels (destination-out on the stroke
    // bitmap) — it never paints the background colour, so white paper shows
    // the orange sheet through it exactly like a real eraser would.
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over"
    const points = stroke.points
    if (points.length === 0) continue

    if (points.length === 1) {
      // A tap, not a drag: still leaves a mark.
      ctx.beginPath()
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }

    // Curve through the midpoints so fast movement still reads as a line.
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length - 1; i += 1) {
      const point = points[i]
      const next = points[i + 1]
      ctx.quadraticCurveTo(
        point.x,
        point.y,
        (point.x + next.x) / 2,
        (point.y + next.y) / 2
      )
    }
    const last = points[points.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
}

export default function ScribbleCanvas() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const historyRef = useRef<HistoryAction[]>([])
  const redoRef = useRef<HistoryAction[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const rafRef = useRef<number | null>(null)
  const [tool, setTool] = useState<Tool>("pen")
  const [expanded, setExpanded] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [size, setSize] = useState(1)
  const [penColor, setPenColor] = useState("#ffffff")
  const [bgColor, setBgColor] = useState("#ff8700")
  const [clearArmed, setClearArmed] = useState(false)
  const clearTimerRef = useRef<number | null>(null)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  /** One blit of the finished drawing plus the live stroke. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const base = baseRef.current
    if (!canvas || !base) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(base, 0, 0, width, height)
    if (currentRef.current) paintStrokes(ctx, [currentRef.current])
    rafRef.current = null
  }, [])

  const schedulePaint = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(paint)
  }, [paint])

  /** Size both bitmaps to the element's box in device pixels and replay. */
  const fit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const box = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(box.width))
    const height = Math.max(1, Math.round(box.height))
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)

    if (!baseRef.current) baseRef.current = document.createElement("canvas")
    const base = baseRef.current

    for (const target of [canvas, base]) {
      target.width = Math.round(width * dpr)
      target.height = Math.round(height * dpr)
    }

    for (const target of [canvas, base]) {
      const ctx = target.getContext("2d")
      if (!ctx) continue
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
    }

    const baseCtx = base.getContext("2d")
    if (baseCtx) paintStrokes(baseCtx, strokesRef.current)

    paint()
  }, [paint])

  // Restore, size, and keep sized.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          // Legacy saves were bare point arrays — all pen strokes.
          strokesRef.current = parsed.map((item: unknown) =>
            Array.isArray(item)
              ? { points: item as Point[], tool: "pen" as Tool, size: 1 }
              : { size: 1, ...(item as Omit<Stroke, "size"> & { size?: number }) }
          )
        }
      }
    } catch {
      // Unreadable or unavailable storage is not worth failing over.
    }

    fit()
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => fit())
    observer.observe(canvas)

    return () => {
      observer.disconnect()
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [fit])

  const persist = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(strokesRef.current))
    } catch {
      // A full or unavailable quota must not interrupt drawing.
    }
  }, [])

  /** Drop the oldest strokes once the drawing gets unreasonably large. */
  const trim = useCallback(() => {
    let total = 0
    for (const stroke of strokesRef.current) total += stroke.points.length
    let index = 0
    while (total > MAX_POINTS && index < strokesRef.current.length - 1) {
      total -= strokesRef.current[index].points.length
      index += 1
    }
    if (index > 0) strokesRef.current = strokesRef.current.slice(index)
  }, [])

  /** Re-render the base bitmap from the logical stroke list, then persist. */
  const restamp = useCallback(() => {
    const canvas = canvasRef.current
    const base = baseRef.current
    const ctx = base?.getContext("2d")
    if (ctx && base && canvas) {
      // IMPORTANT: size off the VISIBLE canvas — `base` is detached, so its
      // own getBoundingClientRect() is 0×0 and the clear/replay would be a
      // no-op (the bug where Clear/Undo left old strokes on screen).
      const { width, height } = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, width, height)
      paintStrokes(ctx, strokesRef.current)
    }
    persist()
    schedulePaint()
  }, [persist, schedulePaint])

  const undo = useCallback(() => {
    const action = historyRef.current[historyRef.current.length - 1]
    if (!action) return
    historyRef.current = historyRef.current.slice(0, -1)
    if (action.type === "add") {
      strokesRef.current = strokesRef.current.filter(s => s !== action.stroke)
    } else {
      strokesRef.current = action.removed
    }
    redoRef.current = [...redoRef.current, action]
    setCanUndo(historyRef.current.length > 0)
    setCanRedo(true)
    restamp()
  }, [restamp])

  const redo = useCallback(() => {
    const action = redoRef.current[redoRef.current.length - 1]
    if (!action) return
    redoRef.current = redoRef.current.slice(0, -1)
    if (action.type === "add") {
      strokesRef.current = [...strokesRef.current, action.stroke]
    } else {
      strokesRef.current = []
    }
    historyRef.current = [...historyRef.current, action]
    setCanUndo(true)
    setCanRedo(redoRef.current.length > 0)
    restamp()
  }, [restamp])

  const clear = useCallback(() => {
    if (strokesRef.current.length === 0) return
    historyRef.current = [
      ...historyRef.current,
      { type: "clear", removed: strokesRef.current },
    ]
    strokesRef.current = []
    redoRef.current = []
    setCanUndo(true)
    setCanRedo(false)
    restamp()
  }, [restamp])

  const onClearClick = useCallback(() => {
    setClearArmed(true)
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current)
    }
    clearTimerRef.current = window.setTimeout(() => setClearArmed(false), 4000)
  }, [])

  const onConfirmClear = useCallback(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
    setClearArmed(false)
    clear()
  }, [clear])

  const onCancelClear = useCallback(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
    setClearArmed(false)
  }, [])

  const localPoint = (
    element: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): Point => {
    const box = element.getBoundingClientRect()
    return { x: clientX - box.left, y: clientY - box.top }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    currentRef.current = {
      points: [localPoint(event.currentTarget, event.clientX, event.clientY)],
      tool,
      size,
      color: penColor,
    }
    schedulePaint()
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = currentRef.current
    if (!stroke) return
    event.preventDefault()

    // High-frequency pointers batch their samples; drawing all of them is what
    // makes a fast flick a line rather than a dotted trail.
    const native = event.nativeEvent
    const coalesced =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : []
    const samples = coalesced.length > 0 ? coalesced : [native]

    for (const sample of samples) {
      stroke.points.push(localPoint(event.currentTarget, sample.clientX, sample.clientY))
    }
    schedulePaint()
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = currentRef.current
    currentRef.current = null
    if (!stroke) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    strokesRef.current = [...strokesRef.current, stroke]
    historyRef.current = [...historyRef.current, { type: "add", stroke }]
    redoRef.current = []
    setCanUndo(true)
    setCanRedo(false)
    trim()

    // Fold the finished stroke into the base bitmap so later frames only blit.
    const base = baseRef.current
    const ctx = base?.getContext("2d")
    if (ctx) paintStrokes(ctx, [stroke])

    persist()
    schedulePaint()
  }

  // Download menu: inline expansion inside the toolbar — never a portal,
  // never a page-level overlay. Closes on outside press and on Escape.
  useEffect(() => {
    if (!downloadOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setDownloadOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDownloadOpen(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [downloadOpen])

  /** Raster export of the artwork only: orange ground + strokes, nothing else. */
  const exportPng = () => exportRaster("png")
  const exportJpg = () => exportRaster("jpg")
  const exportWebp = () => exportRaster("webp")

  const exportRaster = (format: "png" | "jpg" | "webp") => {
      const base = baseRef.current
      if (!base) return
      const out = document.createElement("canvas")
      out.width = base.width
      out.height = base.height
      const ctx = out.getContext("2d")
      if (!ctx) return
      // JPG and WebP stay solid: the sheet keeps its current background color.
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, out.width, out.height)
      ctx.drawImage(base, 0, 0)
      const mime =
        format === "png" ? "image/png" : format === "jpg" ? "image/jpeg" : "image/webp"
      const ext = format === "jpg" ? "jpg" : format
      out.toBlob(
        blob => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement("a")
          anchor.href = url
          anchor.download = `rohan-doodle.${ext}`
          anchor.click()
          URL.revokeObjectURL(url)
        },
        mime,
        format === "png" ? undefined : 0.92
      )
    }

  /**
   * Genuine vector export: strokes ARE stored as point lists, so rebuild the
   * same midpoint-curve paths the painter uses. Eraser strokes become a mask
   * — never a fake embedded raster.
   */
  const exportSvg = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = canvas.getBoundingClientRect()

    const pathFor = (stroke: Stroke) => {
      const pts = stroke.points
      if (pts.length === 0) return ""
      if (pts.length === 1) {
        // A dot: zero-length subpath rendered with round caps.
        return `M${pts[0].x} ${pts[0].y}L${pts[0].x} ${pts[0].y}`
      }
      let d = `M${pts[0].x} ${pts[0].y}`
      for (let i = 1; i < pts.length - 1; i += 1) {
        const p = pts[i]
        const n = pts[i + 1]
        d += `Q${p.x} ${p.y} ${(p.x + n.x) / 2} ${(p.y + n.y) / 2}`
      }
      const last = pts[pts.length - 1]
      d += `L${last.x} ${last.y}`
      return d
    }

    const ink: string[] = []
    const erase: string[] = []
    for (const stroke of strokesRef.current) {
      const spec = strokeSpec(stroke)
      const attrs = `d="${pathFor(stroke)}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${spec.width}"`
      if (stroke.tool === "eraser") {
        erase.push(`<path ${attrs} stroke="black"/>`)
      } else if (stroke.tool === "marker") {
        ink.push(`<path ${attrs} stroke="${stroke.color || "#ffffff"}" stroke-opacity="0.45"/>`)
      } else {
        ink.push(`<path ${attrs} stroke="${stroke.color || "#ffffff"}"/>`)
      }
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="100%" height="100%" fill="${bgColor}"/>` +
      (erase.length > 0
        ? `<mask id="erase"><rect width="100%" height="100%" fill="white"/>${erase.join("")}</mask>`
        : "") +
      `<g${erase.length > 0 ? ' mask="url(#erase)"' : ""}>${ink.join("")}</g>` +
      `</svg>`

    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" })
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "rohan-doodle.svg"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => {
      const next = !prev
      // Bring the sheet into view once it has its new height; expanding is
      // what the user asked to see.
      if (next) {
        requestAnimationFrame(() =>
          sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        )
      }
      return next
    })
  }, [])


  return (
    <section
      ref={sectionRef}
      className={`scribble${expanded ? " is-expanded" : ""}`}
      style={{ background: bgColor }}
      aria-label="Scribble sheet"
    >
      <div className="scribble-toolbar" role="toolbar" aria-label="Drawing controls" ref={toolbarRef}>
        <button type="button" className="scribble-btn" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={undo}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 3.5 3 7l3.5 3.5M3.2 7H11a3 3 0 0 1 0 6H8"/></svg>
        </button>
        <button type="button" className="scribble-btn" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={redo}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3.5 13 7l-3.5 3.5M12.8 7H5a3 3 0 0 0 0 6h3"/></svg>
        </button>
        {clearArmed ? (
          <>
            <button type="button" className="scribble-btn scribble-btn-text" aria-label="Confirm clear drawing" title="Click again to clear" onClick={onConfirmClear}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M6.8 7v3.5M9.2 7v3.5"/></svg>
              <span>Clear?</span>
            </button>
            <button type="button" className="scribble-btn scribble-btn-text" aria-label="Cancel clear" title="Cancel" onClick={onCancelClear}>
              <span>Cancel</span>
            </button>
          </>
        ) : (
          <button type="button" className="scribble-btn" aria-label="Clear drawing" title="Clear" onClick={onClearClick}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5M6.8 7v3.5M9.2 7v3.5"/></svg>
          </button>
        )}
        <span className="scribble-sep" aria-hidden="true" />
        <button type="button" className={`scribble-btn${tool === "pen" ? " is-active" : ""}`} aria-label="Pen" aria-pressed={tool === "pen"} title="Pen" onClick={() => setTool("pen")}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5l.8-3.2L11 2.6l2.4 2.4-7.7 7.7-3.2.8z"/></svg>
        </button>
        <button type="button" className={`scribble-btn${tool === "marker" ? " is-active" : ""}`} aria-label="Marker" aria-pressed={tool === "marker"} title="Marker" onClick={() => setTool("marker")}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5l1-3.5 7-7 2.5 2.5-7 7-3.5 1zM9.5 4l2.5 2.5"/></svg>
        </button>
        <button type="button" className={`scribble-btn${tool === "eraser" ? " is-active" : ""}`} aria-label="Eraser" aria-pressed={tool === "eraser"} title="Eraser" onClick={() => setTool("eraser")}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 3.2l3.3 3.3-5.6 5.6H4.6l-2.4-2.4a1.2 1.2 0 0 1 0-1.7l5.6-5.6a1.2 1.2 0 0 1 1.7 0zM6.8 13.5H14"/></svg>
        </button>
        {expanded ? (
          <>
            <span className="scribble-sep" aria-hidden="true" />
            <input
              type="range"
              className="scribble-size"
              min={MIN_SIZE}
              max={MAX_SIZE}
              step="0.1"
              value={size}
              aria-label="Stroke size"
              title="Stroke size"
              onChange={event => setSize(Number(event.target.value))}
            />
            <span className="scribble-sep" aria-hidden="true" />
            <label className="scribble-swatch scribble-swatch-round" style={{ background: penColor }} title="Pen color">
              <input
                type="color"
                value={penColor}
                aria-label="Pen color"
                onChange={event => setPenColor(event.target.value)}
              />
            </label>
            <label className="scribble-swatch scribble-swatch-square" style={{ background: bgColor }} title="Background color">
              <input
                type="color"
                value={bgColor}
                aria-label="Background color"
                onChange={event => setBgColor(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <span className="scribble-export">
        <button
          type="button"
          className={`scribble-btn scribble-btn-text${downloadOpen ? " is-active" : ""}`}
          aria-label="Download drawing"
          aria-haspopup="menu"
          aria-expanded={downloadOpen}
          title="Download"
          onClick={() => setDownloadOpen(open => !open)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7M5 6.5l3 3 3-3M3 13h10"/></svg>
          <span>Download</span>
        </button>
        {downloadOpen ? (
          <>
            <button type="button" className="scribble-btn scribble-btn-text" aria-label="Download as PNG" title="Download PNG" onClick={() => { exportPng(); setDownloadOpen(false) }}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v6M5.5 6.5L8 9l2.5-2.5M3.5 12.5h9"/></svg>
              <span>PNG</span>
            </button>
            <button type="button" className="scribble-btn scribble-btn-text" aria-label="Download as JPG" title="Download JPG" onClick={() => { exportJpg(); setDownloadOpen(false) }}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v6M5.5 6.5L8 9l2.5-2.5M3.5 12.5h9"/></svg>
              <span>JPG</span>
            </button>
            <button type="button" className="scribble-btn scribble-btn-text" aria-label="Download as WebP" title="Download WebP" onClick={() => { exportWebp(); setDownloadOpen(false) }}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v6M5.5 6.5L8 9l2.5-2.5M3.5 12.5h9"/></svg>
              <span>WebP</span>
            </button>
          </>
        ) : null}
        {downloadOpen ? (
          <button
            type="button"
            className="scribble-btn scribble-btn-text"
            aria-label="Download as SVG"
            title="Download SVG"
            onClick={() => {
              exportSvg()
              setDownloadOpen(false)
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v6M5.5 6.5L8 9l2.5-2.5M3.5 12.5h9"/></svg>
            <span>SVG</span>
          </button>
        ) : null}
        </span>
        <button type="button" className="scribble-btn" aria-label={expanded ? "Collapse drawing area" : "Expand drawing area"} title={expanded ? "Collapse drawing area" : "Expand drawing area"} onClick={toggleExpanded}>
          {expanded ? (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"/></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>
          )}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="scribble-canvas"
        aria-label="Scribble on the sheet — draw with a pointer, a finger or a stylus"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    </section>
  )
}