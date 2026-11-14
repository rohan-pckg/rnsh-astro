import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const writing = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/writing" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    cover: z.string().optional(),
    category: z.string().default("Writing"),
    draft: z.boolean().default(false),
  }),
})

const design = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/design" }),
  schema: z.object({
    thumbnail: z.string(),
    title: z.string(),
    description: z.string(),
    /** One plain sentence for the Work list (the description is for SEO). */
    summary: z.string(),
    date: z.date(),
    draft: z.boolean().default(false),
  }),
})

// Homepage cards. A card with hub "notes" is a short philosophical note that
// opens in the Notes hub; the card with hub "writing" is the entry to the
// Writing hub, which lists the blog posts (the `writing` collection).
const notes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/notes" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Display string, e.g. "10-12-22 10:00 AM". */
      date: z.string(),
      order: z.number().default(0),
      /** Which drawer hub the homepage card opens: the Notes list, or the Writing (blog) list. */
      hub: z.enum(["notes", "writing"]).default("notes"),
      /** Optional: a note without art is just text in the drawer. */
      image: image().optional(),
      /** Whether the note also gets a card on the homepage (otherwise it only lives in the Notes list). */
      card: z.boolean().default(true),
      imageAlt: z.string().default(""),
      /** One plain sentence shown under the title in the Writing list. */
      summary: z.string(),
    }),
})

export const collections = { writing, design, notes }
