// src/content/config.ts
import { defineCollection, z } from "astro:content";

const writing = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.date(),
        draft: z.boolean().default(false),
    }),
});

export const collections = { writing };