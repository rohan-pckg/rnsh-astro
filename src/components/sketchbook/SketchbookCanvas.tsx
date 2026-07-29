import { playSound } from "@/lib/sound"
import { downloadBlob, getStrokesAsSvg, makePdfFromCanvas } from "@/lib/drawing"
import { useDrawingEngine } from "@/hooks/useDrawingEngine"
import DrawingToolbar from "@/components/sketchbook/DrawingToolbar"
import { DrawingEditorLayout } from "@/components/DrawingEditorLayout"

const STORAGE_KEY = "sketchbook-strokes"

export default function SketchbookCanvas() {
  const {
    canvasRef,
    tool,
    setTool,
    isDrawing,
    beginStroke,
    updateStroke,
    finishStroke,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    strokes,
  } = useDrawingEngine({ storageKey: STORAGE_KEY })

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

    const svgContent = getStrokesAsSvg(strokes, rect.width, rect.height, paper, ink)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}">${svgContent}</svg>`
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

  const exportItems = [
    { label: "PNG", onExport: exportPng },
    { label: "SVG", onExport: exportSvg },
    { label: "PDF", onExport: exportPdf },
  ]

  return (
    <DrawingEditorLayout>
      <DrawingToolbar
        tool={tool}
        onToolChange={setTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onClear={clear}
        exportItems={exportItems}
      />

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
        P for pen, M for marker, E for eraser, Cmd/Ctrl+Z to undo,
        Cmd/Ctrl+Shift+Z to redo.
      </p>
    </DrawingEditorLayout>
  )
}
