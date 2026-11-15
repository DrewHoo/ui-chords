import { playDrum, whiteNoise, type DrumPad, type DrumVoice, type KitId } from "./drums"

type EnvelopeId = "keys" | "pluck" | "touch" | "sustain" | "swell" | "long"
type InstrumentId = "saw" | "fm-piano" | "organ" | "strings" | "square" | "sine" | "bell" | "pad"
type PlayMode = "play" | "strum" | "arp"
type ArpPattern = "up" | "down" | "up-down" | "random"
type ReverbId = "off" | "room" | "hall"
type DelayId = "off" | "eighth" | "quarter"
type StrumSpeed = "slow" | "medium" | "fast"

type Envelope = { attack: number; decay: number; sustain: number; release: number }

type Layer =
  | { kind: "wave"; wave: OscillatorType; detune: number[]; gain: number; octave?: number }
  | { kind: "harmonics"; harmonics: number[]; detune: number[]; gain: number }
  | { kind: "fm"; ratio: number; index: number; decay: number; gain: number }

type Instrument = { label: string; envelope: EnvelopeId; brightness: number; layers: Layer[] }

const ENVELOPES: Record<EnvelopeId, Envelope & { label: string }> = {
  keys: { label: "Keys", attack: 0.005, decay: 1.2, sustain: 0.55, release: 0.7 },
  pluck: { label: "Pluck", attack: 0.005, decay: 0.08, sustain: 0, release: 0.18 },
  touch: { label: "Touch", attack: 0.025, decay: 0.26, sustain: 0.66, release: 0.05 },
  sustain: { label: "Sustain", attack: 0.2, decay: 0.3, sustain: 0.85, release: 3 },
  swell: { label: "Swell", attack: 0.8, decay: 0.3, sustain: 0.8, release: 2 },
  long: { label: "Long", attack: 0.8, decay: 1, sustain: 0.7, release: 2 },
}

const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  saw: {
    label: "Saw",
    envelope: "touch",
    brightness: 0.55,
    layers: [{ kind: "wave", wave: "sawtooth", detune: [-7, 7], gain: 0.5 }],
  },
  "fm-piano": {
    label: "FM piano",
    envelope: "keys",
    brightness: 0.9,
    layers: [
      { kind: "fm", ratio: 1, index: 2.2, decay: 0.9, gain: 0.8 },
      { kind: "fm", ratio: 14, index: 0.6, decay: 0.12, gain: 0.12 },
    ],
  },
  organ: {
    label: "Organ",
    envelope: "touch",
    brightness: 0.7,
    layers: [{ kind: "harmonics", harmonics: [1, 0.7, 0.45, 0.2, 0.1, 0.25], detune: [-3, 3], gain: 0.45 }],
  },
  strings: {
    label: "Strings",
    envelope: "swell",
    brightness: 0.45,
    layers: [{ kind: "wave", wave: "sawtooth", detune: [-12, 0, 12], gain: 0.34 }],
  },
  square: {
    label: "Square",
    envelope: "touch",
    brightness: 0.5,
    layers: [{ kind: "wave", wave: "square", detune: [-5, 5], gain: 0.32 }],
  },
  sine: {
    label: "Sine",
    envelope: "sustain",
    brightness: 1,
    layers: [{ kind: "wave", wave: "sine", detune: [-2, 2], gain: 0.7 }],
  },
  bell: {
    label: "Bell",
    envelope: "keys",
    brightness: 1,
    layers: [
      { kind: "fm", ratio: 3.5, index: 3, decay: 1.6, gain: 0.55 },
      { kind: "wave", wave: "sine", detune: [0], gain: 0.25, octave: 1 },
    ],
  },
  pad: {
    label: "Pad",
    envelope: "long",
    brightness: 0.35,
    layers: [
      { kind: "wave", wave: "sawtooth", detune: [-9, 9], gain: 0.3 },
      { kind: "wave", wave: "triangle", detune: [0], gain: 0.35, octave: -1 },
    ],
  },
}

const STRUM_GAPS: Record<StrumSpeed, number> = { slow: 0.12, medium: 0.08, fast: 0.04 }

type SynthSettings = {
  instrument: InstrumentId
  envelope: EnvelopeId
  volume: number
  filter: number
  reverb: ReverbId
  delay: DelayId
  chorus: boolean
  mode: PlayMode
  tempo: number
  arpPattern: ArpPattern
  strumSpeed: StrumSpeed
}

type Voice = { gain: GainNode; sources: AudioScheduledSourceNode[]; release: number }

