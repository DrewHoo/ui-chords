const BEATS_PER_BAR = 4
const COUNT_IN_BEATS = 4
const MAX_TAKES = 4
const LOOP_BARS = [2, 4, 8] as const

type LoopBars = (typeof LOOP_BARS)[number]

type KeyEvent = { degree: number; start: number; end: number; continued?: boolean }

const beatLength = (tempo: number) => 60 / tempo

const loopDuration = (bars: number, tempo: number) => bars * BEATS_PER_BAR * beatLength(tempo)

function loopPosition(time: number, origin: number, duration: number) {
  return (((time - origin) % duration) + duration) % duration
}

function nextBoundary(now: number, origin: number, duration: number, minimumLead: number) {
  const cycles = Math.ceil((now + minimumLead - origin) / duration)
  return origin + Math.max(cycles, 0) * duration
}

function exportRepeats(duration: number, target = 30, max = 8) {
  return Math.min(max, Math.max(2, Math.ceil(target / duration)))
}

function echoAt(events: readonly KeyEvent[], position: number, minimum = 0.12) {
  const degrees = new Set<number>()
  for (const event of events) {
    const end = Math.max(event.end, event.start + minimum)
    if (position >= event.start && position < end) degrees.add(event.degree)
  }
  return degrees
}

function meterAt(position: number, tempo: number, bars: number) {
  const index = Math.floor(position / beatLength(tempo) + 1e-6) % (bars * BEATS_PER_BAR)
  return { bar: Math.floor(index / BEATS_PER_BAR) + 1, beat: (index % BEATS_PER_BAR) + 1 }
}

function beatsUntil(time: number, now: number, tempo: number) {
  return Math.ceil((time - now) / beatLength(tempo) - 1e-6) || 0
}

export {
  BEATS_PER_BAR,
  COUNT_IN_BEATS,
  LOOP_BARS,
  MAX_TAKES,
  beatLength,
  beatsUntil,
  echoAt,
  exportRepeats,
  loopDuration,
  loopPosition,
  meterAt,
  nextBoundary,
  type KeyEvent,
  type LoopBars,
}
