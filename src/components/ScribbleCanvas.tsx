import { useCallback, useEffect, useRef } from "react"

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
type Stroke = Point[]

const STORAGE_KEY = "rnsh-scribble"
/** Bounds memory and replay cost on an unbounded canvas. */
const MAX_POINTS = 40000
/** Beyond 2x there is nothing visible left to gain, only memory to lose. */
const MAX_DPR = 2
const LINE_WIDTH = 2.5

function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = LINE_WIDTH
  // White in both themes: a white pen on orange paper, never theme-tinted.
  ctx.strokeStyle = "#ffffff"
  ctx.fillStyle = "#ffffff"

  for (const stroke of strokes) {
    if (stroke.length === 0) continue

    if (stroke.length === 1) {
      // A tap, not a drag: still leaves a dot.
      ctx.beginPath()
      ctx.arc(stroke[0].x, stroke[0].y, LINE_WIDTH / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }

    // Curve through the midpoints so fast movement still reads as a line.
    ctx.beginPath()
    ctx.moveTo(stroke[0].x, stroke[0].y)
    for (let i = 1; i < stroke.length - 1; i += 1) {
      const point = stroke[i]
      const next = stroke[i + 1]
      ctx.quadraticCurveTo(
        point.x,
        point.y,
        (point.x + next.x) / 2,
        (point.y + next.y) / 2
      )
    }
    const last = stroke[stroke.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.stroke()
  }
}

export default function ScribbleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const rafRef = useRef<number | null>(null)

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
        if (Array.isArray(parsed)) strokesRef.current = parsed as Stroke[]
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
    for (const stroke of strokesRef.current) total += stroke.length
    let index = 0
    while (total > MAX_POINTS && index < strokesRef.current.length - 1) {
      total -= strokesRef.current[index].length
      index += 1
    }
    if (index > 0) strokesRef.current = strokesRef.current.slice(index)
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
    currentRef.current = [localPoint(event.currentTarget, event.clientX, event.clientY)]
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
      stroke.push(localPoint(event.currentTarget, sample.clientX, sample.clientY))
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
    trim()

    // Fold the finished stroke into the base bitmap so later frames only blit.
    const base = baseRef.current
    const ctx = base?.getContext("2d")
    if (ctx) paintStrokes(ctx, [stroke])

    persist()
    schedulePaint()
  }

  return (
    <canvas
      ref={canvasRef}
      className="scribble"
      aria-label="Scribble on the sheet — draw with a pointer, a finger or a stylus"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    />
  )
}