import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import type { Point, Stroke, Tool } from "@/lib/drawing"
import { renderStrokesToCanvas } from "@/lib/drawing"

function loadStrokes(storageKey: string | undefined): Stroke[] {
  if (!storageKey) return []
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved) as Stroke[]
  } catch {
    // ignore
  }
  return []
}

export function useDrawingEngine(options?: { storageKey?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const clearSnapshotRef = useRef<Stroke[] | null>(null)
  const [tool, setTool] = useState<Tool>("pen")
  const [strokes, setStrokes] = useState<Stroke[]>(() => loadStrokes(options?.storageKey))
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  const storageKey = options?.storageKey

  useEffect(() => {
    if (!storageKey) return
    window.localStorage.setItem(storageKey, JSON.stringify(strokes))
  }, [strokes, storageKey])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderStrokesToCanvas(canvas, strokes, currentStrokeRef.current)
  }, [strokes])

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
      if (event.key.toLowerCase() === "m") setTool("marker")
      if (event.key.toLowerCase() === "e") setTool("eraser")
      if (event.key === "Escape") setTool("pen")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  function pointFromEvent(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return [
      event.clientX - rect.left,
      event.clientY - rect.top,
      event.pressure > 0 ? event.pressure : 0.45,
    ]
  }

  function beginStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
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
    if (strokes.length === 0 && clearSnapshotRef.current) {
      setStrokes(clearSnapshotRef.current)
      clearSnapshotRef.current = null
      return
    }
    const last = strokes[strokes.length - 1]
    if (!last) return
    setStrokes(strokes.slice(0, -1))
    setRedoStack((r) => [last, ...r])
  }

  function redo() {
    const restored = redoStack[0]
    if (!restored) return
    setRedoStack((r) => r.slice(1))
    setStrokes((s) => [...s, restored])
  }

  function clear() {
    if (!strokes.length) return
    clearSnapshotRef.current = strokes
    setRedoStack([])
    setStrokes([])
  }

  const canUndo = strokes.length > 0 || clearSnapshotRef.current !== null
  const canRedo = redoStack.length > 0

  return {
    canvasRef,
    currentStrokeRef,
    tool,
    setTool,
    strokes,
    setStrokes,
    redoStack,
    setRedoStack,
    isDrawing,
    beginStroke,
    updateStroke,
    finishStroke,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    render,
  }
}
