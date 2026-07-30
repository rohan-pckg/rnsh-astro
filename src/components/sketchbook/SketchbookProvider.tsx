import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"

import { SketchbookContext } from "@/components/sketchbook/SketchbookContext"
import type { SketchbookContextValue } from "@/components/sketchbook/SketchbookContext"

import { STORAGE_KEY, toolOptions } from "@/lib/sketchbook/constants"
import { normalizePoint } from "@/lib/sketchbook/coordinates"
import { eraseStrokes } from "@/lib/sketchbook/eraser"
import { exportPdf, exportPng, exportSvg } from "@/lib/sketchbook/export"
import { loadStrokes, saveStrokes } from "@/lib/sketchbook/storage"
import type { Stroke, Tool } from "@/lib/sketchbook/types"
import { sound } from "@/lib/sound"

type HistoryEntry =
  | { kind: "add"; stroke: Stroke }
  | { kind: "replace"; strokes: Stroke[] }

type SketchbookState = {
  tool: Tool
  strokes: Stroke[]
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  activePointerId: number | null
}

type SketchbookAction =
  | { type: "set_tool"; tool: Tool }
  | { type: "set_pointer"; pointerId: number | null }
  | {
      type: "commit_stroke"
      stroke: Stroke
      width: number
      height: number
    }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" }
  | { type: "hydrate"; strokes: Stroke[] }

function createStroke(tool: Tool): Stroke {
  const options = toolOptions[tool]
  return {
    id: crypto.randomUUID(),
    tool,
    color: options.color,
    width: options.size,
    opacity: options.opacity,
    points: [],
  }
}

function sketchbookReducer(
  state: SketchbookState,
  action: SketchbookAction
): SketchbookState {
  switch (action.type) {
    case "set_tool":
      return { ...state, tool: action.tool }

    case "set_pointer":
      return { ...state, activePointerId: action.pointerId }

    case "commit_stroke": {
      const { stroke, width, height } = action
      if (stroke.points.length === 0) {
        return { ...state, activePointerId: null }
      }

      if (stroke.tool === "eraser") {
        const before = state.strokes
        const nextStrokes = eraseStrokes(before, stroke.points, width, height)

        const changed =
          nextStrokes.length !== before.length ||
          nextStrokes.some((entry, index) => {
            const previous = before[index]
            return (
              !previous ||
              entry.id !== previous.id ||
              entry.points.length !== previous.points.length
            )
          })

        if (!changed) {
          return { ...state, activePointerId: null }
        }

        return {
          ...state,
          strokes: nextStrokes,
          undoStack: [...state.undoStack, { kind: "replace", strokes: before }],
          redoStack: [],
          activePointerId: null,
        }
      }

      return {
        ...state,
        strokes: [...state.strokes, stroke],
        undoStack: [...state.undoStack, { kind: "add", stroke }],
        redoStack: [],
        activePointerId: null,
      }
    }

    case "undo": {
      const entry = state.undoStack[state.undoStack.length - 1]
      if (!entry) return state

      const undoStack = state.undoStack.slice(0, -1)

      if (entry.kind === "add") {
        return {
          ...state,
          strokes: state.strokes.slice(0, -1),
          undoStack,
          redoStack: [entry, ...state.redoStack],
        }
      }

      return {
        ...state,
        strokes: entry.strokes,
        undoStack,
        redoStack: [
          { kind: "replace", strokes: state.strokes },
          ...state.redoStack,
        ],
      }
    }

    case "redo": {
      const entry = state.redoStack[0]
      if (!entry) return state

      const redoStack = state.redoStack.slice(1)

      if (entry.kind === "add") {
        return {
          ...state,
          strokes: [...state.strokes, entry.stroke],
          undoStack: [...state.undoStack, entry],
          redoStack,
        }
      }

      return {
        ...state,
        strokes: entry.strokes,
        undoStack: [
          ...state.undoStack,
          { kind: "replace", strokes: state.strokes },
        ],
        redoStack,
      }
    }

    case "clear": {
      if (state.strokes.length === 0) return state
      return {
        ...state,
        strokes: [],
        undoStack: [
          ...state.undoStack,
          { kind: "replace", strokes: state.strokes },
        ],
        redoStack: [],
      }
    }

    case "hydrate":
      return { ...state, strokes: action.strokes }

    default:
      return state
  }
}

