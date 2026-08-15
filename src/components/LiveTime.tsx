import { useEffect, useState } from "react"

function formatTime(date: Date): string {
  return date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZoneName: "short",
  })
}

export default function LiveTime() {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="live-time">
      <span className="live-time-time">{formatTime(now)}</span>
      <span className="live-time-date">{formatDate(now)}</span>
    </div>
  )
}
