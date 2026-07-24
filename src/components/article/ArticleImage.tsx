import { motion, useReducedMotion } from "motion/react"
import type { ImgHTMLAttributes } from "react"

import { pageTransition } from "@/lib/animations"

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  caption?: string
}

export default function ArticleImage({ caption, alt = "", ...props }: Props) {
  const reduceMotion = useReducedMotion()

  return (
    <figure className="my-10">
      <motion.img
        {...props}
        alt={alt}
        className={`w-full rounded-md border border-border ${props.className ?? ""}`}
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.995 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={pageTransition}
      />
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
