import { createLocalStorage } from "@ui-sdk/core"
import { KITS, type KitId } from "@/lib/drums"
import { LOOP_BARS } from "@/lib/loop"
import { ENVELOPES, INSTRUMENTS, type EnvelopeId, type InstrumentId } from "@/lib/synth"
import { SCALE_IDS } from "@/lib/theory"
import { DEFAULT_SETTINGS, PARTS, type Settings, type UpdateSettings } from "./settings"

const STORAGE_ID = "ui-chords:settings"

type Check<T> = (value: unknown) => value is T

const oneOf =
  <T,>(values: readonly T[]): Check<T> =>
  (value): value is T =>
    values.includes(value as T)
const between =
  (min: number, max: number): Check<number> =>
  (value): value is number =>
    typeof value === "number" && value >= min && value <= max
const whole =
  (min: number, max: number): Check<number> =>
  (value): value is number =>
    Number.isInteger(value) && between(min, max)(value)
const isBoolean: Check<boolean> = (value): value is boolean => typeof value === "boolean"

const instruments = oneOf(Object.keys(INSTRUMENTS) as InstrumentId[])
const envelopes = oneOf(Object.keys(ENVELOPES) as EnvelopeId[])

// What each setting may hold, so a value saved by an older version, or edited by hand, falls back to the default.
const CHECKS: { [Key in keyof Settings]: Check<Settings[Key]> } = {
  part: oneOf(PARTS.map((part) => part.value)),
  key: whole(0, 11),
  scale: oneOf(SCALE_IDS),
  modifierSet: oneOf(["standard", "extended"] as const),
  voiceLeading: isBoolean,
  bass: oneOf(["off", "root"] as const),
  octave: whole(-2, 2),
  instrument: instruments,
  envelope: envelopes,
  leadInstrument: instruments,
  leadEnvelope: envelopes,
  kit: oneOf(Object.keys(KITS) as KitId[]),
  volume: between(0, 100),
  filter: between(0, 100),
  reverb: oneOf(["off", "room", "hall"] as const),
  delay: oneOf(["off", "eighth", "quarter"] as const),
  chorus: isBoolean,
  mode: oneOf(["play", "strum", "arp"] as const),
  tempo: between(40, 240),
  arpPattern: oneOf(["up", "down", "up-down", "random"] as const),
  strumSpeed: oneOf(["slow", "medium", "fast"] as const),
  bars: oneOf(LOOP_BARS),
  metronome: isBoolean,
  snap: oneOf([4, 8, 16] as const),
}

function parseSettings(text: string | null, fallback: Settings): Settings | null {
  if (!text) return null
  let saved: unknown
  try {
    saved = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof saved !== "object" || saved === null) return null
  const settings: Record<string, unknown> = { ...fallback }
  for (const [key, check] of Object.entries(CHECKS)) {
    const value = (saved as Record<string, unknown>)[key]
    if (check(value)) settings[key] = value
  }
  return settings as Settings
}

/**
 * The instrument's settings, kept in localStorage so a reload picks up where you left off.
 * The server renders the defaults, and the saved ones take over right after hydration.
 */
function createSettingsStore(fallback: Settings = DEFAULT_SETTINGS) {
  const storage = createLocalStorage(STORAGE_ID)
  const listeners = new Set<() => void>()
  let current: Settings | null = null
  const getSnapshot = () => (current ??= parseSettings(storage.get(), fallback) ?? fallback)

  const update: UpdateSettings = (patch) => {
    current = { ...getSnapshot(), ...patch }
    storage.set(JSON.stringify(current))
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot,
    getServerSnapshot: () => fallback,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update,
  }
}

export { createSettingsStore, parseSettings, STORAGE_ID }
