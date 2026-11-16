import { describe, expect, test } from "vitest"
import { fitSize } from "./screen-recording"

describe("video size", () => {
  test("a retina tab shrinks to fit 1080p, keeping its shape", () => {
    expect(fitSize(2880, 1800)).toEqual({ width: 1728, height: 1080 })
    expect(fitSize(3840, 1200)).toEqual({ width: 1920, height: 600 })
  })

  test("a small tab keeps its size, rounded down to even sides", () => {
    expect(fitSize(1280, 859)).toEqual({ width: 1280, height: 858 })
    expect(fitSize(800, 508)).toEqual({ width: 800, height: 508 })
  })
})
