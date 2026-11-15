type Direction =
  | "center"
  | "up"
  | "up-right"
  | "right"
  | "down-right"
  | "down"
  | "down-left"
  | "left"
  | "up-left"

type ScaleId =
  | "major"
  | "minor"
  | "harmonic-minor"
  | "melodic-minor"
  | "dorian"
  | "mixolydian"
  | "lydian"

type ModifierSet = "standard" | "extended"

type Quality = "maj" | "min" | "dim" | "aug"

type ChordTypeId =
  | Quality
  | "sus4"
  | "sus2"
  | "6"
  | "dom7"
  | "maj7"
  | "min7"
  | "m7b5"
  | "maj7s5"
  | "maj9"
  | "min9"
  | "dom9"
  | "7s9"
  | "7sus4"
  | "add9"
  | "madd9"
  | "add11"
  | "madd11"
  | "min11"

type ChordType = { intervals: number[]; symbol: string; name: string }

type Chord = {
  degree: number
  root: number
  type: ChordTypeId
  symbol: string
  name: string
  roman: string
  notes: string[]
}

const DIRECTIONS: Direction[] = [
  "center",
  "up",
  "up-right",
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
]

const DIRECTION_LABELS: Record<Direction, string> = {
  center: "Center",
  up: "Up",
  "up-right": "Up right",
  right: "Right",
  "down-right": "Down right",
  down: "Down",
  "down-left": "Down left",
  left: "Left",
  "up-left": "Up left",
}

const MODIFIER_HINTS: Record<ModifierSet, Record<Direction, string>> = {
  standard: {
    center: "",
    up: "maj ⇄ min",
    "up-right": "dom 7",
    right: "7th",
    "down-right": "9th",
    down: "sus4",
    "down-left": "6 / sus2",
    left: "dim",
    "up-left": "aug",
  },
  extended: {
    center: "",
    up: "maj ⇄ min",
    "up-right": "dom 9",
    right: "add11",
    "down-right": "m11",
    down: "7♯9",
    "down-left": "add9",
    left: "7sus4",
    "up-left": "m7♭5",
  },
}

const SCALES: Record<
  ScaleId,
  { label: string; short: string; steps: number[]; parentMajor: number }
> = {
  major: { label: "Major", short: "MAJ", steps: [0, 2, 4, 5, 7, 9, 11], parentMajor: 0 },
  minor: { label: "Minor", short: "MIN", steps: [0, 2, 3, 5, 7, 8, 10], parentMajor: 3 },
  "harmonic-minor": {
    label: "Harmonic minor",
    short: "HMIN",
    steps: [0, 2, 3, 5, 7, 8, 11],
    parentMajor: 3,
  },
  "melodic-minor": {
    label: "Melodic minor",
    short: "MMIN",
    steps: [0, 2, 3, 5, 7, 9, 11],
    parentMajor: 3,
  },
  dorian: { label: "Dorian", short: "DOR", steps: [0, 2, 3, 5, 7, 9, 10], parentMajor: 10 },
  mixolydian: {
    label: "Mixolydian",
    short: "MIX",
    steps: [0, 2, 4, 5, 7, 9, 10],
    parentMajor: 5,
  },
  lydian: { label: "Lydian", short: "LYD", steps: [0, 2, 4, 6, 7, 9, 11], parentMajor: 7 },
}

const SCALE_IDS = Object.keys(SCALES) as ScaleId[]

