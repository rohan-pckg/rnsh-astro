import { useEffect, useRef, useState } from "react"

import { CAVEAT_WOFF2_BASE64 } from "@/lib/font-data"
import { playSound } from "@/lib/sound"
import {
  downloadBlob,
  drawStroke,
  getStroke,
  getStrokePath,
  makePdfFromCanvas,
  toolOptions,
} from "@/lib/drawing"
import { useDrawingEngine } from "@/hooks/useDrawingEngine"
import DrawingToolbar from "@/components/sketchbook/DrawingToolbar"
import { DrawingEditorLayout } from "@/components/DrawingEditorLayout"

const POSTCARD_RATIO = 3 / 2
const DRAWING_FRACTION = 0.62
const EXPORT_SCALE = 2
const STORAGE_KEY = "postcard-strokes"
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
  const [from, setFrom] = useState("")
  const postcardRef = useRef<HTMLDivElement>(null)
  const [fontLoaded, setFontLoaded] = useState(false)

  useEffect(() => {
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (document.fonts.check('16px "Caveat"')) {
          setFontLoaded(true)
        } else {
          const checkFont = () => {
            if (document.fonts.check('16px "Caveat"')) {
              setFontLoaded(true)
            } else {
              setTimeout(checkFont, 200)
            }
          }
          checkFont()
        }
      })
    } else {
      setFontLoaded(true)
    }
  }, [])

  function getPalette() {
    const canvas = canvasRef.current
    if (!canvas) return { paper: "#ffffff", ink: "#000000", marker: "#000000" }
    const styles = window.getComputedStyle(canvas)
    return {
      paper: styles.backgroundColor,
      ink: styles.color,
      marker: styles.color,
    }
  }

  async function exportPng() {
    playSound("export")
    const blob = await compositeForExport("image/png")
    if (blob) downloadBlob(blob, "postcard.png")
  }

  async function exportPdf() {
    playSound("export")
    const blob = await compositeForExport("image/png")
    if (!blob) return

    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.src = url
    await new Promise((resolve) => { img.onload = resolve })
    URL.revokeObjectURL(url)

    const offscreen = document.createElement("canvas")
    offscreen.width = img.naturalWidth
    offscreen.height = img.naturalHeight
    const ctx = offscreen.getContext("2d")
    if (!ctx) return
    ctx.drawImage(img, 0, 0)

    const pdf = makePdfFromCanvas(offscreen)
    if (!pdf) return
    downloadBlob(pdf, "postcard.pdf")
  }

  async function compositeForExport(
    type: "image/png" | "image/jpeg" = "image/png",
  ): Promise<Blob | null> {
    const postcard = postcardRef.current
    if (!postcard) return null

    const dpr = EXPORT_SCALE
    const postcardWidth = postcard.offsetWidth * dpr
    const postcardHeight = postcardWidth / POSTCARD_RATIO

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(postcardWidth)
    canvas.height = Math.round(postcardHeight)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    const palette = getPalette()
    ctx.scale(dpr, dpr)
    const cssW = postcardWidth / dpr
    const cssH = postcardHeight / dpr
    const drawH = cssH * DRAWING_FRACTION

    ctx.fillStyle = palette.paper
    ctx.fillRect(0, 0, cssW, cssH)

    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const sx = cssW / rect.width
      const sy = drawH / rect.height
      ctx.save()
      ctx.scale(sx, sy)
      strokes.forEach((s) => drawStroke(ctx, s, palette))
      ctx.restore()
    }

    const bodyTop = cssH * DRAWING_FRACTION
    ctx.font = fontLoaded ? "22px 'Caveat', cursive" : "22px cursive"
    ctx.fillStyle = palette.ink
    ctx.textAlign = "left"

    const maxTextWidth = cssW - 48
    if (message) {
      const lines = wrapText(ctx, message, maxTextWidth)
      let y = bodyTop + 36
      for (const line of lines) {
        ctx.fillText(line, 24, y)
        y += 28
      }
    }

    if (from) {
      ctx.font = fontLoaded ? "20px 'Caveat', cursive" : "20px cursive"
      ctx.textAlign = "right"
      ctx.fillText(`~ ${from}`, cssW - 24, bodyTop + 110)
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, 0.92)
    })
  }

  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    const words = text.split(" ")
    const lines: string[] = []
    let current = ""

    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : [text]
  }

  function generateAnimatedHtml() {
    const postcard = postcardRef.current
    if (!postcard) return

    const cssWidth = postcard.offsetWidth
    const cssHeight = cssWidth / POSTCARD_RATIO
    const drawHeight = cssHeight * DRAWING_FRACTION
    const palette = getPalette()

    const svgPaths = strokes
      .map((stroke) => {
        const outline = getStroke(stroke.points, {
          ...toolOptions[stroke.tool],
          simulatePressure: true,
        })
        const fill = stroke.tool === "eraser" ? palette.paper : palette.ink
        const opacity = stroke.tool === "marker" ? 0.32 : 0.92
        return `    <path d="${getStrokePath(outline)}" fill="${fill}" opacity="${opacity}" />`
      })
      .join("\n")

    const escapedMessage = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
    const escapedFrom = from
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Postcard</title>
<style>
@font-face {
  font-family: 'Caveat';
  src: url(data:font/woff2;base64,${CAVEAT_WOFF2_BASE64}) format('woff2');
  font-weight: 400;
  font-style: normal;
}
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  font-family: 'Caveat', 'Segoe UI', cursive;
  background: #efe6d8;
  background-image:
    radial-gradient(ellipse at 50% 0%, rgba(255,248,235,0.6) 0%, transparent 70%),
    radial-gradient(ellipse at 50% 100%, rgba(180,160,140,0.06) 0%, transparent 60%);
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  opacity: 0.03;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.008) 1px, rgba(0,0,0,0.008) 2px),
    repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.008) 1px, rgba(0,0,0,0.008) 2px);
  pointer-events: none;
}

