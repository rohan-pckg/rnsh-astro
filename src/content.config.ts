import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const writing = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/writing" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
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

export const collections = { writing, design }
