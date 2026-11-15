import type { KeyEvent } from "./loop"

type Quantized = { channels: Float32Array[]; events: KeyEvent[] }

const MERGE_SECONDS = 0.025
const FADE_SECONDS = 0.004

const wrap = (index: number, length: number) => ((index % length) + length) % length

// Moves the audio after each key press so the press lands on the nearest grid line,
// crossfading where slices meet; a slice that would run into the next press fades out instead.
function quantizeTake(
  channels: Float32Array[],
  events: readonly KeyEvent[],
  sampleRate: number,
  grid: number
): Quantized {
  const length = channels[0]?.length ?? 0
  const duration = length / sampleRate
  const starts = events
    .filter((event) => !event.continued)
    .map((event) => event.start)
    .sort((a, b) => a - b)
  const onsets: number[] = []
  for (const start of starts) {
    if (onsets.length === 0 || start - onsets[onsets.length - 1] > MERGE_SECONDS) onsets.push(start)
  }
  if (length === 0 || onsets.length === 0) {
    return { channels: channels.map((data) => data.slice()), events: events.map((event) => ({ ...event })) }
  }

  const fade = Math.max(1, Math.round(FADE_SECONDS * sampleRate))
  const source = onsets.map((onset) => Math.round(onset * sampleRate))
  const target = onsets.map((onset) => Math.round(Math.round(onset / grid) * grid * sampleRate))
  const out = channels.map(() => new Float32Array(length))

  for (let index = 0; index < source.length; index++) {
    const next = (index + 1) % source.length
    const sourceSpan = wrap(source[next] - source[index], length) || length
    const targetSpan = wrap(target[next] - target[index], length) || (source.length === 1 ? length : 0)
    if (targetSpan === 0) continue
    const span = Math.min(targetSpan, sourceSpan)
    const total = span + fade
    for (let offset = 0; offset < total; offset++) {
      const gain = Math.min(1, offset / fade, (total - offset) / fade)
      const from = wrap(source[index] - fade + offset, length)
      const to = wrap(target[index] - fade + offset, length)
      for (let channel = 0; channel < channels.length; channel++) {
        out[channel][to] += channels[channel][from] * gain
      }
    }
  }

  const shiftFor = (start: number) => {
    let nearest = 0
    for (let index = 0; index < onsets.length; index++) {
      if (onsets[index] <= start + 1e-9) nearest = index
    }
    return (target[nearest] - source[nearest]) / sampleRate
  }
  const moved = events.map((event) => {
    if (event.continued) return { ...event }
    const shift = shiftFor(event.start)
    let start = event.start + shift
    let end = event.end + shift
    if (start >= duration - 1e-9) {
      start -= duration
      end -= duration
    }
    start = Math.min(Math.max(0, start), duration)
    return { ...event, start, end: Math.min(Math.max(start, end), duration) }
  })
  return { channels: out, events: moved }
}

export { quantizeTake }