.postcard {
  width: 760px;
  max-width: 100%;
  background: #faf6f0;
  background-image:
    linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%),
    linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 3px);
  border-radius: 8px;
  overflow: hidden;
  box-shadow:
    0 1px 3px rgba(0,0,0,0.04),
    0 4px 24px rgba(0,0,0,0.06),
    0 12px 48px rgba(0,0,0,0.04);
}

.drawing { line-height: 0; }
.drawing svg { display: block; width: 100%; height: auto; }

.body { padding: 1.5rem 2rem 2rem; }

.message {
  font-size: 1.375rem;
  line-height: 1.6;
  color: #2c2c2c;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.divider { height: 1px; background: #e0d8cc; margin: 0.75rem 0; }

.from {
  font-size: 1.125rem;
  text-align: right;
  color: #555;
}

.footer {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  font-size: 0.75rem;
  line-height: 1.4;
  text-align: right;
  color: rgba(100,90,80,0.35);
  pointer-events: none;
}
</style>
</head>
<body>
<div class="postcard">
  <div class="drawing">
    <svg viewBox="0 0 ${cssWidth} ${drawHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${palette.paper}"/>
${svgPaths}
    </svg>
  </div>
  <div class="body">
    ${escapedMessage ? `<div class="message">${escapedMessage}</div>` : ""}
    <div class="divider"></div>
    ${escapedFrom ? `<div class="from">~ ${escapedFrom}</div>` : ""}
  </div>
</div>
<div class="footer">Made with<br/>rohan.dev/sketchbook</div>
</body>
</html>`

    playSound("export")
    downloadBlob(
      new Blob([html], { type: "text/html" }),
      "postcard.html",
    )
  }

  const exportItems = [
    { label: "PNG", onExport: exportPng },
    { label: "PDF", onExport: exportPdf },
    { label: "Animated HTML", onExport: generateAnimatedHtml },
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

      <div
        ref={postcardRef}
        className="postcard-frame"
      >
        <div className="postcard-drawing">
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

        <div className="postcard-body">
          {message ? (
            <div className="postcard-message handwritten">
              {message}
            </div>
          ) : null}
          <div className="postcard-divider" />
          {from ? (
            <div className="postcard-from handwritten">~ {from}</div>
          ) : null}
        </div>
      </div>

      <div className="postcard-fields">
        <label className="postcard-label" htmlFor="pc-message">
          Message
        </label>
        <textarea
          id="pc-message"
          className="postcard-input postcard-textarea"
          placeholder="Write something..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
        />
        <label className="postcard-label" htmlFor="pc-from">
          From
        </label>
        <input
          id="pc-from"
          className="postcard-input"
          type="text"
          placeholder="Your name"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>

      <p className="caption">
        P for pen, M for marker, E for eraser. Draw something, leave a note.
      </p>
    </DrawingEditorLayout>
  )
}
