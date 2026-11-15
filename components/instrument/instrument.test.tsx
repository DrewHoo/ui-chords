import { act, fireEvent, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { describe, expect, test } from "vitest"
import { Instrument } from "./instrument"

const agent = createAgent()

const playing = () => screen.getByRole("status", { name: "Now playing" }).textContent
const chordKey = (number: number) =>
  screen.getByRole("button", { name: new RegExp(`^Chord ${number},`) })

describe("agent", () => {
  test("an agent can find every control and play a chord", async () => {
    render(<Instrument />)

    const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
    }
    const labels = components.map((entry) => entry.label)
    for (const label of [
      "Chord 1, C major",
      "Chord 2, D minor",
      "Chord 7, B diminished",
      "Joystick",
      "Volume",
      "Octave up",
      "Octave down",
      "Tonality",
      "Sound",
      "Rhythm",
    ]) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label)
    }

    const result = await agent.act({
      steps: [
        { ref: "Tonality", action: "press" },
        { ref: "Key", action: "setValue", args: ["D"] },
        { ref: "Joystick", action: "setValue", args: ["Up"] },
        { ref: "Volume", action: "setValue", args: [40] },
        { ref: "Chord 1", action: "press" },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
    expect(playing()).toBe("D minor")
    expect(chordKey(4)).toHaveProperty("ariaLabel", "Chord 4, G major")
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveProperty("value", "40")
  })

  test("the settings an agent can change", async () => {
    render(<Instrument />)
    const result = await agent.act({
      steps: [
        { ref: "Tonality", action: "press" },
        { ref: "Scale", action: "setValue", args: ["Minor"] },
        { ref: "Modifier set", action: "setValue", args: ["Extended"] },
        { ref: "Voice leading", action: "toggle" },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
    expect(chordKey(3)).toHaveProperty("ariaLabel", "Chord 3, E♭ major")
    expect(screen.getByRole("switch", { name: "Voice leading" })).toHaveProperty("ariaChecked", "false")

    const sound = await agent.act({
      steps: [
        { ref: "Sound", action: "press" },
        { ref: "Instrument", action: "setValue", args: ["Strings"] },
        { ref: "Reverb", action: "setValue", args: ["Hall"] },
        { ref: "Chord style", action: "setValue", args: ["Arpeggiate"] },
        { ref: "Arpeggio", action: "setValue", args: ["Up & down"] },
        { ref: "Rhythm", action: "press" },
        { ref: "Tempo", action: "setValue", args: [96] },
      ],
    })
    expect(sound.ok, sound.error?.message).toBe(true)
    expect(document.body.textContent).toContain("96 BPM")
    expect(document.body.textContent).toContain("ARP")
  })
})

describe("playing", () => {
  test("number keys hold a chord, and arrows or WASD color it", () => {
    render(<Instrument />)
    expect(playing()).toBe("")

    fireEvent.keyDown(window, { key: "3", code: "Digit3" })
    expect(playing()).toBe("E minor")
    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" })
    expect(playing()).toBe("E minor seventh")
    expect(chordKey(3)).toHaveProperty("ariaLabel", "Chord 3, E minor seventh")
    expect(chordKey(3).textContent).toContain("Em7")
    expect(chordKey(5).textContent).toContain("G")
    fireEvent.keyDown(window, { key: "w", code: "KeyW" })
    expect(playing()).toBe("E dominant seventh")
    fireEvent.keyUp(window, { key: "ArrowRight", code: "ArrowRight" })
    expect(playing()).toBe("E major")
    fireEvent.keyUp(window, { key: "w", code: "KeyW" })
    expect(playing()).toBe("E minor")
    fireEvent.keyUp(window, { key: "3", code: "Digit3" })
    expect(playing()).toBe("")
  })

  test("the last key held wins, and releasing it returns to the one still held", () => {
    render(<Instrument />)
    fireEvent.keyDown(window, { key: "1", code: "Digit1" })
    fireEvent.keyDown(window, { key: "5", code: "Numpad5" })
    expect(playing()).toBe("G major")
    expect(chordKey(5).hasAttribute("data-active")).toBe(true)
    expect(chordKey(1).hasAttribute("data-active")).toBe(false)
    fireEvent.keyUp(window, { key: "5", code: "Numpad5" })
    expect(playing()).toBe("C major")
    fireEvent.keyUp(window, { key: "1", code: "Digit1" })
    expect(playing()).toBe("")
  })

  test("a chord key plays while pressed with a pointer, Space or Enter", () => {
    render(<Instrument />)
    fireEvent.pointerDown(chordKey(6), { button: 0, pointerId: 7 })
    expect(playing()).toBe("A minor")
    fireEvent.pointerUp(chordKey(6), { button: 0, pointerId: 7 })
    expect(playing()).toBe("")

    fireEvent.keyDown(window, { key: "Tab", code: "Tab" })
    chordKey(2).focus()
    fireEvent.keyDown(chordKey(2), { key: " " })
    expect(playing()).toBe("D minor")
    fireEvent.keyUp(chordKey(2), { key: " " })
    expect(playing()).toBe("")

    fireEvent.keyDown(chordKey(4), { key: "Enter" })
    expect(playing()).toBe("F major")
    fireEvent.blur(chordKey(4))
    expect(playing()).toBe("")
  })

  test("a right click doesn't play", () => {
    render(<Instrument />)
    fireEvent.pointerDown(chordKey(1), { button: 2, pointerId: 1 })
    expect(playing()).toBe("")
  })

  test("the joystick handle steers with the arrows while focused", () => {
    render(<Instrument />)
    const handle = screen.getByRole("button", { name: "Joystick handle" })
    handle.focus()
    fireEvent.keyDown(handle, { key: "ArrowDown" })
    fireEvent.keyDown(window, { key: "1", code: "Digit1" })
    expect(playing()).toBe("C suspended fourth")
    fireEvent.keyUp(handle, { key: "ArrowDown" })
    expect(playing()).toBe("C major")
  })

  test("keys typed inside a settings panel don't play", async () => {
    render(<Instrument />)
    await act(() => agent.act({ steps: [{ ref: "Rhythm", action: "press" }] }))
    const dialog = screen.getByRole("dialog", { name: "Rhythm" })
    fireEvent.keyDown(dialog, { key: "1", code: "Digit1" })
    fireEvent.keyDown(dialog, { key: "ArrowUp", code: "ArrowUp" })
    expect(playing()).toBe("")
  })

  test("window blur lets go of held keys", () => {
    render(<Instrument />)
    fireEvent.keyDown(window, { key: "2", code: "Digit2" })
    expect(playing()).toBe("D minor")
    fireEvent.blur(window)
    expect(playing()).toBe("")
  })

  test("the side buttons move the octave within two each way", () => {
    const { container } = render(<Instrument />)
    const up = screen.getByRole("button", { name: "Octave up" })
    const down = screen.getByRole("button", { name: "Octave down" })
    fireEvent.click(up)
    expect(container.textContent).toContain("OCT +1")
    fireEvent.click(up)
    fireEvent.click(up)
    expect(container.textContent).toContain("OCT +2")
    for (let index = 0; index < 5; index++) fireEvent.click(down)
    expect(container.textContent).toContain("OCT -2")
  })

  test("the volume wheel turns from where it's grabbed, and the screen shows the level", async () => {
    const { container } = render(<Instrument />)
    const volume = screen.getByRole("slider", { name: "Volume" })
    const wheel = volume.closest('[data-slot="slider-control"]')!
    expect(container.textContent).not.toContain("VOL")

    fireEvent.pointerDown(wheel, { button: 0, pointerId: 3, clientX: 500, clientY: 10 })
    expect(volume).toHaveProperty("value", "70")
    fireEvent.pointerMove(document, { pointerId: 3, clientX: 540, clientY: 10 })
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    fireEvent.pointerUp(document, { pointerId: 3, clientX: 540, clientY: 10 })
    expect(volume).toHaveProperty("value", "90")
    expect(container.textContent).toContain("VOL")
  })
})
