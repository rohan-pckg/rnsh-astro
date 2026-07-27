import type { ReactNode } from "react"

import {
  DRAWING_HEIGHT,
  POSTCARD_WIDTH,
  type PostcardDrawing,
  type PostcardTheme,
} from "@/lib/postcard"
import { getFittedDrawingPaths } from "@/lib/postcard"

export type PostcardTemplateProps = {
  drawing: PostcardDrawing
  message: string
  author: string
  theme: PostcardTheme
}

function Drawing({
  drawing,
  theme,
}: {
  drawing: PostcardDrawing
  theme: PostcardTheme
}) {
  const paths = getFittedDrawingPaths(drawing.strokes)
  return (
    <svg
      className="postcard-template__svg"
      viewBox={`0 0 ${POSTCARD_WIDTH} ${DRAWING_HEIGHT}`}
      role="img"
      aria-label="Postcard drawing preview"
    >
      <rect width="100%" height="100%" fill={theme.paper} />
      {paths.map((path, index) => (
        <path
          key={`${path.d}-${index}`}
          d={path.d}
          fill={path.fill === "paper" ? theme.paper : theme.ink}
          opacity={path.opacity}
        />
      ))}
    </svg>
  )
}

function Copy({
  message,
  author,
}: Pick<PostcardTemplateProps, "message" | "author">) {
  return (
    <div className="postcard-template__copy">
      {message ? <p className="postcard-template__message">{message}</p> : null}
      <div className="postcard-template__divider" />
      {author ? <p className="postcard-template__author">~ {author}</p> : null}
    </div>
  )
}

function Shell({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <article className={`postcard-template ${className}`}>{children}</article>
  )
}

export function ClassicTemplate({
  drawing,
  message,
  author,
  theme,
}: PostcardTemplateProps) {
  return (
    <Shell className="postcard-template--classic">
      <div className="postcard-template__drawing">
        <Drawing drawing={drawing} theme={theme} />
      </div>
      <Copy message={message} author={author} />
    </Shell>
  )
}

export function PolaroidTemplate({
  drawing,
  message,
  author,
  theme,
}: PostcardTemplateProps) {
  return (
    <Shell className="postcard-template--polaroid">
      <div className="postcard-template__drawing">
        <Drawing drawing={drawing} theme={theme} />
      </div>
      <Copy message={message} author={author} />
    </Shell>
  )
}

export function NotebookTemplate({
  drawing,
  message,
  author,
  theme,
}: PostcardTemplateProps) {
  return (
    <Shell className="postcard-template--notebook">
      <div className="postcard-template__holes" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="postcard-template__drawing">
        <Drawing drawing={drawing} theme={theme} />
      </div>
      <Copy message={message} author={author} />
    </Shell>
  )
}

export function StickyNoteTemplate({
  drawing,
  message,
  author,
  theme,
}: PostcardTemplateProps) {
  return (
    <Shell className="postcard-template--sticky-note">
      <div className="postcard-template__fold" aria-hidden="true" />
      <div className="postcard-template__drawing">
        <Drawing drawing={drawing} theme={theme} />
      </div>
      <Copy message={message} author={author} />
    </Shell>
  )
}

export function LetterTemplate({
  drawing,
  message,
  author,
  theme,
}: PostcardTemplateProps) {
  return (
    <Shell className="postcard-template--letter">
      <div className="postcard-template__drawing">
        <Drawing drawing={drawing} theme={theme} />
      </div>
      <Copy message={message} author={author} />
    </Shell>
  )
}
