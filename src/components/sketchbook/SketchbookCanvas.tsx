import { useCallback, useEffect, useRef } from "react"

import { DrawingEditorLayout } from "@/components/DrawingEditorLayout"
import DrawingToolbar from "@/components/sketchbook/DrawingToolbar"
import { SketchbookProvider } from "@/components/sketchbook/SketchbookProvider"
import { useSketchbook } from "@/components/sketchbook/SketchbookContext"
import { renderStrokes } from "@/lib/sketchbook/render"

function SketchbookEditor() {
  const editorRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ width: 1, height: 1 })
  const rafRef = useRef<number | null>(null)

  const {
    tool,
    strokes,
    isDrawing,
    canUndo,
    canRedo,
    canClear,
    setTool,
    beginStroke,
    updateStroke,
    finishStroke,
    undo,
    redo,
    clear,
    exportPng,
    exportSvg,
    exportPdf,
    getDraftStroke,
  } = useSketchbook()

  const strokesRef = useRef(strokes)
  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    sizeRef.current = { width, height }

    renderStrokes(canvas, strokesRef.current, getDraftStroke(), width, height)
    rafRef.current = null
  }, [getDraftStroke])

  const schedulePaint = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(paint)
  }, [paint])

  useEffect(() => {
    schedulePaint()
  }, [strokes, schedulePaint])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => schedulePaint())
    observer.observe(canvas)
    schedulePaint()

    return () => {
      observer.disconnect()
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [schedulePaint])

  function readCanvasSize() {
    const canvas = canvasRef.current
    if (!canvas) return sizeRef.current

    const rect = canvas.getBoundingClientRect()
    sizeRef.current = {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    }
    return sizeRef.current
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const { width, height } = readCanvasSize()
    beginStroke(event, width, height)
    schedulePaint()
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const { width, height } = readCanvasSize()
    updateStroke(event, width, height)
    schedulePaint()
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const { width, height } = readCanvasSize()
    finishStroke(event, width, height)
    schedulePaint()
  }

  const exportItems = [
    {
      label: "PNG",
      onExport: () => {
        const { width, height } = readCanvasSize()
        exportPng(width, height)
      },
    },
    {
      label: "SVG",
      onExport: () => {
        const { width, height } = readCanvasSize()
        exportSvg(width, height)
      },
    },
    {
      label: "PDF",
      onExport: () => {
        const { width, height } = readCanvasSize()
        exportPdf(width, height)
      },
    },
  ]

  return (
    <DrawingEditorLayout editorRef={editorRef}>
      <DrawingToolbar
        tool={tool}
        onToolChange={setTool}
        canUndo={canUndo}
        canRedo={canRedo}
        canClear={canClear}
        onUndo={undo}
        onRedo={redo}
        onClear={clear}
        exportItems={exportItems}
        editorRef={editorRef}
      />

      <canvas
        ref={canvasRef}
        className={`h-[68vh] max-h-[620px] min-h-[420px] w-full touch-none bg-[#EFEBE3] text-foreground ${
          isDrawing ? "cursor-crosshair" : "cursor-cell"
        }`}
        aria-label="Drawing canvas"
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <p className="caption">
        P for pen, M for marker, E for eraser, Cmd/Ctrl+Z to undo,
        Cmd/Ctrl+Shift+Z to redo.
      </p>
    </DrawingEditorLayout>
  )
}

export default function SketchbookCanvas() {
  return (
    <SketchbookProvider>
      <SketchbookEditor />
    </SketchbookProvider>
  )
}
