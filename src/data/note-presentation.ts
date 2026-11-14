/**
 * How each homepage note's illustration is presented in the drawer. The
 * homepage cards style it themselves (.art-solo in pages/index.astro).
 *
 * The illustrations are black-and-white ink doodle SVGs (src/assets, generated
 * by originals/doodles/ink.py), shown as they are: no rotation, no fade. Dark
 * mode inverts them with a CSS filter.
 */
export interface StoryPresentation {
  /** Drawer: classes for the <img> and its box. */
  img: string
  box: string
}

const solo: StoryPresentation = {
  img: "h-[190px] w-[190px] object-contain",
  box: "h-[220px]",
}

export const notePresentation: Record<string, StoryPresentation> = {
  "in-the-age-of-ai": solo,
  "write-it-before-you-forget": solo,
}
