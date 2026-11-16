type RecordedVideo = {
  blob: Blob
  extension: "mp4" | "webm"
  seconds: number
}

type ScreenRecording = {
  stop: () => Promise<RecordedVideo>
  onEnded: (listener: () => void) => void
}

// What X, Instagram and QuickTime all take: H.264 and AAC in a plain MP4, at most 1080p and 30 frames a second.
const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const FRAME_RATE = 30
const VIDEO_BITRATE = 8_000_000
const AUDIO_BITRATE = 192_000

// Only for browsers that can't encode H.264 and AAC themselves.
const FALLBACK_TYPES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm",
]

// H.264 needs even sides.
const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2)

function fitSize(width: number, height: number) {
  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height)
  return { width: even(width * scale), height: even(height * scale) }
}

function canRecordScreen() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    (typeof VideoEncoder !== "undefined" || typeof MediaRecorder !== "undefined")
  )
}

async function recordScreen(audio: MediaStream | null): Promise<ScreenRecording> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: FRAME_RATE, max: FRAME_RATE }, displaySurface: "browser" },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
  } as DisplayMediaStreamOptions)
  const [video] = display.getVideoTracks()
  const [sound = null] = audio?.getAudioTracks() ?? []
  const release = () => {
    for (const track of display.getTracks()) track.stop()
  }
  const onEnded = (listener: () => void) => video.addEventListener("ended", listener, { once: true })
  const startedAt = performance.now()
  const seconds = () => (performance.now() - startedAt) / 1000

  try {
    const stop = (await recordMp4(video, sound)) ?? recordWithMediaRecorder(video, sound)
    return {
      onEnded,
      stop: async () => {
        const elapsed = seconds()
        try {
          return { ...(await stop()), seconds: elapsed }
        } finally {
          release()
        }
      },
    }
  } catch (error) {
    release()
    throw error
  }
}

async function recordMp4(video: MediaStreamVideoTrack, sound: MediaStreamTrack | null) {
  if (typeof VideoEncoder === "undefined") return null
  const media = await import("mediabunny")
  const settings = video.getSettings()
  const size = fitSize(settings.width ?? 1280, settings.height ?? 720)
  const videoQuality = new media.Quality({ bitrate: VIDEO_BITRATE })
  const audioQuality = new media.Quality({ bitrate: AUDIO_BITRATE })
  const [videoOk, audioOk] = await Promise.all([
    media.canEncodeVideo("avc", { ...size, frameRate: FRAME_RATE, quality: videoQuality }),
    sound ? media.canEncodeAudio("aac", { numberOfChannels: 2, quality: audioQuality }) : true,
  ])
  if (!videoOk || !audioOk) return null

  // A plain MP4 with its index up front, not fragments, which uploaders and QuickTime reject.
  const output = new media.Output({
    format: new media.Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new media.BufferTarget(),
  })
  const videoSource = new media.MediaStreamVideoTrackSource(
    video as MediaStreamVideoTrack,
    // A tab only sends a frame when something moves; frameRate repeats frames for a constant 30.
    // If the tab is resized mid-recording, the new size is fitted inside the first one.
    {
      codec: "avc",
      quality: videoQuality,
      transform: { ...size, frameRate: FRAME_RATE },
      sizeChangeBehavior: "contain",
    },
    { frameRate: FRAME_RATE }
  )
  output.addVideoTrack(videoSource, { frameRate: FRAME_RATE })
  const sources: { errorPromise: Promise<void> }[] = [videoSource]
  if (sound) {
    const audioSource = new media.MediaStreamAudioTrackSource(sound as MediaStreamAudioTrack, {
      codec: "aac",
      quality: audioQuality,
    })
    output.addAudioTrack(audioSource)
    sources.push(audioSource)
  }

  let failure: unknown = null
  for (const source of sources) source.errorPromise.catch((error: unknown) => (failure ??= error))
  await output.start()

  return async () => {
    if (failure) {
      await output.cancel()
      throw failure
    }
    await output.finalize()
    return { blob: new Blob([output.target.buffer!], { type: "video/mp4" }), extension: "mp4" as const }
  }
}

function recordWithMediaRecorder(video: MediaStreamTrack, sound: MediaStreamTrack | null) {
  const stream = new MediaStream(sound ? [video, sound] : [video])
  const mimeType = FALLBACK_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITRATE,
    audioBitsPerSecond: AUDIO_BITRATE,
  })
  const chunks: Blob[] = []
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.start(1000)

  return () =>
    new Promise<{ blob: Blob; extension: "mp4" | "webm" }>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          const type = recorder.mimeType || "video/webm"
          resolve({ blob: new Blob(chunks, { type }), extension: type.startsWith("video/mp4") ? "mp4" : "webm" })
        },
        { once: true }
      )
      if (recorder.state === "inactive") recorder.dispatchEvent(new Event("stop"))
      else recorder.stop()
    })
}

export { canRecordScreen, fitSize, recordScreen, type RecordedVideo, type ScreenRecording }
