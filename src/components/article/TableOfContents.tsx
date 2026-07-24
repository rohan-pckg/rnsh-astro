import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useMemo, useState } from "react"

import { fadeUp, spring, stagger } from "@/lib/animations"

export type TocHeading = {
  depth: number
  slug: string
  text: string
}

type TocGroup = TocHeading & {
  children: TocHeading[]
}

type Props = {
  headings: TocHeading[]
}

function buildGroups(headings: TocHeading[]) {
  const groups: TocGroup[] = []

  headings
    .filter((heading) => heading.depth === 2 || heading.depth === 3)
    .forEach((heading) => {
      if (heading.depth === 2 || groups.length === 0) {
        groups.push({ ...heading, children: [] })
        return
      }

      groups[groups.length - 1].children.push(heading)
    })

  return groups
}

function parentFor(groups: TocGroup[], slug: string) {
  const directParent = groups.find((group) => group.slug === slug)
  if (directParent) return directParent.slug

  return groups.find((group) =>
    group.children.some((child) => child.slug === slug)
  )?.slug
}

export default function TableOfContents({ headings }: Props) {
  const groups = useMemo(() => buildGroups(headings), [headings])
  const [activeSlug, setActiveSlug] = useState(groups[0]?.slug ?? "")
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const activeParent = parentFor(groups, activeSlug)

  useEffect(() => {
    const targets = headings
      .map((heading) => document.getElementById(heading.slug))
      .filter(Boolean) as HTMLElement[]

    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible[0]?.target.id) {
          setActiveSlug(visible[0].target.id)
        }
      },
      {
        rootMargin: "-18% 0px -68% 0px",
        threshold: [0, 1],
      }
    )

    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [headings])

  function scrollTo(slug: string) {
    document.getElementById(slug)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    })
    window.history.replaceState(null, "", `#${slug}`)
    setOpen(false)
  }

  if (groups.length === 0) return null

  const nav = (
    <motion.ol
      className="space-y-1"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {groups.map((group) => {
        const isActiveGroup = activeParent === group.slug
        const isActive = activeSlug === group.slug

        return (
          <motion.li key={group.slug} variants={fadeUp}>
            <button
              type="button"
              className="group relative flex w-full items-center py-1.5 pr-2 pl-4 text-left text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => scrollTo(group.slug)}
            >
              {isActiveGroup && (
                <motion.span
                  layoutId="toc-active"
                  className="absolute top-1.5 bottom-1.5 left-0 w-px bg-foreground"
                  transition={spring}
                />
              )}
              <span className={isActive ? "text-foreground" : ""}>
                {group.text}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isActiveGroup && group.children.length > 0 && (
                <motion.ol
                  className="ml-4 overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : spring}
                >
                  {group.children.map((child) => (
                    <li key={child.slug}>
                      <button
                        type="button"
                        className={`block w-full py-1 pr-2 pl-4 text-left text-xs transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
                          activeSlug === child.slug
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => scrollTo(child.slug)}
                      >
                        {child.text}
                      </button>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </motion.li>
        )
      })}
    </motion.ol>
  )

  return (
    <>
      <nav aria-label="Table of contents" className="hidden lg:block">
        <p className="mb-4 text-xs font-medium text-foreground">Contents</p>
        {nav}
      </nav>

      <div className="lg:hidden">
        <motion.button
          type="button"
          className="fixed right-5 bottom-5 z-40 rounded-full border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          onClick={() => setOpen(true)}
        >
          Contents
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <motion.div
                className="absolute right-0 bottom-0 left-0 border-t border-border bg-background p-6"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={reduceMotion ? { duration: 0 } : spring}
                role="dialog"
                aria-modal="true"
                aria-label="Table of contents"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Contents
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
                {nav}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
