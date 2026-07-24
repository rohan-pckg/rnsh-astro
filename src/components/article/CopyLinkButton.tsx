import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"

import { fadeUp, scale, spring } from "@/lib/animations"

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
  }

  return (
    <motion.button
      type="button"
      aria-label={copied ? "Link copied" : "Copy article link"}
      className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground shadow-sm transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      variants={scale}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      transition={spring}
      onClick={copyLink}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            className="inline-flex items-center"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.14 }}
          >
            <i className="ri-check-line" aria-hidden="true" />
            <span className="sr-only">Link copied</span>
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            className="inline-flex items-center"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.14 }}
          >
            <i className="ri-link" aria-hidden="true" />
            <span className="sr-only">Copy link</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
