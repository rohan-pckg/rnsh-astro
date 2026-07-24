import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"

import { fadeUp, scale, spring } from "@/lib/animations"
import { playSound } from "@/lib/sound"

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    playSound("copy")
    setCopied(true)
  }

  return (
    <motion.button
      type="button"
      aria-label={copied ? "Link copied" : "Copy article link"}
      className="surface-button metadata"
      disabled={copied}
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
