/**
 * How each homepage story's illustration is presented. Shared by the homepage
 * cards and the post endpoint (the drawer's illustration).
 *
 * The sketches are transparent PNGs (scripts/make-transparent.py), so they need
 * no blend mode; only the Figma's opacity for the arrows sketch is kept.
 */
export interface StoryPresentation {
  /** Card: the image is shown turned 90deg. */
  rotated: boolean
  /** Drawer: classes for the <img> and its box. */
  img: string
  box: string
}

export const storyPresentation: Record<string, StoryPresentation> = {
  "in-the-age-of-ai": {
    rotated: true,
    img: "h-[271px] w-[353px] rotate-90 object-cover opacity-70",
    box: "h-[360px]",
  },
  "write-it-before-you-forget": {
    rotated: false,
    img: "h-[223px] w-[273px] object-cover",
    box: "h-[240px]",
  },
}
