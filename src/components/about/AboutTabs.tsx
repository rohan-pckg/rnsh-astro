import { useEffect, useMemo, useRef, useState } from "react"
import { lifeEntries, workRoles, type WorkRole } from "@/data/career"

type Tab = "life" | "work"

type Bar = {
  role: WorkRole
  index: number
  x0: number
  x1: number
  lane: number
}

function periodLabel(role: WorkRole): string {
  if (role.endYear === null) return `${role.startYear} – Now`
  if (role.endYear === role.startYear) return `${role.startYear}`
  return `${role.startYear} – ${role.endYear}`
}

function LifeTimeline() {
  return (
    <ul className="life-list">
      {lifeEntries.map((entry) => (
        <li key={entry.period} className="life-item">
          <span className={`life-period${entry.current ? " is-now" : ""}`}>
            {entry.period}
          </span>
          <p className="life-text">{entry.short}</p>
        </li>
      ))}
    </ul>
  )
}

function WorkTimeline() {
  const now = useMemo(() => {
    const d = new Date()
    return d.getFullYear() + d.getMonth() / 12
  }, [])

  const { years, bars, scaleStart, scaleEnd } = useMemo(() => {
    const starts = workRoles.map((r) => r.startYear)
    const ends = workRoles.map((r) =>
      r.endYear === null ? now : r.endYear + 1
    )
    const scaleStart = Math.min(...starts) - 1
    const scaleEnd =
      Math.max(Math.ceil(Math.max(...ends)), Math.max(...starts) + 1) + 1

    const years: number[] = []
    for (let y = scaleStart; y < scaleEnd; y++) years.push(y)

    // Greedy interval packing so overlapping roles stack in lanes.
    const order = workRoles
      .map((role, index) => ({ role, index }))
      .sort((a, b) => a.role.startYear - b.role.startYear)
    const laneEnds: number[] = []
    const bars: Bar[] = order.map(({ role, index }) => {
      const x0 = role.startYear
      const x1 = role.endYear === null ? now : role.endYear + 1
      let lane = laneEnds.findIndex((end) => end <= x0)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(x1)
      } else {
        laneEnds[lane] = x1
      }
      return { role, index, x0, x1, lane }
    })

    return { years, bars, laneCount: laneEnds.length, scaleStart, scaleEnd }
  }, [now])

  const span = scaleEnd - scaleStart
  const toPct = (year: number) => ((year - scaleStart) / span) * 100
  const nowPct = toPct(Math.min(now, scaleEnd - 0.001))

  const currentIndex = workRoles.findIndex((r) => r.endYear === null)
  const [selected, setSelected] = useState<number | null>(currentIndex)
  const active = selected !== null ? workRoles[selected] : null

  // Refine lanes from rendered geometry: bars are at least as wide as
  // their content (never clipped), so overlap is resolved from actual
  // rects rather than theoretical durations. Recomputed on resize and
  // once webfonts settle, since both change rendered widths.
  const canvasRef = useRef<HTMLDivElement>(null)
  const barRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [measuredLanes, setMeasuredLanes] = useState<number[] | null>(null)

  useEffect(() => {
    const GAP = 16
    const recompute = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const cLeft = canvas.getBoundingClientRect().left
      const rects = bars.map((bar) => {
        const el = barRefs.current[bar.index]
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { index: bar.index, left: r.left - cLeft, right: r.right - cLeft }
      })
      if (rects.some((r) => r === null)) return
      const ordered = (rects as { index: number; left: number; right: number }[]).sort(
        (a, b) => a.left - b.left
      )
      const laneRights: number[] = []
      const next: number[] = new Array(bars.length).fill(0)
      for (const { index, left, right } of ordered) {
        let lane = laneRights.findIndex((edge) => edge + GAP <= left)
        if (lane === -1) {
          lane = laneRights.length
          laneRights.push(right)
        } else {
          laneRights[lane] = right
        }
        next[index] = lane
      }
      setMeasuredLanes((prev) =>
        prev && prev.every((l, i) => l === next[i]) ? prev : next
      )
    }
    recompute()
    window.addEventListener("resize", recompute)
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) recompute()
    }).catch(() => {})
    return () => {
      cancelled = true
      window.removeEventListener("resize", recompute)
    }
  }, [bars])

  const laneOf = (barIndex: number, fallback: number) =>
    measuredLanes ? measuredLanes[barIndex] : fallback
  const renderLaneCount = measuredLanes
    ? Math.max(...measuredLanes) + 1
    : Math.max(...bars.map((b) => b.lane)) + 1

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Center the Now indicator when the timeline overflows (mobile).
    const el = scrollRef.current
    if (!el || el.scrollWidth <= el.clientWidth + 1) return
    const canvas = el.firstElementChild as HTMLElement | null
    if (!canvas) return
    const target = (nowPct / 100) * canvas.clientWidth - el.clientWidth / 2
    el.scrollLeft = Math.max(0, target)
  }, [nowPct])

  return (
    <div className="work-timeline">
      <div className="work-breakout">
        <div ref={scrollRef} className="work-scroll" tabIndex={-1}>
        <div
          ref={canvasRef}
          className="work-canvas"
          style={{ height: `${renderLaneCount * 116 + 80}px` }}
        >
          <div className="work-axis" aria-hidden="true" />
          {years.map((year, yi) => (
            <span
              key={year}
              className={`work-year${yi === 0 ? " tick-first" : ""}${yi === years.length - 1 ? " tick-last" : ""}`}
              style={{ left: `${toPct(year)}%` }}
              aria-hidden="true"
            >
              {year}
            </span>
          ))}
          <div
            className="work-now"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          >
            <span className="work-now-dot" />
            <span className="work-now-label">NOW</span>
          </div>
          {bars.map((bar) => {
            const dimmed = selected !== null && selected !== bar.index
            const lane = laneOf(bar.index, bar.lane)
            return (
              <button
                key={bar.index}
                ref={(el) => {
                  barRefs.current[bar.index] = el
                }}
                type="button"
                className={`work-bar${selected === bar.index ? " is-selected" : ""}${dimmed ? " is-dimmed" : ""}`}
                style={{
                  left: `${toPct(bar.x0)}%`,
                  // NOTE: `max(pct%, max-content)` is NOT valid CSS (math
                  // functions reject intrinsic keywords), so the floor is
                  // expressed as width + min-width instead.
                  width: "max-content",
                  minWidth: `${toPct(bar.x1) - toPct(bar.x0)}%`,
                  maxWidth: "100%",
                  top: `${56 + lane * 116}px`,
                }}
                aria-pressed={selected === bar.index}
                aria-label={`${bar.role.title} at ${bar.role.company}, ${periodLabel(bar.role)}`}
                onClick={() =>
                  setSelected((prev) => (prev === bar.index ? null : bar.index))
                }
              >
                <span className="work-bar-main">
                  <span className="work-bar-title">{bar.role.title}</span>
                  <span className="work-bar-company">{bar.role.company}</span>
                </span>
                <span className="work-bar-period">
                  {periodLabel(bar.role)}
                </span>
              </button>
            )
          })}
          </div>
        </div>
      </div>

      <div className="work-detail" aria-live="polite">
        {active ? (
          <div key={active.company + active.title}>
            <p className="work-detail-head">
              {active.title} · {active.company}
            </p>
            <p className="work-detail-period">{periodLabel(active)}</p>
            <p className="work-detail-text">{active.blurb}</p>
          </div>
        ) : (
          <p className="work-detail-hint">Select a role to read more.</p>
        )}
      </div>
    </div>
  )
}

export default function AboutTabs() {
  const [tab, setTab] = useState<Tab>("life")

  return (
    <div className="about-tabs">
      <div className="about-tablist" role="tablist" aria-label="About sections">
        {(["life", "work"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`about-panel-${value}`}
            id={`about-tab-${value}`}
            className={`about-tab${tab === value ? " is-active" : ""}`}
            data-sound="tool-switch"
            onClick={() => setTab(value)}
          >
            {value === "life" ? "Life" : "Work"}
          </button>
        ))}
      </div>

      <div
        key={tab}
        className="about-panel"
        role="tabpanel"
        id={`about-panel-${tab}`}
        aria-labelledby={`about-tab-${tab}`}
      >
        {tab === "life" ? <LifeTimeline /> : <WorkTimeline />}
      </div>
    </div>
  )
}