type AudioPorts = {
  context: AudioContext
  live: AudioNode
  loop: AudioNode
  click: (time: number, accent: boolean) => { cancel: () => void }
}

const midiToFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12)

function impulse(context: AudioContext, seconds: number, decay: number) {
  const length = Math.floor(context.sampleRate * seconds)
  const buffer = context.createBuffer(2, length, context.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < length; index++) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** decay
    }
  }
  return buffer
}

class Synth {
  private context: AudioContext | null = null
  private input!: GainNode
  private filter!: BiquadFilterNode
  private live!: GainNode
  private mix!: GainNode
  private volume!: GainNode
  private loopBus!: GainNode
  private drumBus!: GainNode
  private noise!: AudioBuffer
  private openHat: DrumVoice | null = null
  private streamDestination: MediaStreamAudioDestinationNode | null = null
  private chorusWet!: GainNode
  private delayNode!: DelayNode
  private delaySend!: GainNode
  private reverbNode!: ConvolverNode
  private reverbSend!: GainNode
  private impulses: Partial<Record<ReverbId, AudioBuffer>> = {}
  private waves = new Map<string, PeriodicWave>()
  private voices = new Map<number, Voice>()
  private held: number[] = []
  private arpTimer: ReturnType<typeof setInterval> | null = null
  private arpStep = 0
  private arpNextTime = 0
  private settings: SynthSettings

  constructor(settings: SynthSettings) {
    this.settings = settings
  }

  get ready() {
    return this.context?.state === "running"
  }

  async start() {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return
    if (!this.context) this.build(new AudioContext({ latencyHint: "interactive" }))
    if (this.context!.state !== "running") await this.context!.resume()
  }

  ports(): AudioPorts | null {
    if (!this.context) return null
    return {
      context: this.context,
      live: this.live,
      loop: this.loopBus,
      click: (time, accent) => this.click(time, accent),
    }
  }

  stream() {
    if (!this.context) return null
    if (!this.streamDestination) {
      const limiter = this.limiter(this.context)
      this.streamDestination = this.context.createMediaStreamDestination()
      this.mix.connect(limiter).connect(this.streamDestination)
    }
    return this.streamDestination.stream
  }

  hit(pad: DrumPad, kit: KitId) {
    if (!this.context) return
    const time = this.context.currentTime + 0.003
    if (pad === "hat" || pad === "open-hat") {
      this.openHat?.stop(time)
      this.openHat = null
    }
    const voice = playDrum(this.context, this.drumBus, pad, kit, time, this.noise)
    if (pad === "open-hat") this.openHat = voice
    setTimeout(() => voice.output.disconnect(), 2000)
  }

  private click(time: number, accent: boolean) {
    const context = this.context!
    const oscillator = context.createOscillator()
    oscillator.frequency.value = accent ? 1760 : 1320
    const gain = context.createGain()
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(accent ? 0.32 : 0.2, time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.05)
    oscillator.connect(gain).connect(this.volume)
    oscillator.start(time)
    oscillator.stop(time + 0.06)
    oscillator.addEventListener("ended", () => gain.disconnect())
    return { cancel: () => gain.disconnect() }
  }

  private limiter(context: BaseAudioContext) {
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.2
    return limiter
  }

  update(settings: SynthSettings) {
    const previous = this.settings
    this.settings = settings
    if (!this.context) return
    const now = this.context.currentTime
    this.volume.gain.setTargetAtTime((settings.volume / 100) ** 2 * 0.9, now, 0.02)
    this.filter.frequency.setTargetAtTime(this.cutoff(), now, 0.03)
    this.chorusWet.gain.setTargetAtTime(settings.chorus ? 0.55 : 0, now, 0.05)
    this.delaySend.gain.setTargetAtTime(settings.delay === "off" ? 0 : 0.28, now, 0.05)
    this.delayNode.delayTime.setTargetAtTime(this.delayTime(), now, 0.05)
    if (previous.reverb !== settings.reverb) this.applyReverb()
    if (previous.mode !== settings.mode) {
      const notes = this.held
      this.play([])
      this.play(notes)
    }
  }

  play(notes: number[]) {
    const previous = this.held
    this.held = notes
    if (!this.context) return
    if (this.settings.mode === "arp") {
      this.releaseAll()
      if (notes.length === 0) this.stopArp()
      else if (!this.arpTimer) this.startArp()
      return
    }
    this.stopArp()
    const now = this.context.currentTime
    for (const [note] of this.voices) {
      if (!notes.includes(note)) this.release(note, now)
    }
    const added = notes.filter((note) => !previous.includes(note) || !this.voices.has(note))
    const gap = this.settings.mode === "strum" ? STRUM_GAPS[this.settings.strumSpeed] : 0
    added
      .sort((a, b) => a - b)
      .forEach((note, index) => {
        if (!this.voices.has(note)) this.voices.set(note, this.voice(note, now + 0.005 + index * gap))
      })
  }

