/**
 * The two cards in the homepage's new row. Adding another card is one line.
 *
 * - `id` is the drawer panel id and the URL value: /?page=<id>
 * - `dateLabel` is the monospace label in the card's top-right. It is
 *   placeholder text from the design; delete the field to remove the label.
 * - `image` is a key for src/assets/<image>.png (a transparent sketch; see
 *   scripts/make-transparent.py). With no file the card shows an empty slot.
 */
export interface HomeCard {
  id: string
  title: string
  action: string
  dateLabel?: string
  image?: string
  /** Image opacity (the Figma export draws these sketches slightly faded). */
  opacity?: number
}

export const homeCards: HomeCard[] = [
  {
    id: "about",
    title: "More about me",
    action: "Read",
    dateLabel: "10-12-22 10:00 AM",
    image: "about",
    opacity: 0.6,
  },
  {
    id: "work",
    title: "Design and code",
    action: "Open",
    dateLabel: "10-12-22 10:00 AM",
    image: "work",
    opacity: 0.7,
  },
]
