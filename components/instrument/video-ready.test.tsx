import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { describe, expect, test } from "vitest"
import { createVideoConfirm, VideoReadyDialog, videoFacts } from "./video-ready"

const agent = createAgent()
const video = { url: "blob:video", seconds: 12.4, bytes: 4_300_000, extension: "mp4" }

describe("video ready", () => {
  test("a finished video downloads only once you confirm", async () => {
    const confirm = createVideoConfirm()
    render(<VideoReadyDialog confirm={confirm} />)

    let answer!: Promise<boolean>
    act(() => {
      answer = confirm(video)
    })
    const dialog = await screen.findByRole("alertdialog", { name: "Your video is ready" })
    expect(dialog.textContent).toContain("0:12 · 4.3 MB · MP4")
    expect(dialog.querySelector("video")?.getAttribute("src")).toBe("blob:video")
    await act(() => agent.act({ steps: [{ ref: "Your video is ready", action: "press", args: ["Download"] }] }))
    await expect(answer).resolves.toBe(true)

    act(() => {
      answer = confirm(video)
    })
    await screen.findByRole("alertdialog", { name: "Your video is ready" })
    await act(() => agent.act({ steps: [{ ref: "Your video is ready", action: "press", args: ["Discard"] }] }))
    await expect(answer).resolves.toBe(false)
  })

  test("the facts read as length, size and format", () => {
    expect(videoFacts({ ...video, seconds: 75.2, bytes: 18_250_000 })).toBe("1:15 · 18.3 MB · MP4")
    expect(videoFacts({ ...video, seconds: 0.2, bytes: 900, extension: "webm" })).toBe("0:01 · 1 KB · WEBM")
  })
})
