import { describe, expect, test } from "vitest"
import { beatsUntil, echoAt, exportRepeats, loopDuration, loopPosition, meterAt, nextBoundary } from "./loop"

describe("loop timeline", () => {
  test("a loop is bars of four beats at the tempo", () => {
    expect(loopDuration(4, 120)).toBe(8)
    expect(loopDuration(2, 60)).toBe(8)
  })

  test("position wraps around the loop, before and after its origin", () => {
    expect(loopPosition(10, 2, 4)).toBe(0)
    expect(loopPosition(11.5, 2, 4)).toBe(1.5)
    expect(loopPosition(1, 2, 4)).toBe(3)
  })

  test("a take starts at the next loop start at least a lead away", () => {
    expect(nextBoundary(5, 2, 4, 0.5)).toBe(6)
    expect(nextBoundary(5.8, 2, 4, 0.5)).toBe(10)
    expect(nextBoundary(1, 2, 4, 0.5)).toBe(2)
  })

  test("beats left before a time, for the count-in", () => {
    expect(beatsUntil(10, 8, 120)).toBe(4)
    expect(beatsUntil(10, 8.6, 120)).toBe(3)
    expect(beatsUntil(10, 9.9, 120)).toBe(1)
    expect(beatsUntil(10, 10, 120)).toBe(0)
  })

  test("an export repeats the loop to about thirty seconds", () => {
    expect(exportRepeats(8)).toBe(4)
    expect(exportRepeats(20)).toBe(2)
    expect(exportRepeats(2)).toBe(8)
  })

  test("keys that were held at a position, with a minimum flash for taps", () => {
    const events = [
      { degree: 0, start: 0, end: 1 },
      { degree: 4, start: 0.5, end: 0.5 },
      { degree: 2, start: 2, end: 3 },
    ]
    expect([...echoAt(events, 0.55)].sort()).toEqual([0, 4])
    expect([...echoAt(events, 0.7)]).toEqual([0])
    expect([...echoAt(events, 2.5)]).toEqual([2])
    expect([...echoAt(events, 3)]).toEqual([])
  })
})

describe("the screen's metronome", () => {
  test("bar and beat from the loop position", () => {
    expect(meterAt(0, 120, 4)).toEqual({ bar: 1, beat: 1 })
    expect(meterAt(0.5, 120, 4)).toEqual({ bar: 1, beat: 2 })
    expect(meterAt(2.1, 120, 4)).toEqual({ bar: 2, beat: 1 })
    expect(meterAt(7.9, 120, 4)).toEqual({ bar: 4, beat: 4 })
    expect(meterAt(8, 120, 4)).toEqual({ bar: 1, beat: 1 })
  })
})