  private build(context: AudioContext) {
    this.context = context
    this.input = context.createGain()
    this.filter = context.createBiquadFilter()
    this.filter.type = "lowpass"
    this.filter.Q.value = 0.7
    this.filter.frequency.value = this.cutoff()

    const dry = context.createGain()
    this.chorusWet = context.createGain()
    this.chorusWet.gain.value = this.settings.chorus ? 0.55 : 0
    const lfo = context.createOscillator()
    lfo.frequency.value = 0.6
    for (const [time, pan, depth] of [
      [0.013, -0.7, 0.0025],
      [0.019, 0.7, 0.003],
    ]) {
      const delay = context.createDelay(0.05)
      delay.delayTime.value = time
      const lfoDepth = context.createGain()
      lfoDepth.gain.value = depth
      lfo.connect(lfoDepth).connect(delay.delayTime)
      const panner = context.createStereoPanner()
      panner.pan.value = pan
      this.filter.connect(delay).connect(panner).connect(this.chorusWet)
    }
    lfo.start()

    this.live = context.createGain()
    this.loopBus = context.createGain()
    this.mix = context.createGain()
    this.volume = context.createGain()
    this.volume.gain.value = (this.settings.volume / 100) ** 2 * 0.9
    this.drumBus = context.createGain()
    this.drumBus.gain.value = 0.85
    this.noise = whiteNoise(context)

    this.delayNode = context.createDelay(2)
    this.delayNode.delayTime.value = this.delayTime()
    const feedback = context.createGain()
    feedback.gain.value = 0.35
    const delayTone = context.createBiquadFilter()
    delayTone.type = "lowpass"
    delayTone.frequency.value = 3200
    this.delaySend = context.createGain()
    this.delaySend.gain.value = this.settings.delay === "off" ? 0 : 0.28
    this.delayNode.connect(delayTone).connect(feedback).connect(this.delayNode)
    delayTone.connect(this.live)

    this.reverbNode = context.createConvolver()
    this.reverbSend = context.createGain()
    this.reverbNode.connect(this.live)

    this.input.connect(this.filter)
    this.filter.connect(dry).connect(this.live)
    this.chorusWet.connect(this.live)
    for (const bus of [dry, this.chorusWet]) {
      bus.connect(this.delaySend)
      bus.connect(this.reverbSend)
    }
    this.delaySend.connect(this.delayNode)
    this.reverbSend.connect(this.reverbNode)

    const drumRoom = context.createGain()
    drumRoom.gain.value = 0.18
    this.drumBus.connect(this.live)
    this.drumBus.connect(drumRoom).connect(this.reverbSend)

    this.live.connect(this.mix)
    this.loopBus.connect(this.mix)
    this.mix.connect(this.volume)
    this.volume.connect(this.limiter(context)).connect(context.destination)
    this.applyReverb()
  }

  private applyReverb() {
    if (!this.context) return
    const { reverb } = this.settings
    const now = this.context.currentTime
    if (reverb === "off") {
      this.reverbSend.gain.setTargetAtTime(0, now, 0.05)
      return
    }
    this.impulses[reverb] ??=
      reverb === "room" ? impulse(this.context, 1.4, 3) : impulse(this.context, 3.6, 2.2)
    this.reverbNode.buffer = this.impulses[reverb]!
    this.reverbSend.gain.setTargetAtTime(reverb === "room" ? 0.3 : 0.42, now, 0.05)
  }

  private cutoff() {
    const brightness = INSTRUMENTS[this.settings.instrument].brightness
    const amount = (this.settings.filter / 100) * (0.35 + brightness * 0.65)
    return 180 * 2 ** (amount * 6.9)
  }

  private delayTime() {
    const beat = 60 / this.settings.tempo
    return this.settings.delay === "quarter" ? beat : beat / 2
  }

  private wave(harmonics: number[]) {
    const id = harmonics.join(",")
    let wave = this.waves.get(id)
    if (!wave) {
      const real = new Float32Array(harmonics.length + 1)
      const imag = new Float32Array([0, ...harmonics])
      wave = this.context!.createPeriodicWave(real, imag)
      this.waves.set(id, wave)
    }
    return wave
  }

