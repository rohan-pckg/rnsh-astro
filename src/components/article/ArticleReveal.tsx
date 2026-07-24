import { animate, useReducedMotion } from "motion/react"
import { useEffect } from "react"

export default function ArticleReveal() {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) return

    const elements = document.querySelectorAll<HTMLElement>(
      ".article-shell, .article-content > h2, .article-content > h3, .article-content > p, .article-content > blockquote, .article-content > ul, .article-content > ol, .article-content > .article-code-frame, .article-content > table, .article-content img"
    )

    elements.forEach((element) => {
      element.style.opacity = "0"
      element.style.transform = "translateY(8px)"
    })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return

          const element = entry.target as HTMLElement
          animate(
            element,
            { opacity: 1, transform: "translateY(0px)" },
            { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
          )
          observer.unobserve(element)
        })
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [reduceMotion])

  return null
}
