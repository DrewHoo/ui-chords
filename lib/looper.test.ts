import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Looper } from "./looper"
import type { AudioPorts } from "./synth"

const RATE = 1000

class FakeParam {
  value = 1
  setTargetAtTime(value: number) {
    this.value = value
  }
  setValueAtTime(value: number) {
    this.value = value
  }
  cancelScheduledValues() {}
}

class FakeNode {
  gain = new FakeParam()
  connect<T>(node: T) {
    return node
  }
  disconnect() {}
}

class FakeBuffer {
  private data: Float32Array[]
  constructor(channels: number, readonly length: number, readonly sampleRate: number) {
    this.data = Array.from({ length: channels }, () => new Float32Array(length))
  }
  get duration() {
    return this.length / this.sampleRate
  }
  getChannelData(channel: number) {
    return this.data[channel]
  }
  copyToChannel(source: Float32Array, channel: number, offset = 0) {
    this.data[channel].set(source, offset)
  }
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null
  loop = false
  started: number | null = null
  offset = 0
  stopped: number | null = null
  start(when = 0, offset = 0) {
    this.started = when
    this.offset = offset
  }
  stop(when = 0) {
    if (this.stopped !== null) throw new Error("stop twice")
    this.stopped = when
  }
}

type StartMessage = {
  type: "start"
  id: number
  from: number
  split: number
  to: number
  pre: Float32Array[]
  head: Float32Array[]
  tail: Float32Array[]
}

type Port = {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage: (message: StartMessage | { type: "cancel" }) => void
}

let worklet: { port: Port } | null
let starts: StartMessage[]

class FakeWorkletNode extends FakeNode {
  port: Port = {
    onmessage: null,
    postMessage: (message) => {
      if (message.type === "start") starts.push(message)
    },
  }
}

function trackWorklet(node: FakeWorkletNode) {
  worklet = node
  return node
}

function fakePorts() {
  const context = {
    currentTime: 0,
    sampleRate: RATE,
    baseLatency: 0,
    outputLatency: 0,
    destination: new FakeNode(),
    audioWorklet: { addModule: async () => {} },
    createGain: () => new FakeNode(),
    createBufferSource: () => new FakeSource(),
    createBuffer: (channels: number, length: number, rate: number) => new FakeBuffer(channels, length, rate),
  }
  const ports = {
    context,
    live: new FakeNode(),
    loop: new FakeNode(),
    click: () => ({ cancel: () => {} }),
  } as unknown as AudioPorts
  return { ports, context }
}

async function take(looper: Looper, context: { currentTime: number }, at: number[] = [], bars = 1) {
  await looper.record({ tempo: 120, bars, metronome: false })
  const job = starts[starts.length - 1]
  const seconds = (job.to - job.from) / RATE
  const state = looper.getSnapshot()
  const boundary = state.boundary!
  context.currentTime = boundary
  for (const index of at) {
    // The sound starts 4 ms after the key and the take is shifted by the 5 ms the looper assumes for output.
    const time = boundary + index / RATE + 0.001
    context.currentTime = time
    looper.keyDown(`key:${index}`, 0)
    context.currentTime = time + 0.05
    looper.keyUp(`key:${index}`)
  }
  for (const index of at) {
    for (const channel of [0, 1]) {
      if (index < job.head[0].length) job.head[channel][index] = 1
      else job.tail[channel][index - job.head[0].length] = 1
    }
  }
  context.currentTime = boundary + seconds - 0.3
  worklet!.port.onmessage!({ data: { type: "head", id: job.id, head: job.head, pre: job.pre } })
  context.currentTime = boundary + seconds + 0.01
  worklet!.port.onmessage!({ data: { type: "tail", id: job.id, tail: job.tail } })
}

const multipleOf = (value: number, step: number) => Math.abs(value / step - Math.round(value / step)) < 1e-6
const position = (time: number, origin: number, length: number) => (((time - origin) % length) + length) % length

const peaks = (data: Float32Array) => [...data].flatMap((value, index) => (value > 0.5 ? [index] : []))

