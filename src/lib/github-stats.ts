/**
 * GitHub contribution stats for the homepage block, fetched at build time.
 *
 * Source, in order:
 *  1. GITHUB_STATS=off  -> the bundled sample (src/data/github-sample.json),
 *     for developing offline. Never use this for a real deploy.
 *  2. GITHUB_TOKEN set  -> GitHub's own GraphQL API (first party).
 *  3. otherwise         -> the public github-contributions-api (no token).
 * If the fetch fails the block is simply not rendered (null); it never shows
 * made-up numbers.
 */
import sample from "@/data/github-sample.json"

export interface Day {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}
export interface GithubStats {
  total: number
  /** Columns of 7 (Sunday first); null pads the first and last week. */
  weeks: (Day | null)[][]
  longest: number
  current: number
  active: number
}

const env = (k: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k]

const levelOf = (n: number): Day["level"] =>
  n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4

function summarize(days: Day[]): GithubStats {
  const first = new Date(days[0]!.date + "T00:00:00Z").getUTCDay()
  const cells: (Day | null)[] = [...Array<null>(first).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  const weeks: (Day | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  let longest = 0
  let run = 0
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  // Current streak: counted back from today; an empty "today" doesn't break it.
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.count > 0) current++
    else if (i === days.length - 1) continue
    else break
  }
  return {
    total: days.reduce((s, d) => s + d.count, 0),
    weeks,
    longest,
    current,
    active: days.filter((d) => d.count > 0).length,
  }
}

function fromSample(): GithubStats {
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  const days: Day[] = (sample as number[]).map((count, i, a) => {
    const d = new Date(end)
    d.setUTCDate(end.getUTCDate() - (a.length - 1 - i))
    return { date: d.toISOString().slice(0, 10), count, level: levelOf(count) }
  })
  return summarize(days)
}

async function fromGraphql(user: string, token: string): Promise<GithubStats> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}`,
      variables: { u: user },
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(String(res.status))
  const json = await res.json()
  const lv = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 } as const
  const days: Day[] = json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w: any) => w.contributionDays)
    .map((d: any) => ({
      date: d.date,
      count: d.contributionCount,
      level: lv[d.contributionLevel as keyof typeof lv] ?? 0,
    }))
  return summarize(days)
}

async function fromPublic(user: string): Promise<GithubStats> {
  const res = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(String(res.status))
  const json = await res.json()
  const days: Day[] = (json.contributions as Day[])
    .map((d) => ({ date: d.date, count: d.count, level: (d.level ?? levelOf(d.count)) as Day["level"] }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return summarize(days)
}

let cached: Promise<GithubStats | null> | undefined
export function getGithubStats(user: string): Promise<GithubStats | null> {
  cached ??= (async () => {
    if (env("GITHUB_STATS") === "off") return fromSample()
    try {
      const token = env("GITHUB_TOKEN")
      return token ? await fromGraphql(user, token) : await fromPublic(user)
    } catch (e) {
      console.warn(`[github-stats] skipped: ${(e as Error).message}`)
      return null
    }
  })()
  return cached
}
