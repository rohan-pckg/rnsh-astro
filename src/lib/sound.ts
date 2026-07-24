import { play, setEnabled, type SoundName } from "cuelume"

const STORAGE_KEY = "ui-sounds"
const DEFAULT_ENABLED = true
const MIN_PLAY_INTERVAL_MS = 320
const REDUCED_MOTION_INTERVAL_MS = 480

export type SoundCategory =
  | "navigation"
  | "copy"
  | "theme"
  | "drawer"
  | "hover"
  | "success"
  | "error"

export type SoundVariant = "open" | "close"

type SoundOptions = {
  variant?: SoundVariant
}

const SOUND_RECIPES = {
  navigation: "press",
  copy: "tick",
  theme: "toggle",
  drawer: "bloom",
  hover: "whisper",
  success: "success",
  error: "error",
} satisfies Record<SoundCategory, SoundName>

const DRAWER_RECIPES = {
  open: "bloom",
  close: "droplet",
} satisfies Record<SoundVariant, SoundName>

let initialized = false
let enabled = DEFAULT_ENABLED
let lastPlayedAt = 0

function isBrowser() {
  return typeof window !== "undefined"
}

function prefersReducedMotion() {
  return (
    isBrowser() &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
}

function readPreference() {
  if (!isBrowser()) return DEFAULT_ENABLED
  return window.localStorage.getItem(STORAGE_KEY) !== "off"
}

function initialize() {
  if (initialized) return

  enabled = readPreference()
  setEnabled(enabled)
  initialized = true
}

export function getUiSoundsEnabled() {
  initialize()
  return enabled
}

export function setUiSoundsEnabled(value: boolean) {
  initialize()
  enabled = value
  setEnabled(value)

  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off")
  }

  return enabled
}

export function toggleUiSounds() {
  return setUiSoundsEnabled(!getUiSoundsEnabled())
}

export function isSoundCategory(value: string): value is SoundCategory {
  return value in SOUND_RECIPES
}

function isSoundVariant(value: unknown): value is SoundVariant {
  return typeof value === "string" && value in DRAWER_RECIPES
}

export function playSound(category: SoundCategory, options: SoundOptions = {}) {
  if (!isBrowser()) return

  initialize()
  if (!enabled) return

  const now = window.performance.now()
  const minimumInterval = prefersReducedMotion()
    ? REDUCED_MOTION_INTERVAL_MS
    : MIN_PLAY_INTERVAL_MS

  if (now - lastPlayedAt < minimumInterval) return

  lastPlayedAt = now
  play(resolveRecipe(category, options))
}

function resolveRecipe(category: SoundCategory, options: SoundOptions) {
  if (category === "drawer" && isSoundVariant(options.variant)) {
    return DRAWER_RECIPES[options.variant]
  }

  return SOUND_RECIPES[category]
}
