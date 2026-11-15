import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Credits } from "./credits"

const trigger = () => screen.getByRole("button", { name: "How to use" })
const isOpen = () => trigger().getAttribute("aria-expanded") === "true"
const press = () => {
  fireEvent.click(trigger())
  act(() => vi.advanceTimersByTime(50))
}

describe("credits and how to use", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }))
  afterEach(() => vi.useRealTimers())

  test("credits link to HiChord and ui-sdk", () => {
    render(<Credits />)
    expect(screen.getByRole("link", { name: "HiChord" }).getAttribute("href")).toBe("https://hichord.shop/")
    expect(screen.getByRole("link", { name: "ui-sdk" }).getAttribute("href")).toBe("https://ui-sdk.dev/")
  })

  test("the guide starts open, shows keycaps, and tucks itself away after ten seconds", () => {
    const { container } = render(<Credits />)
    expect(isOpen()).toBe(true)
    expect([...container.querySelectorAll("kbd")].map((key) => key.textContent)).toContain("Space")
    expect(screen.getByText("Record the selected loop")).toBeTruthy()
    act(() => vi.advanceTimersByTime(9_900))
    expect(isOpen()).toBe(true)
    act(() => vi.advanceTimersByTime(200))
    expect(isOpen()).toBe(false)
  })

  test("How to use toggles it, and reopening starts a new ten seconds", () => {
    render(<Credits />)
    press()
    expect(isOpen()).toBe(false)
    act(() => vi.advanceTimersByTime(30_000))
    expect(isOpen()).toBe(false)
    press()
    expect(isOpen()).toBe(true)
    act(() => vi.advanceTimersByTime(10_000))
    expect(isOpen()).toBe(false)
  })

  test("it stays open while the pointer is over it", () => {
    render(<Credits />)
    const footer = trigger().closest('[data-slot="collapsible"]')!
    fireEvent.pointerEnter(footer)
    act(() => vi.advanceTimersByTime(20_000))
    expect(isOpen()).toBe(true)
    fireEvent.pointerLeave(footer)
    act(() => vi.advanceTimersByTime(10_100))
    expect(isOpen()).toBe(false)
  })
})