describe("the looper's tracks", () => {
  beforeEach(() => {
    starts = []
    worklet = null
    vi.stubGlobal("AudioWorkletNode", function AudioWorkletNode() {
      return trackWorklet(new FakeWorkletNode())
    })
    URL.createObjectURL = () => "blob:worklet"
    URL.revokeObjectURL = () => {}
  })
  afterEach(() => vi.unstubAllGlobals())

  test("each take lands in the selected circle and the selection moves to the next empty one", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    expect(looper.getSnapshot().selected).toBe(0)
    await take(looper, context)
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([true, false, false, false])
    expect(looper.getSnapshot().selected).toBe(1)
    looper.select(3)
    await take(looper, context)
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([true, false, false, true])
    expect(looper.getSnapshot().selected).toBe(1)
  })

  test("deleting track 1 leaves tracks 2 and 3 where they are, ready to record into 1 again", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context)
    await take(looper, context)
    await take(looper, context)
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([true, true, true, false])

    looper.select(0)
    looper.remove(0)
    const after = looper.getSnapshot()
    expect(after.tracks.map(Boolean)).toEqual([false, true, true, false])
    expect(after).toMatchObject({ count: 2, selected: 0, phase: "playing" })

    await take(looper, context)
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([true, true, true, false])
    expect(looper.getSnapshot().selected).toBe(3)

    looper.undo()
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([false, true, true, false])
    looper.undo()
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([true, true, true, false])
    expect(looper.getSnapshot().selected).toBe(0)
  })

  test("recording over a track replaces it, and undo brings the old take back", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context, [100])
    await take(looper, context, [500])
    looper.select(0)
    await take(looper, context, [1500])
    const peaksOf = () => looper.buffers().map(({ buffer }) => peaks(buffer.getChannelData(0)))
    expect(peaksOf()).toEqual([[1500], [500]])
    expect(looper.getSnapshot().count).toBe(2)
    looper.undo()
    expect(peaksOf()).toEqual([[100], [500]])
    expect(looper.getSnapshot().selected).toBe(0)
  })

  test("cancelling a re-record keeps the old take", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context, [100])
    looper.select(0)
    await looper.record({ tempo: 120, bars: 1, metronome: false })
    expect(looper.getSnapshot().recording).toBe(0)
    expect(looper.getSnapshot().tracks[0]).toBeNull()
    looper.cancel()
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([true, false, false, false])
    expect(peaks(looper.buffers()[0].buffer.getChannelData(0))).toEqual([100])
  })

  test("cancelling a re-record halfway through keeps the old take", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context, [100])
    looper.select(0)
    await looper.record({ tempo: 120, bars: 1, metronome: false })
    const job = starts[starts.length - 1]
    context.currentTime = looper.getSnapshot().boundary! + 1.7
    worklet!.port.onmessage!({ data: { type: "head", id: job.id, head: job.head, pre: job.pre } })
    looper.cancel()
    expect(looper.getSnapshot().tracks.map(Boolean)).toEqual([true, false, false, false])
    expect(peaks(looper.buffers()[0].buffer.getChannelData(0))).toEqual([100])
  })

  test("deleting every track can still be undone", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context)
    looper.remove(0)
    expect(looper.getSnapshot()).toMatchObject({ phase: "idle", count: 0, canUndo: true })
    looper.undo()
    expect(looper.getSnapshot()).toMatchObject({ phase: "stopped", count: 1, tempo: 120, bars: 1 })
  })

  test("Adjust snaps the recorded audio to the beat, and turning it off brings it back", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context, [90, 1110])
    expect(peaks(looper.buffers()[0].buffer.getChannelData(0))).toEqual([90, 1110])

    looper.setAdjusted(true, 4)
    expect(peaks(looper.buffers()[0].buffer.getChannelData(0))).toEqual([0, 1000])
    const starts = looper.getSnapshot().tracks[0]!.events.map((event) => event.start)
    expect(starts[0]).toBeCloseTo(0)
    expect(starts[1]).toBeCloseTo(1)

    looper.setAdjusted(false)
    expect(peaks(looper.buffers()[0].buffer.getChannelData(1))).toEqual([90, 1110])
  })

  test("a chord played just before the 1 is kept, and Adjust puts it on the 1", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await looper.record({ tempo: 120, bars: 1, metronome: false })
    const job = starts[0]
    const boundary = looper.getSnapshot().boundary!
    context.currentTime = boundary - 0.059
    looper.keyDown("key:early", 0)
    const early = job.pre[0].length - 60
    for (const channel of [0, 1]) job.pre[channel][early] = 1
    context.currentTime = boundary + 0.3
    looper.keyUp("key:early")
    context.currentTime = boundary + 1.7
    worklet!.port.onmessage!({ data: { type: "head", id: job.id, head: job.head, pre: job.pre } })
    context.currentTime = boundary + 2.01
    worklet!.port.onmessage!({ data: { type: "tail", id: job.id, tail: job.tail } })

    expect(peaks(looper.buffers()[0].buffer.getChannelData(0))).toEqual([1940])
    looper.setAdjusted(true, 4)
    expect(peaks(looper.buffers()[0].buffer.getChannelData(0))).toEqual([0])
  })
})

