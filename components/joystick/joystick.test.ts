import { checkServer, mount } from "@ui-sdk/core/testing"
import { describe, expect, test } from "vitest"
import { directionAt, directionFromArrows, joystick } from "./joystick"

const markup = `<root aria-label="Joystick"><thumb aria-label="Joystick handle"></thumb></root>`

const key = (el: HTMLElement, type: "keydown" | "keyup", name: string) =>
  el.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true }))

describe("directions", () => {
  test("a dead zone in the middle, then eight sectors", () => {
    expect(directionAt(0.1, -0.2)).toBe("center")
    expect(directionAt(0, -1)).toBe("up")
    expect(directionAt(0.7, -0.7)).toBe("up-right")
    expect(directionAt(1, 0.1)).toBe("right")
    expect(directionAt(-0.6, 0.7)).toBe("down-left")
    expect(directionAt(-1, 0)).toBe("left")
  })

  test("arrow keys add up, and opposites cancel", () => {
    expect(directionFromArrows(["ArrowUp", "ArrowLeft"])).toBe("up-left")
    expect(directionFromArrows(["ArrowDown", "ArrowRight"])).toBe("down-right")
    expect(directionFromArrows(["ArrowLeft", "ArrowRight"])).toBe("center")
    expect(directionFromArrows([])).toBe("center")
  })
})

describe("joystick", () => {
  test("held arrows push the stick, and letting go recenters it", async () => {
    const view = mount(joystick, {}, markup)
    try {
      await view.keys("Tab")
      const thumb = view.part("thumb")!
      expect(document.activeElement).toBe(thumb)

      key(thumb, "keydown", "ArrowUp")
      expect(view.state.value).toBe("up")
      key(thumb, "keydown", "ArrowRight")
      expect(view.state.value).toBe("up-right")
      expect(view.root.getAttribute("data-direction")).toBe("up-right")
      expect(view.changes.at(-1)).toMatchObject({ key: "value", reason: "step-key" })

      key(thumb, "keyup", "ArrowUp")
      expect(view.state.value).toBe("right")
      key(thumb, "keyup", "ArrowRight")
      expect(view.state.value).toBe("center")
      expect(view.changes.at(-1)).toMatchObject({ reason: "release" })
    } finally {
      view.unmount()
    }
  })

  test("arrow keys don't scroll the page, other keys pass through", () => {
    const view = mount(joystick, {}, markup)
    try {
      const thumb = view.part("thumb")!
      const arrow = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
      thumb.dispatchEvent(arrow)
      expect(arrow.defaultPrevented).toBe(true)
      const letter = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true })
      thumb.dispatchEvent(letter)
      expect(letter.defaultPrevented).toBe(false)
      expect(view.state.value).toBe("down")
    } finally {
      view.unmount()
    }
  })

  test("losing focus while pushed recenters", async () => {
    const view = mount(joystick, {}, markup)
    try {
      await view.keys("Tab")
      key(view.part("thumb")!, "keydown", "ArrowLeft")
      expect(view.state.value).toBe("left")
      view.part("thumb")!.blur()
      expect(view.state.value).toBe("center")
    } finally {
      view.unmount()
    }
  })

  test("pressing the handle recenters, and setValue latches a direction", async () => {
    const view = mount(joystick, { defaultValue: "down" }, markup)
    try {
      expect(view.state.value).toBe("down")
      await view.keys("Tab", "Enter")
      expect(view.state.value).toBe("center")
      expect(view.changes.at(-1)).toMatchObject({ value: "center", reason: "imperative" })
      view.api.setValue("up-left")
      expect(view.state.value).toBe("up-left")
      expect(view.root.getAttribute("style")).toContain("--joystick-x: -0.707")
    } finally {
      view.unmount()
    }
  })

  test("a drag follows the pointer and springs back on release", async () => {
    const view = mount(joystick, {}, markup)
    try {
      await view.drag(view.root, { by: { x: -40, y: -40 } })
      const pushed = view.changes.filter((change) => change.reason === "drag").map((change) => change.value)
      expect(pushed).toContain("up-left")
      expect(view.changes.at(-1)).toMatchObject({ value: "center", reason: "release" })
      expect(view.state.dragging).toBe(false)
    } finally {
      view.unmount()
    }
  })

  test("pressing without moving doesn't jump to where the pointer landed", async () => {
    const view = mount(joystick, {}, markup)
    try {
      await view.click(view.root)
      expect(view.changes.filter((change) => change.reason === "drag")).toEqual([])
      expect(view.state.value).toBe("center")
    } finally {
      view.unmount()
    }
  })

  test("a controlled value waits for the app", () => {
    const asked: string[] = []
    const view = mount(joystick, { value: "center", onValueChange: (value) => asked.push(value) }, markup)
    try {
      key(view.part("thumb")!, "keydown", "ArrowUp")
      expect(asked).toEqual(["up"])
      expect(view.state.value).toBe("center")
    } finally {
      view.unmount()
    }
  })

  test("renders on the server", () => {
    checkServer(joystick, {}, markup)
  })

  // A joystick is physical: right stays right in a right-to-left page, so checkDirection doesn't apply.
  test("arrows keep their physical meaning right to left", () => {
    document.documentElement.dir = "rtl"
    const view = mount(joystick, {}, markup)
    try {
      key(view.part("thumb")!, "keydown", "ArrowRight")
      expect(view.state.value).toBe("right")
    } finally {
      view.unmount()
      document.documentElement.dir = ""
    }
  })
})
