type ScreenRecording = {
  extension: "mp4" | "webm"
  stop: () => Promise<Blob>
  onEnded: (listener: () => void) => void
}

// avc3 carries its codec settings in-band, so the recording survives the tab changing size.
const VIDEO_TYPES = [
  "video/mp4;codecs=avc3.640033,mp4a.40.2",
  "video/mp4;codecs=avc1.640033,mp4a.40.2",
  "video/mp4;codecs=avc1,opus",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm",
]

function canRecordScreen() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  )
}

async function recordScreen(audio: MediaStream | null): Promise<ScreenRecording> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 60 }, displaySurface: "browser" },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
  } as DisplayMediaStreamOptions)
  const [track] = display.getVideoTracks()

  const stream = new MediaStream([track, ...(audio?.getAudioTracks() ?? [])])
  const mimeType = VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 192_000,
  })
  const chunks: Blob[] = []
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start(1000)

  return {
    extension: recorder.mimeType.startsWith("video/mp4") ? "mp4" : "webm",
    onEnded: (listener) => track.addEventListener("ended", listener, { once: true }),
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.addEventListener(
          "stop",
          () => {
            for (const each of display.getTracks()) each.stop()
            resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }))
          },
          { once: true }
        )
        if (recorder.state === "inactive") recorder.dispatchEvent(new Event("stop"))
        else recorder.stop()
      }),
  }
}

export { canRecordScreen, recordScreen, type ScreenRecording }
