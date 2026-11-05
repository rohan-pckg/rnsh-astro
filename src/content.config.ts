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
    date: z.date(),
    draft: z.boolean().default(false),
  }),
})

// Posts shown on the homepage and opened in its drawer.
const stories = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/stories" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Display string, e.g. "10-12-22 10:00 AM". */
      date: z.string(),
      order: z.number().default(0),
      image: image(),
      imageAlt: z.string().default(""),
    }),
})

export const collections = { writing, design, stories }
