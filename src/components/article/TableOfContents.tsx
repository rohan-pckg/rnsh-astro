import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"

import { fadeUp, spring, stagger } from "@/lib/animations"
import { playSound } from "@/lib/sound"

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
  const sheetRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const activeParent = parentFor(groups, activeSlug)

  useEffect(() => {
    const targets = headings
      .map((heading) => document.getElementById(heading.slug))
      .filter(Boolean) as HTMLElement[]

    if (targets.length === 0) return

    function updateActiveHeading() {
      const offset = Math.min(window.innerHeight * 0.28, 220)
      const current =
        [...targets]
          .reverse()
          .find((target) => target.getBoundingClientRect().top <= offset) ??
        targets[0]

      if (current?.id) setActiveSlug(current.id)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible[0]?.target.id) {
          setActiveSlug(visible[0].target.id)
        } else {
          updateActiveHeading()
        }
      },
      {
        rootMargin: "-12% 0px -70% 0px",
        threshold: [0, 1],
      }
    )

    targets.forEach((target) => observer.observe(target))
    updateActiveHeading()
    window.addEventListener("scroll", updateActiveHeading, { passive: true })
    window.addEventListener("resize", updateActiveHeading)

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", updateActiveHeading)
      window.removeEventListener("resize", updateActiveHeading)
    }
  }, [headings])

  useEffect(() => {
    if (!open) return

    window.setTimeout(() => {
      sheetRef.current
        ?.querySelector<HTMLElement>("button, [href], [tabindex]")
        ?.focus()
    }, 0)

    function handleDialogKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet()
      if (event.key !== "Tab") return

      const focusable = [
        ...(sheetRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []),
      ].filter((el) => !el.hasAttribute("disabled"))

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleDialogKeydown)
    return () => document.removeEventListener("keydown", handleDialogKeydown)
  }, [open])

  function openSheet() {
    playSound("drawer", { variant: "open" })
    setOpen(true)
  }

  function closeSheet() {
    playSound("drawer", { variant: "close" })
    setOpen(false)
  }

  function scrollTo(slug: string) {
    document.getElementById(slug)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    })
    window.history.replaceState(null, "", `#${slug}`)
    setActiveSlug(slug)
    if (open) closeSheet()
  }

  if (groups.length === 0) return null

  const nav = (
    <motion.ol
      className="space-y-2 lg:space-y-1"
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
              className="metadata group relative flex min-h-11 w-full items-center py-2 pr-2 pl-5 text-left transition-colors duration-150 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none lg:min-h-0 lg:py-1.5 lg:pl-4"
              onClick={() => scrollTo(group.slug)}
            >
              {isActiveGroup && (
                <motion.span
                  layoutId="toc-active"
                  className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-foreground lg:top-1.5 lg:bottom-1.5 lg:w-px"
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
                  className="ml-5 space-y-1 overflow-hidden lg:ml-4 lg:space-y-0"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : spring}
                >
                  {group.children.map((child) => (
                    <li key={child.slug}>
                      <button
                        type="button"
                        className={`metadata block min-h-11 w-full py-2 pr-2 pl-5 text-left transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none lg:min-h-0 lg:py-1 lg:pl-4 ${
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
        <p className="metadata mb-4 text-muted-foreground">Contents</p>
        {nav}
      </nav>

      <div className="lg:hidden">
        <motion.button
          type="button"
          className="metadata fixed right-5 bottom-5 z-40 min-h-10 rounded-md bg-secondary px-4 py-2 text-foreground transition-colors duration-150 hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          transition={spring}
          onClick={openSheet}
        >
          Contents
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={closeSheet}
            >
              <motion.div
                ref={sheetRef}
                className="absolute right-0 bottom-0 left-0 max-h-[82vh] overflow-y-auto rounded-t-[2rem] border-t border-border bg-card px-6 pt-4 pb-8"
                initial={{ y: reduceMotion ? 0 : "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: reduceMotion ? 0 : "100%", opacity: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { ...spring, stiffness: 360, damping: 38 }
                }
                role="dialog"
                aria-modal="true"
                aria-label="Table of contents"
                drag={reduceMotion ? false : "y"}
                dragDirectionLock
                dragConstraints={{ top: 0, bottom: 120 }}
                dragElastic={0.08}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80 || info.velocity.y > 500) {
                    closeSheet()
                  }
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-6">
                  <button
                    type="button"
                    className="mx-auto mb-6 block h-1.5 w-11 rounded-full bg-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label="Close table of contents"
                    onClick={closeSheet}
                  />
                  <p className="metadata font-medium text-foreground">
                    Contents
                  </p>
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
