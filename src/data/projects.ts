export type Project = {
  title: string
  description: string
  href: string
  external?: boolean
  /** One plain sentence for the homepage's Work list. */
  summary?: string
  /** Short mono label for the Work list: the main stack, verified from the repo. */
  tag?: string
  // Optional cover visual. No project currently ships one, so the
  // showcase falls back to an abstract placeholder block.
  image?: string
}

export const projects: Project[] = [
  {
    title: "Grain",
    summary: "An image editor that gives modern photos retro looks like ASCII, CRT, VHS and halftone.",
    tag: "Next.js",
    description:
      "Experimental image processing. Transform modern images into retro digital aesthetics.",
    href: "https://grain-five-kappa.vercel.app/",
    external: true,
  },
  {
    title: "Psychexcel",
    summary: "A learning platform for A-level Psychology with courses, tuition and mentoring.",
    tag: "Next.js",
    description:
      "Psychology with examiner-crafted resources, AI-powered feedback and expert tuition.",
    href: "https://psychexcel.com",
    external: true,
  },
  {
    title: "Eline",
    summary: "A group chat app with rooms and saved messages, built with Elixir and Phoenix.",
    tag: "Elixir",
    description:
      "A real-time group chat platform built around rooms, memberships, users, and persistent messaging.",
    href: "https://github.com/rohan-pckg/E_line",
    external: true,
  },
  {
    title: "Portfolio",
    summary: "My portfolio, built with Astro, React and Tailwind CSS.",
    tag: "Astro",
    description:
      "Minimalist portfolio built with Astro, React, Framer Motion, and Tailwind CSS.",
    href: "https://github.com/rohan-pckg/rnsh-astro",
    external: true,
  },
]
