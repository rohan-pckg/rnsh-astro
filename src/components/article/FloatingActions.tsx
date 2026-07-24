import { motion } from "motion/react"

import { fadeIn, pageTransition } from "@/lib/animations"
import BackButton from "./BackButton"
import CopyLinkButton from "./CopyLinkButton"

type Props = {
  backHref?: string
}

export default function FloatingActions({ backHref = "/writing" }: Props) {
  return (
    <motion.div
      className="flex w-full items-center justify-between gap-3"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={pageTransition}
    >
      <BackButton fallbackHref={backHref} />
      <CopyLinkButton />
    </motion.div>
  )
}
