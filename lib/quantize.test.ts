import { describe, expect, test } from "vitest"
import { quantizeTake } from "./quantize"

const RATE = 1000

function impulses(length: number, at: number[]) {
  const data = new Float32Array(length)
  for (const index of at) data[index] = 1
  return data
}

const peaks = (data: Float32Array) =>
  [...data].flatMap((value, index) => (value > 0.5 ? [index] : []))

describe("adjusting a take to the grid", () => {
  test("late and early presses move to the nearest grid line", () => {
    const data = impulses(2000, [270, 980])
    const { channels, events } = quantizeTake(
      [data, data.slice()],
      [
        { degree: 0, start: 0.27, end: 0.6 },
        { degree: 3, start: 0.98, end: 1.4 },
      ],
      RATE,
      0.25
    )
    expect(peaks(channels[0])).toEqual([250, 1000])
    expect(peaks(channels[1])).toEqual([250, 1000])
    expect(events[0].start).toBeCloseTo(0.25)
    expect(events[0].end).toBeCloseTo(0.58)
    expect(events[1].start).toBeCloseTo(1)
  })

  test("a take that's already on the grid comes back unchanged", () => {
    const data = new Float32Array(2000).map((_, index) => Math.sin(index / 7))
    const { channels } = quantizeTake([data], [
      { degree: 0, start: 0.5, end: 0.9 },
      { degree: 1, start: 1.25, end: 1.5 },
    ], RATE, 0.25)
    for (let index = 0; index < data.length; index++) {
      expect(channels[0][index]).toBeCloseTo(data[index], 5)
    }
  })

  test("presses closer together than a flam count as one", () => {
    const data = impulses(2000, [520])
    const { channels, events } = quantizeTake(
      [data],
      [
        { degree: 0, start: 0.52, end: 0.7 },
        { degree: 3, start: 0.535, end: 0.7 },
      ],
      RATE,
      0.25
    )
    expect(peaks(channels[0])).toEqual([500])
    expect(events.map((event) => event.start)).toEqual([0.5, 0.515])
  })

  test("a take without presses is copied as is", () => {
    const data = impulses(100, [10])
    const { channels } = quantizeTake([data], [], RATE, 0.25)
    expect(peaks(channels[0])).toEqual([10])
    expect(channels[0]).not.toBe(data)
  })
})

describe("presses around the loop point", () => {
  test("a press just before the loop starts moves to the downbeat", () => {
    const data = impulses(2000, [1960, 520])
    const { channels, events } = quantizeTake(
      [data],
      [
        { degree: 0, start: 1.96, end: 2 },
        { degree: 0, start: 0, end: 0.3, continued: true },
        { degree: 4, start: 0.52, end: 0.9 },
      ],
      RATE,
      0.25
    )
    expect(peaks(channels[0])).toEqual([0, 500])
    expect(events[0].start).toBe(0)
    expect(events[1]).toEqual({ degree: 0, start: 0, end: 0.3, continued: true })
    expect(events[2].start).toBeCloseTo(0.5)
  })

  test("a note held over the loop point isn't a new press", () => {
    const data = impulses(2000, [1010])
    const { channels } = quantizeTake(
      [data],
      [
        { degree: 2, start: 0, end: 0.4, continued: true },
        { degree: 3, start: 1.01, end: 1.5 },
      ],
      RATE,
      0.25
    )
    expect(peaks(channels[0])).toEqual([1000])
  })
})