const CHORD_TYPES: Record<ChordTypeId, ChordType> = {
  maj: { intervals: [0, 4, 7], symbol: "", name: "major" },
  min: { intervals: [0, 3, 7], symbol: "m", name: "minor" },
  dim: { intervals: [0, 3, 6], symbol: "dim", name: "diminished" },
  aug: { intervals: [0, 4, 8], symbol: "aug", name: "augmented" },
  sus4: { intervals: [0, 5, 7], symbol: "sus4", name: "suspended fourth" },
  sus2: { intervals: [0, 2, 7], symbol: "sus2", name: "suspended second" },
  "6": { intervals: [0, 4, 7, 9], symbol: "6", name: "sixth" },
  dom7: { intervals: [0, 4, 7, 10], symbol: "7", name: "dominant seventh" },
  maj7: { intervals: [0, 4, 7, 11], symbol: "maj7", name: "major seventh" },
  min7: { intervals: [0, 3, 7, 10], symbol: "m7", name: "minor seventh" },
  m7b5: { intervals: [0, 3, 6, 10], symbol: "m7♭5", name: "half-diminished" },
  maj7s5: { intervals: [0, 4, 8, 11], symbol: "maj7♯5", name: "augmented major seventh" },
  maj9: { intervals: [0, 4, 7, 11, 14], symbol: "maj9", name: "major ninth" },
  min9: { intervals: [0, 3, 7, 10, 14], symbol: "m9", name: "minor ninth" },
  dom9: { intervals: [0, 4, 7, 10, 14], symbol: "9", name: "dominant ninth" },
  "7s9": { intervals: [0, 4, 7, 10, 15], symbol: "7♯9", name: "dominant sharp nine" },
  "7sus4": { intervals: [0, 5, 7, 10], symbol: "7sus4", name: "seventh suspended fourth" },
  add9: { intervals: [0, 4, 7, 14], symbol: "add9", name: "added ninth" },
  madd9: { intervals: [0, 3, 7, 14], symbol: "m(add9)", name: "minor added ninth" },
  add11: { intervals: [0, 4, 7, 17], symbol: "add11", name: "added eleventh" },
  madd11: { intervals: [0, 3, 7, 17], symbol: "m(add11)", name: "minor added eleventh" },
  min11: { intervals: [0, 3, 7, 10, 14, 17], symbol: "m11", name: "minor eleventh" },
}

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"]
const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
const FLAT_MAJORS = new Set([1, 3, 5, 8, 10])
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]

const mod12 = (n: number) => ((n % 12) + 12) % 12

function noteNames(key: number, scale: ScaleId) {
  return FLAT_MAJORS.has(mod12(key + SCALES[scale].parentMajor)) ? FLAT_NAMES : SHARP_NAMES
}

function triadQuality(scale: ScaleId, degree: number): Quality {
  const steps = SCALES[scale].steps
  const at = (index: number) => steps[index % 7] + 12 * Math.floor(index / 7)
  const third = at(degree + 2) - at(degree)
  const fifth = at(degree + 4) - at(degree)
  if (third === 4) return fifth === 8 ? "aug" : "maj"
  return fifth === 6 ? "dim" : "min"
}

function romanNumeral(degree: number, quality: Quality) {
  const numeral = ROMAN[degree]
  if (quality === "maj") return numeral
  if (quality === "aug") return `${numeral}+`
  if (quality === "min") return numeral.toLowerCase()
  return `${numeral.toLowerCase()}°`
}

function modify(base: Quality, direction: Direction, set: ModifierSet): ChordTypeId {
  const major = base === "maj" || base === "aug"
  if (direction === "center") return base
  if (direction === "up") return major ? "min" : "maj"
  if (set === "extended") {
    const extended: Record<Exclude<Direction, "center" | "up">, ChordTypeId> = {
      "up-right": "dom9",
      right: major ? "add11" : "madd11",
      "down-right": "min11",
      down: "7s9",
      "down-left": major ? "add9" : "madd9",
      left: "7sus4",
      "up-left": "m7b5",
    }
    return extended[direction]
  }
  const sevenths: Record<Quality, ChordTypeId> = {
    maj: "maj7",
    min: "min7",
    dim: "m7b5",
    aug: "maj7s5",
  }
  const ninths: Record<Quality, ChordTypeId> = {
    maj: "maj9",
    min: "min9",
    dim: "m7b5",
    aug: "maj7s5",
  }
  const standard: Record<Exclude<Direction, "center" | "up">, ChordTypeId> = {
    "up-right": "dom7",
    right: sevenths[base],
    "down-right": ninths[base],
    down: "sus4",
    "down-left": major ? "6" : "sus2",
    left: base === "dim" ? "min" : "dim",
    "up-left": "aug",
  }
  return standard[direction]
}