  private voice(note: number, time: number, gate?: number): Voice {
    const context = this.context!
    const envelope = ENVELOPES[this.settings.envelope]
    const instrument = INSTRUMENTS[this.settings.instrument]
    const frequency = midiToFrequency(note)
    const gain = context.createGain()
    const peak = 0.16
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(peak, time + envelope.attack)
    gain.gain.setTargetAtTime(peak * envelope.sustain, time + envelope.attack, envelope.decay / 3)
    gain.connect(this.input)

    const sources: AudioScheduledSourceNode[] = []
    for (const layer of instrument.layers) {
      const layerGain = context.createGain()
      layerGain.gain.value = layer.gain
      layerGain.connect(gain)
      if (layer.kind === "fm") {
        const carrier = context.createOscillator()
        carrier.frequency.value = frequency
        const modulator = context.createOscillator()
        modulator.frequency.value = frequency * layer.ratio
        const depth = context.createGain()
        depth.gain.setValueAtTime(frequency * layer.index, time)
        depth.gain.setTargetAtTime(frequency * layer.index * 0.15, time, layer.decay / 3)
        modulator.connect(depth).connect(carrier.frequency)
        carrier.connect(layerGain)
        sources.push(carrier, modulator)
        continue
      }
      const pans = layer.detune.length > 1 ? layer.detune.map((_, index, all) => -0.5 + index / (all.length - 1)) : [0]
      layer.detune.forEach((detune, index) => {
        const oscillator = context.createOscillator()
        if (layer.kind === "harmonics") oscillator.setPeriodicWave(this.wave(layer.harmonics))
        else oscillator.type = layer.wave
        const octave = layer.kind === "wave" ? (layer.octave ?? 0) : 0
        oscillator.frequency.value = frequency * 2 ** octave
        oscillator.detune.value = detune
        const panner = context.createStereoPanner()
        panner.pan.value = pans[index]
        oscillator.connect(panner).connect(layerGain)
        sources.push(oscillator)
      })
    }
    for (const source of sources) source.start(time)
    const voice = { gain, sources, release: envelope.release }
    if (gate !== undefined) this.end(voice, time + gate)
    return voice
  }

  private end(voice: Voice, time: number) {
    const { gain } = voice.gain
    // Firefox has no cancelAndHoldAtTime; holding the current value avoids a click there.
    if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(time)
    else {
      gain.cancelScheduledValues(time)
      if (time <= this.context!.currentTime + 0.01) gain.setValueAtTime(gain.value, time)
    }
    gain.setTargetAtTime(0, time, Math.max(voice.release, 0.02) / 4)
    const stop = time + voice.release * 1.6 + 0.1
    for (const source of voice.sources) source.stop(stop)
    voice.sources[0]?.addEventListener("ended", () => voice.gain.disconnect())
  }

  private release(note: number, time: number) {
    const voice = this.voices.get(note)
    if (!voice) return
    this.voices.delete(note)
    this.end(voice, time)
  }

  private releaseAll() {
    if (!this.context) return
    const now = this.context.currentTime
    for (const [note] of this.voices) this.release(note, now)
  }

  private startArp() {
    this.arpStep = 0
    this.arpNextTime = this.context!.currentTime + 0.01
    this.arpTimer = setInterval(() => this.scheduleArp(), 25)
    this.scheduleArp()
  }

  private stopArp() {
    if (this.arpTimer) clearInterval(this.arpTimer)
    this.arpTimer = null
  }

  private scheduleArp() {
    if (!this.context || this.held.length === 0) return
    const step = 60 / this.settings.tempo / 4
    while (this.arpNextTime < this.context.currentTime + 0.12) {
      const notes = [...this.held].sort((a, b) => a - b)
      const note = this.arpNote(notes, this.arpStep)
      this.voice(note, this.arpNextTime, step * 0.85)
      this.arpStep++
      this.arpNextTime += step
    }
  }

  private arpNote(notes: number[], step: number) {
    const { arpPattern } = this.settings
    if (arpPattern === "random") return notes[Math.floor(Math.random() * notes.length)]
    if (arpPattern === "down") return notes[notes.length - 1 - (step % notes.length)]
    if (arpPattern === "up-down" && notes.length > 1) {
      const cycle = notes.length * 2 - 2
      const position = step % cycle
      return notes[position < notes.length ? position : cycle - position]
    }
    return notes[step % notes.length]
  }
}

export {
  ENVELOPES,
  INSTRUMENTS,
  Synth,
  type ArpPattern,
  type AudioPorts,
  type DelayId,
  type EnvelopeId,
  type InstrumentId,
  type PlayMode,
  type ReverbId,
  type StrumSpeed,
  type SynthSettings,
}
