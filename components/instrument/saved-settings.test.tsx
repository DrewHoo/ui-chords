import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { describe, expect, test } from "vitest"
import { Instrument } from "./instrument"
import { parseSettings, STORAGE_ID } from "./saved-settings"
import { DEFAULT_SETTINGS } from "./settings"

const agent = createAgent()

const chordOne = () => screen.getByRole("button", { name: /^Chord 1,/ })

describe("saved settings", () => {
  test("what you change comes back after a reload", async () => {
    const first = render(<Instrument />)
    const result = await agent.act({
      steps: [
        { ref: "Tonality", action: "press" },
        { ref: "Key", action: "setValue", args: ["D"] },
        { ref: "Sound", action: "press" },
        { ref: "Instrument", action: "setValue", args: ["Strings"] },
        { ref: "Rhythm", action: "press" },
        { ref: "Tempo", action: "setValue", args: [96] },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
    first.unmount()

    render(<Instrument />)
    expect(chordOne()).toHaveProperty("ariaLabel", "Chord 1, D major")
    expect(document.body.textContent).toContain("96 BPM")
    expect(JSON.parse(localStorage.getItem(STORAGE_ID)!)).toMatchObject({ key: 2, instrument: "strings", tempo: 96 })
  })

  test("a saved value that no longer fits falls back to its default", () => {
    const saved = JSON.stringify({ key: 3, chorus: false, tempo: 400, instrument: "kazoo", octave: 1.5, gone: true })
    expect(parseSettings(saved, DEFAULT_SETTINGS)).toEqual({ ...DEFAULT_SETTINGS, key: 3, chorus: false })
    expect(parseSettings("{oops", DEFAULT_SETTINGS)).toBeNull()
    expect(parseSettings("null", DEFAULT_SETTINGS)).toBeNull()
    expect(parseSettings(null, DEFAULT_SETTINGS)).toBeNull()
  })

  test("a broken save still opens with the defaults", () => {
    localStorage.setItem(STORAGE_ID, "{oops")
    render(<Instrument />)
    expect(chordOne()).toHaveProperty("ariaLabel", "Chord 1, C major")
  })
})
