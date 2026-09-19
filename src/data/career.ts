/**
 * Career + life data for the About page.
 *
 * Every entry below is sourced from content already in this repository —
 * `src/pages/about.astro` and
 * `src/content/writing/starting-with-a-clean-slate.mdx`.
 * Nothing here invents companies, roles, or dates. Year granularity is used
 * throughout because the sources rarely state months.
 *
 * Gaps we know about (do NOT fill these in without asking Rohan):
 * - exact start/end months for any role
 * - Hoora start date (only "currently working" is stated)
 * - the small company's name ("a small company" is all the essay says)
 * - the 2026 company's name (deliberately unnamed in the essay)
 * - anything before graduation (B.Tech 2024); college start year is unknown
 */

export type LifeEntry = {
  /** Display label: a year ("2025"), "Now", etc. */
  period: string
  /** True for the current entry — rendered with stronger emphasis. */
  current?: boolean
  /** Full text (source of truth, always kept). */
  text: string
  /** Concise one-liner actually rendered in the timeline UI. */
  short: string
}

export type WorkRole = {
  title: string
  company: string
  /** Calendar year the role started. */
  startYear: number
  /**
   * Calendar year the role ended (inclusive), or null for the current role.
   * Bars span Jan 1 of startYear through Jan 1 of endYear + 1.
   */
  endYear: number | null
  description: string
  /** Concise one-to-two-line summary rendered under the timeline. */
  blurb: string
}

export const lifeEntries: LifeEntry[] = [
  {
    period: "Now",
    current: true,
    text: "Software Engineer at Hoora in Mumbai. Trying to become a better engineer — writing more code, reading more carefully. Away from the desk: photographs, walks, overthinking something new.",
    short: "Software Engineer at Hoora in Mumbai.",
  },
  {
    period: "2026",
    text: "Picked up design projects after leaving BunqLabs. Joined an early-stage team as a designer, grew into development work, and had the offer revoked during probation. Received a verbal MERN confirmation and started documenting the journey here.",
    short: "Design projects, a short design→dev stint, started writing here.",
  },
  {
    period: "2025",
    text: "Spent almost a year at BunqLabs in Bangalore, learning design, taste, and people from Sindhur Dutta. Left in December.",
    short: "Almost a year at BunqLabs, Bangalore. Left in December.",
  },
  {
    period: "2024",
    text: "Graduated in Computer Science. Placements didn't work out, so started freelancing — mostly design, some development — and joined a small company as a User Experience Designer.",
    short: "Graduated in CS. Freelanced, then joined a small company as a UX designer.",
  },
]

export const workRoles: WorkRole[] = [
  {
    title: "Software Engineer",
    company: "Hoora",
    startYear: 2026,
    endYear: null,
    description:
      "Crafting high-fidelity digital experiences. Focused on front-end architecture and interface design — sharp typography, macro-spacing, intentional motion.",
    blurb: "High-fidelity digital experiences; front-end architecture and interface design.",
  },
  {
    title: "Designer",
    company: "Undisclosed",
    startYear: 2026,
    endYear: 2026,
    description:
      "Joined an early-stage team in a design role that grew into development work. The offer was revoked during probation — bruising, but instructive.",
    blurb: "Design role that grew into development. Offer revoked in probation.",
  },
  {
    title: "Designer",
    company: "BunqLabs",
    startYear: 2025,
    endYear: 2025,
    description:
      "Almost a year in Bangalore. Learned design, taste, and people under Sindhur Dutta's patient, serious-about-the-work leadership. Left in December 2025.",
    blurb: "A year in Bangalore learning design, taste, and people.",
  },
  {
    title: "User Experience Designer",
    company: "Small company",
    startYear: 2024,
    endYear: 2024,
    description:
      "First structured role alongside freelancing — the scaffolding I needed more than I admitted at the time.",
    blurb: "First structured role alongside freelancing.",
  },
  {
    title: "Freelance Designer",
    company: "Freelance",
    startYear: 2024,
    endYear: 2024,
    description:
      "Mostly design work with development whenever the project needed it. Forced fast, practical learning — no theory to hide behind.",
    blurb: "Design and dev work, figured out quickly.",
  },
]