export function SketchbookProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sketchbookReducer, {
    tool: "pen",
    strokes: [],
    undoStack: [],
    redoStack: [],
    activePointerId: null,
  })

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const draftRef = useRef<Stroke | null>(null)
  const activePointerRef = useRef<number | null>(null)

  useEffect(() => {
    dispatch({ type: "hydrate", strokes: loadStrokes(STORAGE_KEY) })
  }, [])

  useEffect(() => {
    saveStrokes(STORAGE_KEY, state.strokes)
  }, [state.strokes])

  const getDraftStroke = useCallback(() => draftRef.current, [])

  const setTool = useCallback((tool: Tool) => {
    dispatch({ type: "set_tool", tool })
  }, [])

  const beginStroke = useCallback(
    (
      event: React.PointerEvent<HTMLCanvasElement>,
      width: number,
      height: number
    ) => {
      if (!event.isPrimary) return
      if (event.button !== 0 && event.pointerType !== "touch") return

      const target = event.currentTarget
      target.setPointerCapture(event.pointerId)

      const rect = target.getBoundingClientRect()
      const point = normalizePoint(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.pressure > 0 ? event.pressure : 0.45,
        width,
        height
      )

      const stroke = createStroke(stateRef.current.tool)
      stroke.points = [point]
      draftRef.current = stroke
      activePointerRef.current = event.pointerId

      dispatch({ type: "set_pointer", pointerId: event.pointerId })
    },
    []
  )

  const updateStroke = useCallback(
    (
      event: React.PointerEvent<HTMLCanvasElement>,
      width: number,
      height: number
    ) => {
      if (activePointerRef.current !== event.pointerId) return
      if (!draftRef.current) return

      const rect = event.currentTarget.getBoundingClientRect()
      const point = normalizePoint(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.pressure > 0 ? event.pressure : 0.45,
        width,
        height
      )

      draftRef.current = {
        ...draftRef.current,
        points: [...draftRef.current.points, point],
      }
    },
    []
  )

  const finishStroke = useCallback(
    (
      event: React.PointerEvent<HTMLCanvasElement>,
      width: number,
      height: number
    ) => {
      if (activePointerRef.current !== event.pointerId) return

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const stroke = draftRef.current
      draftRef.current = null
      activePointerRef.current = null

      if (stroke) {
        dispatch({ type: "commit_stroke", stroke, width, height })
      } else {
        dispatch({ type: "set_pointer", pointerId: null })
      }
    },
    []
  )

  const undo = useCallback(() => {
    dispatch({ type: "undo" })
    sound.play("back")
  }, [])

  const redo = useCallback(() => {
    dispatch({ type: "redo" })
    sound.play("open")
  }, [])

  const clear = useCallback(() => {
    dispatch({ type: "clear" })
    sound.play("clear")
  }, [])

  const handleExportPng = useCallback((width: number, height: number) => {
    exportPng(stateRef.current.strokes, null, width, height)
  }, [])

  const handleExportSvg = useCallback((width: number, height: number) => {
    exportSvg(stateRef.current.strokes, width, height)
  }, [])

  const handleExportPdf = useCallback((width: number, height: number) => {
    exportPdf(stateRef.current.strokes, null, width, height)
  }, [])

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      )
    }

    function onKeyDown(event: KeyboardEvent) {
      if (document.body.classList.contains("sketch-download-open")) return
      if (isEditableTarget(event.target)) return

      const isMod = event.metaKey || event.ctrlKey

      if (isMod && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault()
        dispatch({ type: "redo" })
        sound.play("open")
        return
      }

      if (isMod && event.key.toLowerCase() === "z") {
        event.preventDefault()
        dispatch({ type: "undo" })
        sound.play("back")
        return
      }

      if (isMod && event.key.toLowerCase() === "y") {
        event.preventDefault()
        dispatch({ type: "redo" })
        sound.play("open")
        return
      }

      if (event.key.toLowerCase() === "p") {
        dispatch({ type: "set_tool", tool: "pen" })
        sound.play("tool-switch")
      }
      if (event.key.toLowerCase() === "m") {
        dispatch({ type: "set_tool", tool: "marker" })
        sound.play("tool-switch")
      }
      if (event.key.toLowerCase() === "e") {
        dispatch({ type: "set_tool", tool: "eraser" })
        sound.play("tool-switch")
      }
      if (event.key === "Escape") {
        dispatch({ type: "set_tool", tool: "pen" })
        sound.play("tool-switch")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const value = useMemo<SketchbookContextValue>(
    () => ({
      tool: state.tool,
      strokes: state.strokes,
      isDrawing: state.activePointerId !== null,
      canUndo: state.undoStack.length > 0,
      canRedo: state.redoStack.length > 0,
      canClear: state.strokes.length > 0,
      setTool,
      getDraftStroke,
      beginStroke,
      updateStroke,
      finishStroke,
      undo,
      redo,
      clear,
      exportPng: handleExportPng,
      exportSvg: handleExportSvg,
      exportPdf: handleExportPdf,
    }),
    [
      state.tool,
      state.strokes,
      state.activePointerId,
      state.undoStack.length,
      state.redoStack.length,
      setTool,
      getDraftStroke,
      beginStroke,
      updateStroke,
      finishStroke,
      undo,
      redo,
      clear,
      handleExportPng,
      handleExportSvg,
      handleExportPdf,
    ]
  )

  return (
    <SketchbookContext.Provider value={value}>
      {children}
    </SketchbookContext.Provider>
  )
}
