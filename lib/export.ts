import { exportRepeats } from "./loop"

type LoopBuffer = { buffer: AudioBuffer; muted: boolean }

async function renderLoop(takes: LoopBuffer[], duration: number, sampleRate: number) {
  const repeats = exportRepeats(duration)
  const seconds = duration * repeats
  const context = new OfflineAudioContext(2, Math.round(seconds * sampleRate), sampleRate)
  const master = context.createGain()
  const fadeOut = Math.min(3, duration)
  master.gain.setValueAtTime(1, seconds - fadeOut)
  master.gain.linearRampToValueAtTime(0, seconds)
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.2
  master.connect(limiter).connect(context.destination)
  for (const take of takes) {
    if (take.muted) continue
    const source = context.createBufferSource()
    source.buffer = take.buffer
    source.loop = true
    source.connect(master)
    source.start(0)
    source.stop(seconds)
  }
  return context.startRendering()
}

function toInt16(data: Float32Array, start: number, end: number) {
  const out = new Int16Array(end - start)
  for (let index = start; index < end; index++) {
    const sample = Math.max(-1, Math.min(1, data[index]))
    out[index - start] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return out
}

async function encodeMp3(buffer: AudioBuffer, onProgress?: (progress: number) => void) {
  const { Mp3Encoder } = await import("@breezystack/lamejs")
  const encoder = new Mp3Encoder(2, buffer.sampleRate, 192)
  const left = buffer.getChannelData(0)
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left
  const block = 1152 * 16
  const parts: Uint8Array<ArrayBuffer>[] = []
  for (let start = 0, step = 0; start < left.length; start += block, step++) {
    const end = Math.min(start + block, left.length)
    const encoded = encoder.encodeBuffer(toInt16(left, start, end), toInt16(right, start, end))
    if (encoded.length > 0) parts.push(new Uint8Array(encoded))
    if (step % 12 === 11) {
      onProgress?.(end / left.length)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  parts.push(new Uint8Array(encoder.flush()))
  onProgress?.(1)
  return new Blob(parts, { type: "audio/mpeg" })
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement("a"), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function fileStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

export { download, encodeMp3, fileStamp, renderLoop }
