export function getReadingTime(body: string | undefined, wordsPerMinute = 210) {
  const wordCount = body?.trim().split(/\s+/).filter(Boolean).length ?? 0
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute))
}
