import { useMemo, useState } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import DrawingToolbar from "@/components/sketchbook/DrawingToolbar"
import { DrawingEditorLayout } from "@/components/DrawingEditorLayout"
import { useDrawingEngine } from "@/hooks/useDrawingEngine"
import { CAVEAT_WOFF2_BASE64 } from "@/lib/font-data"
import { downloadBlob, makePdfFromCanvas } from "@/lib/drawing"
import {
  postcardTemplateList,
  postcardThemes,
  renderPostcardSvg,
  type PostcardTemplateId,
} from "@/lib/postcard"
import { playSound } from "@/lib/sound"
import { templateComponents } from "@/components/postcard/templates"

const STORAGE_KEY = "postcard-strokes"
const EXPORT_WIDTH = 760
const EXPORT_SCALE = 2

export default function PostcardCanvas() {
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

  const [message, setMessage] = useState("")
  const [author, setAuthor] = useState("")
  const [templateId, setTemplateId] = useState<PostcardTemplateId>("classic")
  const theme = postcardThemes[templateId]

  const postcardData = useMemo(
    () => ({
      drawing: { strokes },
      message,
      author,
      theme,
    }),
    [author, message, strokes, theme]
  )

  const Template = templateComponents[templateId]

  async function renderExportCanvas() {
    const svg = renderPostcardSvg(postcardData, EXPORT_WIDTH)
    const image = new Image()
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    )
    image.src = url
    await image.decode()
    URL.revokeObjectURL(url)

    const canvas = document.createElement("canvas")
    canvas.width = EXPORT_WIDTH * EXPORT_SCALE
    canvas.height = (EXPORT_WIDTH / 1.5) * EXPORT_SCALE
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
    ctx.drawImage(image, 0, 0, EXPORT_WIDTH, EXPORT_WIDTH / 1.5)
    return canvas
  }

  async function exportPng() {
    playSound("export")
    const canvas = await renderExportCanvas()
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `postcard-${templateId}.png`)
    }, "image/png")
  }

  async function exportPdf() {
    playSound("export")
    const canvas = await renderExportCanvas()
    if (!canvas) return
    const pdf = makePdfFromCanvas(canvas)
    if (pdf) downloadBlob(pdf, `postcard-${templateId}.pdf`)
  }

  function exportHtml() {
    const svg = renderPostcardSvg(postcardData, EXPORT_WIDTH)
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${theme.label} postcard</title>
<style>
@font-face { font-family: Caveat; src: url(data:font/woff2;base64,${CAVEAT_WOFF2_BASE64}) format('woff2'); }
* { box-sizing: border-box; }
body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 2rem; background: #efe6d8; }
.postcard { width: min(760px, 100%); animation: enter .7s ease-out both; }
.postcard svg { display: block; width: 100%; height: auto; filter: drop-shadow(0 12px 28px rgba(64, 48, 34, .12)); }
@keyframes enter { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .postcard { animation: none; } }
</style>
</head>
<body><main class="postcard">${svg}</main></body>
</html>`
    playSound("export")
    downloadBlob(
      new Blob([html], { type: "text/html" }),
      `postcard-${templateId}.html`
    )
  }

  const exportItems = [
    { label: "PNG", onExport: exportPng },
    { label: "PDF", onExport: exportPdf },
    { label: "HTML", onExport: exportHtml },
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

      <div className="postcard-studio-canvas">
        <canvas
          ref={canvasRef}
          className={`touch-none bg-card text-foreground transition-colors duration-150 ${
            isDrawing ? "cursor-crosshair" : "cursor-cell"
          }`}
          aria-label="Postcard drawing area"
          role="img"
          onPointerDown={beginStroke}
          onPointerMove={updateStroke}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>

      <div className="postcard-studio-fields">
        <label className="postcard-label" htmlFor="pc-message">
          Message
        </label>
        <textarea
          id="pc-message"
          className="postcard-input postcard-textarea"
          placeholder="Write something worth keeping..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
        />
        <label className="postcard-label" htmlFor="pc-author">
          Author
        </label>
        <input
          id="pc-author"
          className="postcard-input"
          type="text"
          placeholder="Your name"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
      </div>

      <section
        className="postcard-style-picker"
        aria-labelledby="postcard-style-heading"
      >
        <div className="postcard-section-copy">
          <h2 id="postcard-style-heading" className="body-text">
            Style
          </h2>
          <p className="body-small">Choose how your postcard is presented.</p>
        </div>
        <ToggleGroup
          className="postcard-style-tabs"
          aria-label="Postcard style"
          value={[templateId]}
          onValueChange={(value) => {
            const next = value[0]
            if (next && next in postcardThemes) {
              setTemplateId(next as PostcardTemplateId)
            }
          }}
        >
          {postcardTemplateList.map((option) => (
            <ToggleGroupItem
              key={option.id}
              className="postcard-style-tab"
              value={option.id}
              aria-label={option.label}
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section
        className="postcard-studio-preview"
        aria-labelledby="postcard-preview-heading"
      >
        <div className="postcard-studio-preview__heading">
          <h2 id="postcard-preview-heading" className="body-text">
            Preview
          </h2>
          <p className="card-title">{theme.label}</p>
          <p className="body-small postcard-studio-preview__description">
            {theme.description}
          </p>
        </div>
        <div className="postcard-studio-preview__stage">
          <Template
            drawing={postcardData.drawing}
            message={postcardData.message}
            author={postcardData.author}
            theme={postcardData.theme}
          />
        </div>
      </section>

      <div className="postcard-studio-footer">
        <p className="caption">P pen · M marker · E eraser · ⌘Z undo</p>
      </div>
    </DrawingEditorLayout>
  )
}
