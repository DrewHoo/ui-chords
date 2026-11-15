import { fireEvent, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { describe, expect, test } from "vitest"
import { Instrument } from "./instrument"

const agent = createAgent()

const playing = () => screen.getByRole("status", { name: "Now playing" }).textContent
const chordKey = (number: number) =>
  screen.getByRole("button", { name: new RegExp(`^Chord ${number},`) })

describe("parts and the transport", () => {
  test("Z, X and C switch between chords, melody and drums", () => {
    render(<Instrument />)
    fireEvent.keyDown(window, { key: "x", code: "KeyX" })
    expect(document.body.textContent).toContain("MELODY")
    expect(screen.getByRole("button", { name: "Note 3, E" })).toBeTruthy()

    fireEvent.keyDown(window, { key: "3", code: "Digit3" })
    expect(playing()).toBe("E5")
    fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" })
    expect(playing()).toBe("E6")
    fireEvent.keyUp(window, { key: "ArrowUp", code: "ArrowUp" })
    fireEvent.keyUp(window, { key: "3", code: "Digit3" })
    expect(playing()).toBe("")

    fireEvent.keyDown(window, { key: "c", code: "KeyC" })
    expect(screen.getByRole("button", { name: "Pad 1, Kick" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pad 4, Hi-hat" })).toBeTruthy()
    fireEvent.keyDown(window, { key: "1", code: "Digit1" })
    expect(screen.getByRole("button", { name: "Pad 1, Kick" }).hasAttribute("data-active")).toBe(true)
    fireEvent.keyUp(window, { key: "1", code: "Digit1" })

    fireEvent.keyDown(window, { key: "z", code: "KeyZ" })
    expect(chordKey(1)).toHaveProperty("ariaLabel", "Chord 1, C major")
  })

  test("drum pads can be held together", () => {
    render(<Instrument />)
    fireEvent.keyDown(window, { key: "c", code: "KeyC" })
    fireEvent.keyDown(window, { key: "1", code: "Digit1" })
    fireEvent.keyDown(window, { key: "4", code: "Digit4" })
    expect(screen.getByRole("button", { name: "Pad 1, Kick" }).hasAttribute("data-active")).toBe(true)
    expect(screen.getByRole("button", { name: "Pad 4, Hi-hat" }).hasAttribute("data-active")).toBe(true)
  })

  test("an agent can switch parts and the sound panel follows", async () => {
    render(<Instrument />)
    const result = await agent.act({
      steps: [
        { ref: "Sound", action: "press" },
        { ref: "Mode", action: "setValue", args: ["Drums"] },
        { ref: "Kit", action: "setValue", args: ["Tight"] },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
    expect(document.body.textContent).toContain("TIGHT KIT")
    expect(screen.queryByRole("combobox", { name: "Instrument" })).toBeNull()
    expect(screen.queryByRole("radiogroup", { name: "Chord style" })).toBeNull()
  })

  test("arpeggio and strum options only show for the chord style that uses them", async () => {
    render(<Instrument />)
    await agent.act({ steps: [{ ref: "Sound", action: "press" }] })
    expect(screen.queryByRole("radiogroup", { name: "Arpeggio" })).toBeNull()
    expect(screen.queryByRole("radiogroup", { name: "Strum speed" })).toBeNull()
    await agent.act({ steps: [{ ref: "Chord style", action: "setValue", args: ["Strum"] }] })
    expect(screen.getByRole("radiogroup", { name: "Strum speed" })).toBeTruthy()
    expect(screen.queryByRole("radiogroup", { name: "Arpeggio" })).toBeNull()
  })

  test("with nothing recorded, the transport only offers recording", async () => {
    render(<Instrument />)
    for (const name of ["Play loop", "Delete track"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-disabled"), name).toBe("true")
    }
    const recordButton = screen.getByRole("button", { name: "Record" })
    expect(recordButton.hasAttribute("aria-disabled")).toBe(false)
    expect(recordButton.getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy()

    await agent.act({ steps: [{ ref: "Rhythm", action: "press" }] })
    for (const name of ["Track 1", "Track 2", "Track 3", "Track 4"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-disabled"), name).toBe("true")
    }
    expect(screen.getByText("Press record to lay down your first take.")).toBeTruthy()
  })

  test("the export menu offers audio only once there's a take", async () => {
    render(<Instrument />)
    const result = await agent.act({ steps: [{ ref: "Export", action: "press" }] })
    expect(result.ok, result.error?.message).toBe(true)
    const audio = await screen.findByRole("menuitem", { name: "Download MP3" })
    expect(audio.getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByRole("menuitem", { name: "Record video" })).toBeTruthy()
  })

  test("the tempo and loop length stay editable before the first take", async () => {
    render(<Instrument />)
    await agent.act({ steps: [{ ref: "Rhythm", action: "press" }] })
    expect(screen.getByRole("slider", { name: "Tempo" }).hasAttribute("disabled")).toBe(false)
    expect(screen.queryByText(/Locked while the loop has takes/)).toBeNull()
    const result = await agent.act({ steps: [{ ref: "Loop length", action: "setValue", args: ["8 bars"] }] })
    expect(result.ok, result.error?.message).toBe(true)
    expect(screen.getByRole("radio", { name: "8 bars" })).toHaveProperty("ariaChecked", "true")
  })

  test("Adjust timing snaps takes to the grid and says so on the screen", async () => {
    const { container } = render(<Instrument />)
    const adjust = screen.getByRole("button", { name: "Adjust timing" })
    expect(adjust.getAttribute("aria-pressed")).toBe("false")
    const result = await agent.act({ steps: [{ ref: "Adjust timing", action: "toggle" }] })
    expect(result.ok, result.error?.message).toBe(true)
    expect(adjust.getAttribute("aria-pressed")).toBe("true")
    expect(container.textContent).toContain("ADJUST ON · 1/8")
    fireEvent.click(adjust)
    expect(adjust.getAttribute("aria-pressed")).toBe("false")
    expect(container.textContent).toContain("ADJUST OFF")
  })
})
