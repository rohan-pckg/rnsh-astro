import {
  bind,
  play,
  setEnabled,
  setVolume,
  type SoundName as CuelumeSoundName,
} from "cuelume"

const STORAGE_KEY = "rnsh-sound-muted"
const DEFAULT_VOLUME = 0.15

export type SoundName =
  | "navigate"
  | "open"
  | "back"
  | "clear"
  | "tool-switch"
  | CuelumeSoundName

const LEGACY_CUES: Record<string, CuelumeSoundName> = {
  navigate: "tick",
  open: "press",
  back: "release",
  clear: "droplet",
  "tool-switch": "tick",
}

class SoundManager {
  private initialized = false
  private _muted = false
  private _volume = DEFAULT_VOLUME

  get muted(): boolean {
    return this._muted
  }

  get volume(): number {
    return this._volume
  }

  init() {
    if (this.initialized) return
    this.initialized = true

    try {
      this._muted = localStorage.getItem(STORAGE_KEY) === "true"
    } catch {
      this._muted = false
    }

    bind()
    setVolume(this._volume)
    setEnabled(!this._muted)
  }

  play(name: SoundName, options?: { volume?: number }) {
    this.init()
    if (this._muted) return

    const cue: CuelumeSoundName =
      LEGACY_CUES[name] ?? (name as CuelumeSoundName)
    play(cue, options)
  }

  mute() {
    this._muted = true
    try {
      localStorage.setItem(STORAGE_KEY, "true")
    } catch {
      // Storage may be unavailable; the in-memory state still applies.
    }
    setEnabled(false)
  }

  unmute() {
    this._muted = false
    try {
      localStorage.setItem(STORAGE_KEY, "false")
    } catch {
      // Storage may be unavailable; the in-memory state still applies.
    }
    setEnabled(true)
  }

  toggleMute() {
    if (this._muted) {
      this.unmute()
    } else {
      this.mute()
    }
  }

  setVolume(volume: number) {
    this._volume = Math.max(0, Math.min(1, volume))
    setVolume(this._volume)
  }
}

export const sound = new SoundManager()
