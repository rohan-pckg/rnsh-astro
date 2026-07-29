import { useSyncExternalStore, useCallback } from "react"
import { sound } from "@/lib/sound"

function subscribeToMute(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getMutedSnapshot() {
  return sound.muted
}

export default function SoundToggle() {
  const muted = useSyncExternalStore(subscribeToMute, getMutedSnapshot, () => false)

  const toggle = useCallback(() => {
    sound.toggleMute()
    window.dispatchEvent(new Event("storage"))
  }, [])

  return (
    <button
      type="button"
      onClick={toggle}
      className="quiet-action"
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
    >
      {muted ? "Sound off" : "Sound on"}
    </button>
  )
}
