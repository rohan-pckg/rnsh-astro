import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import type { Point, Stroke, Tool } from "@/lib/drawing"
import { renderStrokesToCanvas } from "@/lib/drawing"
import { sound } from "@/lib/sound"

function loadStrokes(storageKey: string | undefined): Stroke[] {
  if (!storageKey) return []
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved) as Stroke[]
  } catch {
  }
  return []
}

export function useDrawingEngine(options?: { storageKey?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const clearSnapshotRef = useRef<Stroke[] | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const redoStackRef = useRef<Stroke[]>([])

  const [tool, setTool] = useState<Tool>("pen")
  const [strokes, setStrokes] = useState<Stroke[]>(() => loadStrokes(options?.storageKey))
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  strokesRef.current = strokes
  redoStackRef.current = redoStack

  const storageKey = options?.storageKey

  useEffect(() => {
    if (!storageKey) return
    window.localStorage.setItem(storageKey, JSON.stringify(strokes))
  }, [strokes, storageKey])

  const render = useRef(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderStrokesToCanvas(canvas, strokesRef.current, currentStrokeRef.current)
  })

  useEffect(() => {
    render.current()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => render.current())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

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
    const point = pointFromEvent(event)
    currentStrokeRef.current = {
      id: crypto.randomUUID(),
      tool,
      points: [point],
    }
    setIsDrawing(true)
    render.current()
  }

  function updateStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!currentStrokeRef.current) return
    currentStrokeRef.current.points.push(pointFromEvent(event))
    render.current()
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!currentStrokeRef.current) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const completed = currentStrokeRef.current
    currentStrokeRef.current = null
    setIsDrawing(false)

    const next = [...strokesRef.current, completed]
    strokesRef.current = next
    setStrokes(next)
    setRedoStack([])
    redoStackRef.current = []

    render.current()
  }

  function undo() {
    const current = strokesRef.current
    if (current.length === 0 && clearSnapshotRef.current) {
      const snapshot = clearSnapshotRef.current
      clearSnapshotRef.current = null
      strokesRef.current = snapshot
      setStrokes(snapshot)
      render.current()
      sound.play("back")
      return
    }
    const last = current[current.length - 1]
    if (!last) return
    const next = current.slice(0, -1)
    strokesRef.current = next
    setStrokes(next)
    setRedoStack((r) => {
      const nextRedo = [last, ...r]
      redoStackRef.current = nextRedo
      return nextRedo
    })
    render.current()
    sound.play("back")
  }

  function redo() {
    const current = redoStackRef.current
    const restored = current[0]
    if (!restored) return
    const nextRedo = current.slice(1)
    redoStackRef.current = nextRedo
    setRedoStack(nextRedo)
    const next = [...strokesRef.current, restored]
    strokesRef.current = next
    setStrokes(next)
    render.current()
    sound.play("open")
  }

  function clear() {
    const current = strokesRef.current
    if (!current.length) return
    clearSnapshotRef.current = current
    strokesRef.current = []
    setStrokes([])
    redoStackRef.current = []
    setRedoStack([])
    render.current()
    sound.play("clear")
  }

  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo

  const setToolRef = useRef(setTool)
  setToolRef.current = setTool

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMod = event.metaKey || event.ctrlKey

      if (isMod && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault()
        redoRef.current()
        return
      }

      if (isMod && event.key.toLowerCase() === "z") {
        event.preventDefault()
        undoRef.current()
        return
      }

      if (isMod && event.key.toLowerCase() === "y") {
        event.preventDefault()
        redoRef.current()
        return
      }

      if (event.key.toLowerCase() === "p") {
        setToolRef.current("pen")
        sound.play("tool-switch")
      }
      if (event.key.toLowerCase() === "m") {
        setToolRef.current("marker")
        sound.play("tool-switch")
      }
      if (event.key.toLowerCase() === "e") {
        setToolRef.current("eraser")
        sound.play("tool-switch")
      }
      if (event.key === "Escape") {
        setToolRef.current("pen")
        sound.play("tool-switch")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const canUndo = strokes.length > 0 || clearSnapshotRef.current !== null
  const canRedo = redoStack.length > 0

  return {
    canvasRef,
    tool,
    setTool,
    strokes,
    currentStrokeRef,
    isDrawing,
    beginStroke,
    updateStroke,
    finishStroke,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
  }
}
