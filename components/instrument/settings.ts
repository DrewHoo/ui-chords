import type { KitId } from "@/lib/drums"
import type { LoopBars } from "@/lib/loop"
import type { Division } from "@/lib/looper"
import type { EnvelopeId, InstrumentId, SynthSettings } from "@/lib/synth"
import type { ModifierSet, ScaleId } from "@/lib/theory"

type Part = "chords" | "melody" | "drums"

type Settings = SynthSettings & {
  part: Part
  key: number
  scale: ScaleId
  modifierSet: ModifierSet
  voiceLeading: boolean
  bass: "off" | "root"
  octave: number
  leadInstrument: InstrumentId
  leadEnvelope: EnvelopeId
  kit: KitId
  bars: LoopBars
  metronome: boolean
  snap: Division
}

type UpdateSettings = (patch: Partial<Settings>) => void

const PARTS: { value: Part; label: string }[] = [
  { value: "chords", label: "Chords" },
  { value: "melody", label: "Melody" },
  { value: "drums", label: "Drums" },
]

const DEFAULT_SETTINGS: Settings = {
  part: "chords",
  key: 0,
  scale: "major",
  modifierSet: "standard",
  voiceLeading: true,
  bass: "off",
  octave: 0,
  instrument: "fm-piano",
  envelope: "keys",
  leadInstrument: "square",
  leadEnvelope: "touch",
  kit: "analog",
  volume: 70,
  filter: 75,
  reverb: "room",
  delay: "off",
  chorus: true,
  mode: "play",
  tempo: 110,
  arpPattern: "up",
  strumSpeed: "medium",
  bars: 4,
  metronome: true,
  snap: 8,
}

export { DEFAULT_SETTINGS, PARTS, type Part, type Settings, type UpdateSettings }
