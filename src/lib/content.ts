import { getCollection, type CollectionEntry } from "astro:content"

type CollectionName = "writing" | "design"

export async function getPublishedSorted<T extends CollectionName>(
  collection: T
): Promise<CollectionEntry<T>[]> {
  return (await getCollection(collection))
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}
