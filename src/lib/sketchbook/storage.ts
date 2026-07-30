import { migrateLegacyStrokes } from "./coordinates"
import type { Stroke } from "./types"

export function loadStrokes(storageKey: string): Stroke[] {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (!saved) return []
    return migrateLegacyStrokes(JSON.parse(saved))
  } catch {
    return []
  }
}

export function saveStrokes(storageKey: string, strokes: Stroke[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(strokes))
  } catch {
    // Storage may be unavailable in private browsing or when quota is exceeded.
  }
}
