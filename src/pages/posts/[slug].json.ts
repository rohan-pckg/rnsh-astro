/**
 * Per-item HTML fragment, generated at build time: /posts/<slug>.json.
 * The homepage drawer fetches it on demand, so no body ships in the homepage
 * HTML. Covers the homepage notes, the blog posts (Writing hub), the design
 * write-ups and the full About content (slug "full"); slugs are unique across them.
 */
import type { APIRoute, GetStaticPaths } from "astro"
import { getCollection, render } from "astro:content"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import mdxRenderer from "@astrojs/mdx/server.js"
import { notePresentation } from "@/data/note-presentation"
import AboutFull from "@/components/home/AboutFull.astro"

const pad2 = (n: number) => String(n).padStart(2, "0")
const ddmmyy = (d: Date) =>
  `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCFullYear() % 100)}`

export const getStaticPaths = (async () => {
  const notes = await getCollection("notes")
  const writing = (await getCollection("writing")).filter((p) => !p.data.draft)
  const designs = (await getCollection("design")).filter((p) => !p.data.draft)
  return [
    ...notes.map((entry) => ({
      params: { slug: entry.id },
      props: { kind: "note" as const, entry },
    })),
    ...writing.map((entry) => ({
      params: { slug: entry.id },
      props: { kind: "blog" as const, entry },
    })),
    ...designs.map((entry) => ({
      params: { slug: entry.id },
      props: { kind: "design" as const, entry },
    })),
    { params: { slug: "full" }, props: { kind: "about" as const, entry: null } },
  ]
}) satisfies GetStaticPaths

export const GET: APIRoute = async ({ props }) => {
  const container = await AstroContainer.create()
  // MDX bodies (the real blog posts) need the MDX renderer registered.
  container.addServerRenderer({ name: "@astrojs/mdx", renderer: mdxRenderer })
  const { kind, entry } = props as any

  if (kind === "about") {
    return new Response(
      JSON.stringify({
        id: "full",
        kind,
        title: "More about me",
        date: "About",
        html: await container.renderToString(AboutFull),
        image: null,
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  }

  const { Content } = await render(entry)
  const html = await container.renderToString(Content)

  let image: Record<string, unknown> | null = null
  let date: string
  if (kind === "note") {
    date = entry.data.date
    const pres = notePresentation[entry.id]
    image = entry.data.image && {
      src: entry.data.image.src,
      width: entry.data.image.width,
      height: entry.data.image.height,
      alt: entry.data.imageAlt,
      img: pres?.img ?? "",
      box: pres?.box ?? "",
    }
  } else {
    date = ddmmyy(entry.data.date)
  }

  return new Response(
    JSON.stringify({
      id: entry.id,
      kind,
      title: entry.data.title,
      date,
      html,
      image,
    }),
    { headers: { "Content-Type": "application/json" } }
  )
}
