import {
  BEATS_PER_BAR,
  COUNT_IN_BEATS,
  MAX_TAKES,
  beatLength,
  loopDuration,
  loopPosition,
  nextBoundary,
  type KeyEvent,
} from "./loop"
import { quantizeTake } from "./quantize"
import type { AudioPorts } from "./synth"

type LoopPhase = "idle" | "stopped" | "starting" | "playing" | "count-in" | "armed" | "recording"
type Division = 4 | 8 | 16

type TrackState = { muted: boolean; bars: number; duration: number; events: readonly KeyEvent[] }

type LooperState = {
  phase: LoopPhase
  tracks: readonly (TrackState | null)[]
  count: number
  selected: number
  tempo: number
  bars: number
  duration: number
  origin: number
  boundary: number | null
  recording: number | null
  adjusted: boolean
  division: Division
  canUndo: boolean
}

type RecordOptions = { tempo: number; bars: number; metronome: boolean }

type Take = {
  bars: number
  duration: number
  buffer: AudioBuffer | null
  events: KeyEvent[]
  adjusted: { division: Division; buffer: AudioBuffer; events: KeyEvent[] } | null
  muted: boolean
  gain: GainNode
  sources: AudioBufferSourceNode[]
}

type Job = {
  id: number
  slot: number
  bars: number
  boundary: number
  duration: number
  latency: number
  lead: number
  resume: "idle" | "stopped" | "playing"
  take: Take | null
  replaced: Take | null
  head: Float32Array[] | null
  pre: Float32Array[] | null
  events: KeyEvent[]
  early: number | null
}

type Action =
  | { kind: "record"; slot: number; replaced: Take | null }
  | { kind: "delete"; slot: number; take: Take; tempo: number }

const EMPTY: null[] = Array.from({ length: MAX_TAKES }, () => null)

const IDLE: LooperState = {
  phase: "idle",
  tracks: EMPTY,
  count: 0,
  selected: 0,
  tempo: 0,
  bars: 0,
  duration: 0,
  origin: 0,
  boundary: null,
  recording: null,
  adjusted: false,
  division: 8,
  canUndo: false,
}

const TIMELINE: LoopPhase[] = ["count-in", "starting", "playing", "armed", "recording"]
const TAIL_SECONDS = 0.35
// Notes and drum hits start a few milliseconds after the key, so a press marks where its sound begins.
const SOUND_LEAD = 0.004
const FADE_FRAMES = 96

const WORKLET = `
class LoopRecorder extends AudioWorkletProcessor {
  constructor() {
    super()
    this.job = null
    this.port.onmessage = ({ data }) => {
      if (data.type === "start") this.job = { ...data, headSent: false }
      else if (data.type === "cancel") this.job = null
    }
  }
  copy(input, start, size, from, to, target) {
    const a = Math.max(start, from)
    const b = Math.min(start + size, to)
    if (b <= a || input.length === 0) return
    target[0].set(input[0].subarray(a - start, b - start), a - from)
    target[1].set((input[1] || input[0]).subarray(a - start, b - start), a - from)
  }
  process(inputs) {
    const job = this.job
    if (!job) return true
    const input = inputs[0]
    const size = input.length ? input[0].length : 128
    const start = currentFrame
    if (!job.headSent) {
      this.copy(input, start, size, job.lead, job.from, job.pre)
      this.copy(input, start, size, job.from, job.split, job.head)
    }
    this.copy(input, start, size, job.split, job.to, job.tail)
    if (!job.headSent && start + size >= job.split) {
      job.headSent = true
      this.port.postMessage(
        { type: "head", id: job.id, head: job.head, pre: job.pre },
        [job.head[0].buffer, job.head[1].buffer, job.pre[0].buffer, job.pre[1].buffer]
      )
    }
    if (start + size >= job.to) {
      this.port.postMessage({ type: "tail", id: job.id, tail: job.tail }, [job.tail[0].buffer, job.tail[1].buffer])
      this.job = null
    }
    return true
  }
}
registerProcessor("loop-recorder", LoopRecorder)
`