function chordAt(
  key: number,
  scale: ScaleId,
  degree: number,
  direction: Direction = "center",
  set: ModifierSet = "standard"
): Chord {
  const names = noteNames(key, scale)
  const root = mod12(key + SCALES[scale].steps[degree])
  const quality = triadQuality(scale, degree)
  const type = modify(quality, direction, set)
  const { intervals, symbol, name } = CHORD_TYPES[type]
  return {
    degree,
    root,
    type,
    symbol: `${names[root]}${symbol}`,
    name: `${names[root]} ${name}`,
    roman: romanNumeral(degree, quality),
    notes: intervals.map((interval) => names[mod12(root + interval)]),
  }
}

const DEGREE_NAMES = ["root", "2nd", "3rd", "4th", "5th", "6th", "7th"]

const MELODY_SHIFTS: Record<Direction, number> = {
  center: 0,
  up: 12,
  "up-right": 13,
  right: 1,
  "down-right": -11,
  down: -12,
  "down-left": -13,
  left: -1,
  "up-left": 11,
}

const MELODY_HINTS: Record<Direction, string> = {
  center: "",
  up: "octave up",
  "up-right": "octave up, sharp",
  right: "sharp",
  "down-right": "octave down, sharp",
  down: "octave down",
  "down-left": "octave down, flat",
  left: "flat",
  "up-left": "octave up, flat",
}

type MelodyNote = { midi: number; name: string; pitch: string; degreeName: string }

function melodyNote(
  key: number,
  scale: ScaleId,
  degree: number,
  direction: Direction = "center",
  octave = 0
): MelodyNote {
  const names = noteNames(key, scale)
  const base = 72 + mod12(key) - (mod12(key) > 6 ? 12 : 0)
  const midi = base + SCALES[scale].steps[degree] + MELODY_SHIFTS[direction] + octave * 12
  const name = names[mod12(midi)]
  return { midi, name, pitch: `${name}${Math.floor(midi / 12) - 1}`, degreeName: DEGREE_NAMES[degree] }
}

function keyLabel(key: number) {
  return KEY_NAMES[mod12(key)]
}

function spread(candidate: number[], previous: number[]) {
  const nearest = (note: number, set: number[]) =>
    Math.min(...set.map((other) => Math.abs(other - note)))
  return (
    candidate.reduce((sum, note) => sum + nearest(note, previous), 0) +
    previous.reduce((sum, note) => sum + nearest(note, candidate), 0)
  )
}

const average = (notes: number[]) => notes.reduce((sum, note) => sum + note, 0) / notes.length

type VoicingOptions = {
  octave?: number
  voiceLeading?: boolean
  bass?: "off" | "root"
  previous?: number[] | null
}

function voice(chord: Pick<Chord, "root" | "type">, options: VoicingOptions = {}) {
  const { octave = 0, voiceLeading = true, bass = "off", previous = null } = options
  const intervals = CHORD_TYPES[chord.type].intervals
  const rootMidi = 60 + chord.root - (chord.root > 6 ? 12 : 0) + octave * 12
  const rootPosition = intervals.map((interval) => rootMidi + interval)
  let notes = rootPosition

  if (voiceLeading && previous && previous.length > 0) {
    const center = 64 + octave * 12
    let best = Infinity
    for (let inversion = 0; inversion < rootPosition.length; inversion++) {
      const inverted = rootPosition
        .map((note, index) => (index < inversion ? note + 12 : note))
        .sort((a, b) => a - b)
      for (const shift of [-12, 0, 12]) {
        const candidate = inverted.map((note) => note + shift)
        const cost = spread(candidate, previous) + 0.75 * Math.abs(average(candidate) - center)
        if (cost < best) {
          best = cost
          notes = candidate
        }
      }
    }
  }

  const bassNotes = bass === "root" ? [36 + chord.root + octave * 12] : []
  return { notes: [...bassNotes, ...notes], chordNotes: notes }
}

export {
  CHORD_TYPES,
  DIRECTION_LABELS,
  DIRECTIONS,
  MELODY_HINTS,
  MODIFIER_HINTS,
  SCALE_IDS,
  SCALES,
  chordAt,
  keyLabel,
  melodyNote,
  modify,
  triadQuality,
  voice,
  type Chord,
  type ChordTypeId,
  type Direction,
  type MelodyNote,
  type ModifierSet,
  type Quality,
  type ScaleId,
}