describe("takes of different lengths", () => {
  beforeEach(() => {
    starts = []
    worklet = null
    vi.stubGlobal("AudioWorkletNode", function AudioWorkletNode() {
      return trackWorklet(new FakeWorkletNode())
    })
    URL.createObjectURL = () => "blob:worklet"
    URL.revokeObjectURL = () => {}
  })
  afterEach(() => vi.unstubAllGlobals())

  test("counts in four beats before recording or playing", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    context.currentTime = 10
    await looper.record({ tempo: 120, bars: 1, metronome: false })
    expect(looper.getSnapshot().boundary! - 10).toBeCloseTo(0.1 + 4 * 0.5)
    looper.cancel()
    await take(looper, context)
    looper.stop()
    context.currentTime = 30
    looper.play()
    expect(looper.getSnapshot()).toMatchObject({ phase: "starting" })
    expect(looper.getSnapshot().origin - 30).toBeCloseTo(2.1)
  })

  test("a longer take becomes the cycle and starts on a loop boundary", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context, [], 1)
    const first = looper.getSnapshot()
    expect(first).toMatchObject({ bars: 1, duration: 2 })

    context.currentTime = first.origin + 4.3
    await looper.record({ tempo: 120, bars: 2, metronome: false })
    const armed = looper.getSnapshot()
    expect(armed.boundary! - first.origin).toBeCloseTo(6)
    expect(armed.origin).toBe(armed.boundary)
    expect(armed).toMatchObject({ bars: 2, duration: 4 })
    looper.cancel()
    expect(looper.getSnapshot()).toMatchObject({ bars: 1, duration: 2 })

    await take(looper, context, [], 2)
    const both = looper.getSnapshot()
    expect(both).toMatchObject({ bars: 2, duration: 4, count: 2 })
    expect(both.tracks.map((track) => track?.bars)).toEqual([1, 2, undefined, undefined])
  })

  test("a shorter take lines up on its own length inside a longer loop", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context, [], 2)
    const origin = looper.getSnapshot().origin
    context.currentTime += 0.7
    await looper.record({ tempo: 120, bars: 1, metronome: false })
    const armed = looper.getSnapshot()
    expect(armed.origin).toBe(origin)
    expect(multipleOf(armed.boundary! - origin, 2)).toBe(true)
    expect(armed.duration).toBe(4)
  })

  test("every take keeps its own loop when sources restart, and deleting the longest shrinks the cycle", async () => {
    const looper = new Looper()
    const { ports, context } = fakePorts()
    looper.attach(ports)
    await take(looper, context, [], 1)
    await take(looper, context, [], 2)
    context.currentTime += 3.3
    const sources: FakeSource[] = []
    const create = context.createBufferSource
    context.createBufferSource = () => {
      const source = create()
      sources.push(source)
      return source
    }
    looper.setAdjusted(true, 8)
    const { origin } = looper.getSnapshot()
    const at = context.currentTime + 0.03
    expect(sources).toHaveLength(2)
    expect(sources[0].offset).toBeCloseTo(position(at, origin, 2))
    expect(sources[1].offset).toBeCloseTo(position(at, origin, 4))
    expect(position(at, origin, 4)).toBeGreaterThan(2)

    looper.remove(1)
    expect(looper.getSnapshot()).toMatchObject({ bars: 1, duration: 2, count: 1 })
  })
})