function halt(source: AudioScheduledSourceNode, time: number) {
  // A source takes one stop(); one that already has its end scheduled throws on a second.
  try {
    source.stop(time)
  } catch {}
}

function fade(channels: Float32Array[], edge: "in" | "out") {
  for (const data of channels) {
    const frames = Math.min(FADE_FRAMES, data.length)
    for (let index = 0; index < frames; index++) {
      const gain = index / frames
      if (edge === "in") data[index] *= gain
      else data[data.length - 1 - index] *= gain
    }
  }
}

class Looper {
  private ports: AudioPorts | null = null
  private node: AudioWorkletNode | null = null
  private ready: Promise<void> | null = null
  private slots: (Take | null)[] = [...EMPTY]
  private history: Action[] = []
  private state: LooperState = IDLE
  private listeners = new Set<() => void>()
  private clicks: { cancel: () => void }[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  private job: Job | null = null
  private held = new Map<string, { degree: number; time: number }>()
  private nextId = 1
  private adjust = false
  private division: Division = 8
  private metronome = false
  private beats: { origin: number; next: number; timer: ReturnType<typeof setInterval> } | null = null

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.state

  getServerSnapshot = () => IDLE

  attach(ports: AudioPorts | null) {
    if (!this.ports && ports) this.ports = ports
  }

  now() {
    if (!this.ports) return 0
    return this.ports.context.currentTime - this.latency()
  }

  buffers() {
    return this.slots.flatMap((take) => {
      const buffer = take && this.playable(take)
      return take && buffer ? [{ buffer, muted: take.muted }] : []
    })
  }

  async record(options: RecordOptions) {
    const ports = this.ports
    if (!ports) return
    if (this.job) return this.cancel()
    const slot = this.state.selected
    await this.prepare()
    if (this.job) return

    if (this.state.phase === "starting") {
      this.halt()
      this.silence()
      this.state = { ...this.state, phase: "stopped" }
    }
    const context = ports.context
    const now = context.currentTime
    const fresh = this.count() === 0
    if (fresh) this.history = []
    const tempo = fresh ? options.tempo : this.state.tempo
    const bars = options.bars
    const duration = loopDuration(bars, tempo)
    const beat = beatLength(tempo)
    const playing = this.state.phase === "playing"
    const resume = playing ? "playing" : fresh ? "idle" : "stopped"
    const cycle = fresh ? duration : this.state.duration
    // 2, 4 and 8 bars divide each other, so a take that starts on a multiple of its own length
    // from the origin always lines up; a longer take starts on a loop boundary and becomes bar 1.
    const boundary = playing
      ? nextBoundary(now, this.state.origin, Math.min(duration, cycle), beat)
      : now + 0.1 + COUNT_IN_BEATS * beat
    const origin = !playing || duration > cycle ? boundary : this.state.origin
    if (resume === "stopped") this.startPlayback(origin)
    // Re-recording a track: the old take plays until the new one starts, then steps aside.
    const replaced = this.slots[slot]?.buffer ? this.slots[slot] : null
    replaced?.gain.gain.setValueAtTime(0, boundary)
    this.metronome = options.metronome
    if (!playing) this.countIn(boundary, beat)

    const rate = context.sampleRate
    const latency = this.latency()
    const lead = Math.min(0.25, beat / 2)
    const frames = Math.round(duration * rate)
    const leadFrames = Math.round(lead * rate)
    const tailFrames = Math.min(Math.round(TAIL_SECONDS * rate), Math.floor(frames / 2))
    const from = Math.round((boundary + latency) * rate)
    const head = [new Float32Array(frames - tailFrames), new Float32Array(frames - tailFrames)]
    const tail = [new Float32Array(tailFrames), new Float32Array(tailFrames)]
    const pre = [new Float32Array(leadFrames), new Float32Array(leadFrames)]
    const id = this.nextId++
    this.job = {
      id,
      slot,
      bars,
      boundary,
      duration,
      latency,
      lead,
      resume,
      take: null,
      replaced,
      head: null,
      pre: null,
      events: [],
      early: null,
    }
    this.node!.port.postMessage(
      {
        type: "start",
        id,
        lead: from - leadFrames,
        from,
        split: from + frames - tailFrames,
        to: from + frames,
        pre,
        head,
        tail,
      },
      [pre[0].buffer, pre[1].buffer, head[0].buffer, head[1].buffer, tail[0].buffer, tail[1].buffer]
    )

    this.setState({
      phase: playing ? "armed" : "count-in",
      tempo,
      bars: Math.max(bars, fresh ? 0 : this.state.bars),
      duration: Math.max(duration, fresh ? 0 : cycle),
      origin,
      boundary,
      recording: slot,
    })
    this.at(boundary, () => {
      if (this.job?.id === id) this.setState({ phase: "recording" })
    })
  }

  cancel() {
    const job = this.job
    if (!job) return
    this.job = null
    this.node?.port.postMessage({ type: "cancel" })
    this.halt()
    if (job.take) this.drop(job.slot)
    if (job.replaced) {
      if (job.take) this.revive(job.slot, job.replaced)
      else job.replaced.gain.gain.setTargetAtTime(job.replaced.muted ? 0 : 1, this.ports?.context.currentTime ?? 0, 0.01)
    }
    if (job.resume === "stopped") this.silence()
    this.setState({ phase: job.resume, boundary: null, recording: null, ...this.cycle() })
  }

  play() {
    const ports = this.ports
    if (!ports || this.job || this.count() === 0 || this.state.phase !== "stopped") return
    const beat = beatLength(this.state.tempo)
    const origin = ports.context.currentTime + 0.1 + COUNT_IN_BEATS * beat
    this.startPlayback(origin)
    this.countIn(origin, beat)
    this.setState({ phase: "starting", origin, boundary: origin })
    this.at(origin, () => {
      if (this.state.phase === "starting") this.setState({ phase: "playing", boundary: null })
    })
  }

  stop() {
    if (this.job) this.cancel()
    if (this.state.phase !== "playing" && this.state.phase !== "starting") return
    this.halt()
    this.silence()
    this.setState({ phase: "stopped", boundary: null })
  }

  restart() {
    if (this.job || this.count() === 0) return
    this.halt()
    this.silence()
    this.state = { ...this.state, phase: "stopped" }
    this.play()
  }

  select(slot: number) {
    if (slot < 0 || slot >= MAX_TAKES) return
    this.setState({ selected: slot })
  }

  remove(slot: number) {
    const take = this.slots[slot]
    if (!take?.buffer || take === this.job?.take) return
    this.drop(slot)
    this.history.push({ kind: "delete", slot, take, tempo: this.state.tempo })
    this.settle()
  }

  undo() {
    if (this.job) return this.cancel()
    const action = this.history.pop()
    if (!action) return
    if (action.kind === "record") {
      this.drop(action.slot)
      if (action.replaced) this.revive(action.slot, action.replaced)
      this.state = { ...this.state, selected: action.slot }
      this.settle()
      return
    }
    if (this.slots[action.slot]) return
    if (this.state.phase === "idle") {
      this.state = { ...this.state, phase: "stopped", tempo: action.tempo }
    }
    this.revive(action.slot, action.take)
    this.setState({ selected: action.slot, tracks: this.trackStates(), ...this.cycle() })
  }

  private revive(slot: number, take: Take) {
    const ports = this.ports
    if (!ports) return
    take.gain = ports.context.createGain()
    take.gain.gain.value = take.muted ? 0 : 1
    take.gain.connect(ports.loop)
    take.sources = []
    this.slots[slot] = take
    this.state = { ...this.state, ...this.cycle() }
    if (this.running()) this.startTake(take, ports.context.currentTime + 0.03)
  }

  setMuted(slot: number, muted: boolean) {
    const take = this.slots[slot]
    if (!take || !this.ports) return
    take.muted = muted
    take.gain.gain.setTargetAtTime(muted ? 0 : 1, this.ports.context.currentTime, 0.01)
    this.setState({ tracks: this.trackStates() })
  }

  setMetronome(on: boolean) {
    this.metronome = on
    this.syncMetronome()
  }

  setAdjusted(on: boolean, division: Division = this.division) {
    this.adjust = on
    this.division = division
    const ports = this.ports
    if (ports && on) for (const take of this.slots) if (take) this.adjustTake(take)
    if (ports && this.running()) {
      const at = ports.context.currentTime + 0.03
      for (const take of this.slots) {
        if (take?.buffer && take !== this.job?.take) this.startTake(take, at)
      }
    }
    this.setState({ adjusted: on, division, tracks: this.trackStates() })
  }

  keyDown(source: string, degree: number) {
    if (!this.ports) return
    this.held.set(source, { degree, time: this.ports.context.currentTime })
  }

  keyUp(source: string) {
    const press = this.held.get(source)
    this.held.delete(source)
    if (!press || !this.ports || !this.job) return
    this.capture(this.job, press, this.ports.context.currentTime)
  }

  dispose() {
    if (this.beats) clearInterval(this.beats.timer)
    this.beats = null
    this.cancel()
    this.silence()
    for (const timer of this.timers) clearTimeout(timer)
  }

  private count() {
    return this.slots.filter((take) => take?.buffer).length
  }

  private running() {
    const { phase } = this.state
    return phase === "playing" || phase === "armed" || phase === "recording"
  }

  private settle() {
    if (this.count() === 0 && !this.job) {
      this.silence()
      this.halt()
      this.setState({ ...IDLE, selected: this.state.selected, adjusted: this.adjust, division: this.division })
      return
    }
    this.setState({ tracks: this.trackStates(), ...this.cycle() })
  }

  private cycle() {
    const takes = this.slots.filter((take): take is Take => !!take?.buffer)
    if (takes.length === 0) return {}
    const longest = takes.reduce((a, b) => (b.duration > a.duration ? b : a))
    return { bars: longest.bars, duration: longest.duration }
  }

  private capture(job: Job, press: { degree: number; time: number }, release: number) {
    const start = press.time + SOUND_LEAD - job.boundary - job.latency
    const end = Math.min(job.duration, release + SOUND_LEAD - job.boundary - job.latency)
    if (start < 0 && start >= -job.lead) {
      // An early press for the downbeat: its attack sits at the very end of the loop.
      job.early = job.early === null ? start : Math.min(job.early, start)
      job.events.push({ degree: press.degree, start: job.duration + start, end: job.duration })
      if (end > 0) job.events.push({ degree: press.degree, start: 0, end, continued: true })
      return
    }
    if (end > 0 && start < job.duration) {
      job.events.push({
        degree: press.degree,
        start: Math.max(0, start),
        end: Math.max(end, start),
        continued: start < 0,
      })
    }
  }

  private latency() {
    const context = this.ports?.context
    if (!context) return 0
    return (context.baseLatency || 0) + (context.outputLatency || 0) + 0.005
  }

  private async prepare() {
    const ports = this.ports!
    this.ready ??= (async () => {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }))
      try {
        await ports.context.audioWorklet.addModule(url)
      } finally {
        URL.revokeObjectURL(url)
      }
      const node = new AudioWorkletNode(ports.context, "loop-recorder", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 2,
        channelCountMode: "explicit",
      })
      const sink = ports.context.createGain()
      sink.gain.value = 0
      ports.live.connect(node)
      node.connect(sink).connect(ports.context.destination)
      node.port.onmessage = (event: MessageEvent) => this.receive(event.data)
      this.node = node
    })()
    await this.ready
  }

  private receive(data: {
    type: "head" | "tail"
    id: number
    head?: Float32Array[]
    pre?: Float32Array[]
    tail?: Float32Array[]
  }) {
    const job = this.job
    const ports = this.ports
    if (!job || !ports || data.id !== job.id) return
    const context = ports.context
    const replay = job.boundary + job.duration

    if (data.type === "head" && data.head) {
      fade(data.head, "in")
      job.head = data.head
      job.pre = data.pre ?? null
      const gain = context.createGain()
      gain.connect(ports.loop)
      const take: Take = {
        bars: job.bars,
        duration: job.duration,
        buffer: null,
        events: job.events,
        adjusted: null,
        muted: false,
        gain,
        sources: [],
      }
      job.take = take
      if (job.replaced) this.retire(job.replaced)
      this.slots[job.slot] = take
      const buffer = this.toBuffer(data.head)
      const now = context.currentTime + 0.005
      if (now >= replay + buffer.duration) return
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(gain)
      source.start(Math.max(now, replay), Math.max(0, now - replay))
      source.stop(replay + buffer.duration)
      take.sources.push(source)
      return
    }

    if (data.type === "tail" && data.tail && job.head && job.take) {
      fade(data.tail, "out")
      const head = job.head
      const tail = data.tail
      const headLength = head[0].length
      const channels = [0, 1].map((channel) => {
        const out = new Float32Array(headLength + tail[0].length)
        out.set(head[channel], 0)
        out.set(tail[channel], headLength)
        return out
      })
      for (const press of this.held.values()) this.capture(job, press, Infinity)
      if (job.early !== null && job.pre) this.foldEarly(channels, job.pre, job.early, context.sampleRate)
      const take = job.take
      take.buffer = this.toBuffer(channels)
      if (this.adjust) this.adjustTake(take)
      const now = context.currentTime
      if (this.adjust || job.early !== null) {
        this.startTake(take, now + 0.03)
      } else {
        const source = context.createBufferSource()
        source.buffer = take.buffer
        source.loop = true
        source.connect(take.gain)
        source.start(Math.max(replay + headLength / context.sampleRate, now + 0.005), headLength / context.sampleRate)
        take.sources.push(source)
      }
      this.history.push({ kind: "record", slot: job.slot, replaced: job.replaced })
      this.job = null
      this.clicks = []
      const moved = this.state.selected !== job.slot
      this.setState({
        phase: "playing",
        boundary: null,
        recording: null,
        selected: moved ? this.state.selected : this.nextEmpty(job.slot),
        tracks: this.trackStates(),
        ...this.cycle(),
      })
    }
  }

  private foldEarly(channels: Float32Array[], pre: Float32Array[], early: number, rate: number) {
    const leadFrames = pre[0].length
    const first = Math.max(0, leadFrames + Math.round(early * rate) - FADE_FRAMES)
    for (let channel = 0; channel < channels.length; channel++) {
      const out = channels[channel]
      for (let index = first; index < leadFrames; index++) {
        const gain = Math.min(1, (index - first) / FADE_FRAMES)
        out[out.length - leadFrames + index] += pre[channel][index] * gain
      }
    }
  }

  private toBuffer(channels: Float32Array[]) {
    const context = this.ports!.context
    const buffer = context.createBuffer(2, channels[0].length, context.sampleRate)
    channels.forEach((data, channel) => buffer.copyToChannel(data as Float32Array<ArrayBuffer>, channel))
    return buffer
  }

  private playable(take: Take) {
    return this.adjust && take.adjusted ? take.adjusted.buffer : take.buffer
  }

  private adjustTake(take: Take) {
    if (!take.buffer || take.adjusted?.division === this.division) return
    const grid = (beatLength(this.state.tempo) * 4) / this.division
    const raw = [take.buffer.getChannelData(0), take.buffer.getChannelData(1)]
    const { channels, events } = quantizeTake(raw, take.events, take.buffer.sampleRate, grid)
    take.adjusted = { division: this.division, buffer: this.toBuffer(channels), events }
  }

  private startTake(take: Take, at: number) {
    const buffer = this.playable(take)
    if (!buffer || !this.ports) return
    for (const source of take.sources) halt(source, at)
    const source = this.ports.context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(take.gain)
    source.start(at, loopPosition(at, this.state.origin, take.duration))
    take.sources = [source]
  }

  private startPlayback(origin: number) {
    const context = this.ports!.context
    for (const take of this.slots) {
      const buffer = take && this.playable(take)
      if (!take || !buffer) continue
      take.gain.gain.cancelScheduledValues(0)
      take.gain.gain.setValueAtTime(take.muted ? 0 : 1, context.currentTime)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(take.gain)
      source.start(origin)
      take.sources.push(source)
    }
  }

  private silence() {
    if (!this.ports) return
    const now = this.ports.context.currentTime
    for (const take of this.slots) {
      if (!take) continue
      take.gain.gain.setTargetAtTime(0, now, 0.008)
      for (const source of take.sources) halt(source, now + 0.05)
      take.sources = []
    }
  }

  private drop(slot: number) {
    const take = this.slots[slot]
    if (!take) return
    this.retire(take)
    this.slots[slot] = null
  }

  private retire(take: Take) {
    const now = this.ports?.context.currentTime ?? 0
    take.gain.gain.setTargetAtTime(0, now, 0.008)
    for (const source of take.sources) halt(source, now + 0.05)
    take.sources = []
    const gain = take.gain
    setTimeout(() => gain.disconnect(), 100)
  }

  private nextEmpty(from: number) {
    for (let step = 1; step <= MAX_TAKES; step++) {
      const slot = (from + step) % MAX_TAKES
      if (!this.slots[slot]) return slot
    }
    return from
  }

  private trackStates(): (TrackState | null)[] {
    return this.slots.map((take) =>
      take?.buffer && take !== this.job?.replaced
        ? {
            muted: take.muted,
            bars: take.bars,
            duration: take.duration,
            events: this.adjust && take.adjusted ? take.adjusted.events : take.events,
          }
        : null
    )
  }

  private countIn(boundary: number, beat: number) {
    const ports = this.ports!
    const now = ports.context.currentTime
    for (let count = COUNT_IN_BEATS; count >= 1; count--) {
      const time = boundary - count * beat
      if (time > now + 0.01) this.clicks.push(ports.click(time, false))
    }
  }

  private halt() {
    for (const click of this.clicks) click.cancel()
    this.clicks = []
    for (const timer of this.timers) clearTimeout(timer)
    this.timers = []
  }

  private syncMetronome() {
    const ports = this.ports
    const { phase, origin, tempo, duration } = this.state
    const running = this.metronome && ports && duration > 0 && TIMELINE.includes(phase)
    if (!running) {
      if (this.beats) clearInterval(this.beats.timer)
      this.beats = null
      return
    }
    if (this.beats?.origin === origin) return
    if (this.beats) clearInterval(this.beats.timer)
    const beat = beatLength(tempo)
    const now = ports.context.currentTime
    const beats = {
      origin,
      next: origin + Math.max(0, Math.ceil((now - origin) / beat - 1e-6)) * beat,
      timer: setInterval(() => tick(), 25),
    }
    const tick = () => {
      const current = ports.context.currentTime
      while (beats.next < current + 0.12) {
        if (beats.next >= current) {
          const index = Math.round((beats.next - origin) / beat)
          ports.click(beats.next, index % BEATS_PER_BAR === 0)
        }
        beats.next += beat
      }
    }
    this.beats = beats
    tick()
  }

  private at(time: number, run: () => void) {
    const delay = (time - this.ports!.context.currentTime) * 1000
    this.timers.push(setTimeout(run, Math.max(0, delay)))
  }

  private setState(patch: Partial<LooperState>) {
    this.state = {
      ...this.state,
      ...patch,
      tracks: this.trackStates(),
      count: this.count(),
      canUndo: this.job !== null || this.history.length > 0,
    }
    this.syncMetronome()
    for (const listener of this.listeners) listener()
  }
}

export { Looper, type Division, type LoopPhase, type LooperState, type TrackState }
