export type Project = {
  title: string
  description: string
  href: string
  external?: boolean
}

export const projects: Project[] = [
  {
    title: "Grain",
    description:
      "Experimental image processing. Transform modern images into retro digital aesthetics.",
    href: "https://grain-five-kappa.vercel.app/",
    external: true,
  },
  {
    title: "Psychexcel",
    description:
      "Psychology with examiner-crafted resources, AI-powered feedback and expert tuition.",
    href: "https://psychexcel.com",
    external: true,
  },
  {
    title: "Eline",
    description:
      "A real-time group chat platform built around rooms, memberships, users, and persistent messaging.",
    href: "https://github.com/rohan-pckg/E_line",
    external: true,
  },
  {
    title: "Portfolio",
    description:
      "Minimalist portfolio built with Astro, React, Framer Motion, and Tailwind CSS.",
    href: "https://github.com/rohan-pckg/rnsh-astro",
    external: true,
  },
]
