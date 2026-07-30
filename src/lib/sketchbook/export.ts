import type { Stroke } from "./types"
import { getStrokesAsSvg, renderToOffscreenCanvas } from "./render"

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportPng(
  strokes: Stroke[],
  draftStroke: Stroke | null,
  width: number,
  height: number
) {
  const canvas = renderToOffscreenCanvas(strokes, draftStroke, width, height)
  downloadBlob(dataUrlToBlob(canvas.toDataURL("image/png")), "sketchbook.png")
}

export function exportSvg(strokes: Stroke[], width: number, height: number) {
  const svgContent = getStrokesAsSvg(strokes, width, height)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgContent}</svg>`
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "sketchbook.svg")
}

export function exportPdf(
  strokes: Stroke[],
  draftStroke: Stroke | null,
  width: number,
  height: number,
  pageWidth = 760
) {
  const canvas = renderToOffscreenCanvas(strokes, draftStroke, width, height)
  const pdf = makePdfFromCanvas(canvas, pageWidth)
  if (!pdf) return
  downloadBlob(pdf, "sketchbook.pdf")
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",")
  const mime = header?.match(/:(.*?);/)?.[1] ?? "image/png"
  const binary = atob(data ?? "")
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function makePdfFromCanvas(canvas: HTMLCanvasElement, pageWidth: number) {
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

  function object(
    id: number,
    body: string | Uint8Array,
    prefix = "",
    suffix = ""
  ) {
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
  object(
    5,
    content,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n`,
    "endstream"
  )

  const xref = cursor
  push(`xref\n0 6\n0000000000 65535 f \n`)
  for (let i = 1; i <= 5; i += 1) {
    push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`)
  }
  push(`trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`)

  return new Blob(chunks, { type: "application/pdf" })
}
