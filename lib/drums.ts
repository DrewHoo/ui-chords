type DrumPad = "kick" | "clap" | "snare" | "hat" | "tom" | "rim" | "open-hat"
type KitId = "analog" | "tight"

type Kit = {
  label: string
  kickPitch: number
  kickDecay: number
  snareTone: number
  hatDecay: number
  tone: number
}

const DRUM_PADS: DrumPad[] = ["kick", "clap", "snare", "hat", "tom", "rim", "open-hat"]

const DRUM_LABELS: Record<DrumPad, string> = {
  kick: "Kick",
  clap: "Clap",
  snare: "Snare",
  hat: "Hi-hat",
  tom: "Tom",
  rim: "Rim",
  "open-hat": "Open hat",
}

const KITS: Record<KitId, Kit> = {
  analog: { label: "Analog", kickPitch: 1, kickDecay: 0.55, snareTone: 180, hatDecay: 1, tone: 1 },
  tight: { label: "Tight", kickPitch: 1.25, kickDecay: 0.3, snareTone: 230, hatDecay: 0.6, tone: 1.35 },
}

const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21]

type DrumVoice = { output: GainNode; stop: (time: number) => void }

function envelope(context: BaseAudioContext, destination: AudioNode, time: number, peak: number, decay: number) {
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(peak, time + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0005, time + decay)
  gain.connect(destination)
  return gain
}

function noiseSource(context: BaseAudioContext, noise: AudioBuffer, time: number, length: number) {
  const source = context.createBufferSource()
  source.buffer = noise
  source.start(time, Math.random() * (noise.duration - length - 0.01))
  source.stop(time + length)
  return source
}

function metal(context: BaseAudioContext, destination: AudioNode, time: number, length: number, tone: number) {
  const band = context.createBiquadFilter()
  band.type = "bandpass"
  band.frequency.value = 10000 * tone
  band.Q.value = 0.8
  const high = context.createBiquadFilter()
  high.type = "highpass"
  high.frequency.value = 7000
  band.connect(high).connect(destination)
  for (const ratio of METAL_RATIOS) {
    const oscillator = context.createOscillator()
    oscillator.type = "square"
    oscillator.frequency.value = 40 * ratio * tone
    oscillator.connect(band)
    oscillator.start(time)
    oscillator.stop(time + length)
  }
}

function playDrum(
  context: BaseAudioContext,
  destination: AudioNode,
  pad: DrumPad,
  kitId: KitId,
  time: number,
  noise: AudioBuffer
): DrumVoice {
  const kit = KITS[kitId]
  const output = context.createGain()
  output.connect(destination)
  const stop = (at: number) => {
    output.gain.cancelScheduledValues(at)
    output.gain.setTargetAtTime(0, at, 0.008)
  }

  if (pad === "kick") {
    const body = context.createOscillator()
    body.frequency.setValueAtTime(160 * kit.kickPitch, time)
    body.frequency.exponentialRampToValueAtTime(48 * kit.kickPitch, time + 0.09)
    body.connect(envelope(context, output, time, 1, kit.kickDecay))
    body.start(time)
    body.stop(time + kit.kickDecay + 0.05)
    const click = context.createBiquadFilter()
    click.type = "highpass"
    click.frequency.value = 3000
    noiseSource(context, noise, time, 0.01).connect(click).connect(envelope(context, output, time, 0.25, 0.008))
  }

  if (pad === "snare") {
    const body = context.createOscillator()
    body.type = "triangle"
    body.frequency.setValueAtTime(kit.snareTone * 1.3, time)
    body.frequency.exponentialRampToValueAtTime(kit.snareTone, time + 0.04)
    body.connect(envelope(context, output, time, 0.5, 0.12))
    body.start(time)
    body.stop(time + 0.15)
    const crack = context.createBiquadFilter()
    crack.type = "highpass"
    crack.frequency.value = 1500 * kit.tone
    noiseSource(context, noise, time, 0.25).connect(crack).connect(envelope(context, output, time, 0.55, 0.2))
  }

  if (pad === "clap") {
    const band = context.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = 1100 * kit.tone
    band.Q.value = 1.2
    band.connect(output)
    for (const [offset, decay] of [
      [0, 0.012],
      [0.011, 0.012],
      [0.022, 0.18],
    ]) {
      noiseSource(context, noise, time + offset, decay + 0.02).connect(
        envelope(context, band, time + offset, 0.9, decay)
      )
    }
  }

  if (pad === "hat" || pad === "open-hat") {
    const decay = (pad === "hat" ? 0.05 : 0.38) * kit.hatDecay
    metal(context, envelope(context, output, time, 0.5, decay), time, decay + 0.02, kit.tone)
  }

  if (pad === "tom") {
    const body = context.createOscillator()
    body.frequency.setValueAtTime(190 * kit.tone, time)
    body.frequency.exponentialRampToValueAtTime(95 * kit.tone, time + 0.25)
    body.connect(envelope(context, output, time, 0.8, 0.35))
    body.start(time)
    body.stop(time + 0.4)
  }

  if (pad === "rim") {
    const body = context.createOscillator()
    body.type = "triangle"
    body.frequency.value = 820 * kit.tone
    body.connect(envelope(context, output, time, 0.6, 0.035))
    body.start(time)
    body.stop(time + 0.05)
    const click = context.createBiquadFilter()
    click.type = "bandpass"
    click.frequency.value = 2500
    noiseSource(context, noise, time, 0.02).connect(click).connect(envelope(context, output, time, 0.4, 0.015))
  }

  return { output, stop }
}

function whiteNoise(context: BaseAudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1
  return buffer
}

export { DRUM_LABELS, DRUM_PADS, KITS, playDrum, whiteNoise, type DrumPad, type DrumVoice, type KitId }
