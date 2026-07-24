import { useEffect } from "react"

import { playSound } from "@/lib/sound"

export default function CodeBlock() {
  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>(
      ".article-content pre"
    )

    blocks.forEach((pre) => {
      if (pre.dataset.enhanced === "true") return

      const code = pre.querySelector("code")
      const lines = pre.querySelectorAll<HTMLElement>(".line")
      const languageClass = [...(code?.classList ?? [])].find((className) =>
        className.startsWith("language-")
      )
      const language = languageClass?.replace("language-", "")
      const filename =
        pre.dataset.filename ||
        pre.dataset.title ||
        pre.getAttribute("data-filename") ||
        pre.getAttribute("data-title") ||
        code?.getAttribute("data-filename") ||
        code?.getAttribute("data-title")

      pre.dataset.enhanced = "true"
      pre.tabIndex = 0
      lines.forEach((line, index) => {
        line.style.setProperty("--line-number", `"${index + 1}"`)
      })

      const wrapper = document.createElement("div")
      wrapper.className = "article-code-frame"
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(pre)

      const toolbar = document.createElement("div")
      toolbar.className = "article-code-toolbar"

      const badge = document.createElement("span")
      badge.className = "article-code-badge"
      badge.textContent = filename || language || "code"

      const button = document.createElement("button")
      button.type = "button"
      button.className = "article-code-copy"
      button.textContent = "Copy"
      button.setAttribute("aria-label", "Copy code")

      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(code?.textContent ?? "")
        playSound("copy")
        button.textContent = "✓ Copied"
        button.setAttribute("aria-label", "Code copied")
        window.setTimeout(() => {
          button.textContent = "Copy"
          button.setAttribute("aria-label", "Copy code")
        }, 1600)
      })

      toolbar.append(badge, button)
      wrapper.insertBefore(toolbar, pre)
    })
  }, [])

  return null
}
