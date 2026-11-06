/**
 * Copy for the homepage's About hub. Mirrors the text on src/pages/about.astro
 * (kept in sync by hand; that page is unchanged). The full About content opens
 * in the left column (slug "full", see src/components/home/AboutFull.astro).
 */
export const aboutParagraphs: string[] = [
  "Based in Mumbai, India, I’m a 23-year-old engineer blending a formal background in Computer Science (B.Tech, 2024) with a passion for front-end architecture and interface design. I'm currently working as a Software Engineer at Hoora, where I focus on crafting high-fidelity digital experiences. I’m obsessed with the details that often go unnoticed sharp typography, macro-spacing, and intentional motion.",
  "When I step away from my desk, I'm usually wandering around taking photographs, walking, or overthinking something new.",
]

export const aboutLinks: {
  label: string
  value: string
  /** External link (opens in a new tab). */
  href?: string
  /** Opens this slug in the left column instead. */
  post?: string
}[] = [
  {
    label: "Resume",
    value: "View",
    href: "https://drive.google.com/file/d/1-OwRzZ0MiUsGfCJodpC7bJmnpdQbaSHy/view?usp=sharing",
  },
  { label: "About", value: "Read more", post: "full" },
]
