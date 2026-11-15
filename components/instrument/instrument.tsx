"use client"

import { Button } from "@ui-sdk/react/button"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react"
import { Joystick, JoystickThumb } from "@/components/joystick/parts"
import { directionFromArrows } from "@/components/joystick/joystick"
import { DRUM_LABELS, DRUM_PADS, KITS } from "@/lib/drums"
import { download, encodeMp3, fileStamp, renderLoop } from "@/lib/export"
import { COUNT_IN_BEATS, beatsUntil, echoAt, loopPosition, meterAt } from "@/lib/loop"
import { focusCameFromPointer, trackFocusModality } from "@/lib/focus-modality"
import { Looper } from "@/lib/looper"
import { canRecordScreen, recordScreen, type ScreenRecording } from "@/lib/screen-recording"
import { Synth, type SynthSettings } from "@/lib/synth"
import {
  DIRECTIONS,
  MELODY_HINTS,
  MODIFIER_HINTS,
  SCALES,
  chordAt,
  keyLabel,
  melodyNote,
  voice,
  type ChordTypeId,
  type Direction,
} from "@/lib/theory"
import { ChordKey } from "./chord-key"
import { MinusIcon, PlusIcon } from "./icons"
import { Lcd, Meter } from "./lcd"
import { DEFAULT_SETTINGS, type Part, type Settings, type UpdateSettings } from "./settings"
import { RhythmPanel, SoundPanel, TonalityPanel } from "./settings-panels"
import { Speaker } from "./speaker"
import { Transport } from "./transport"
import { VolumeWheel } from "./volume-wheel"
import styles from "./instrument.module.css"

const DEGREES = [0, 1, 2, 3, 4, 5, 6]
const JOYSTICK_KEYS: Record<string, string> = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  KeyW: "ArrowUp",
  KeyS: "ArrowDown",
  KeyA: "ArrowLeft",
  KeyD: "ArrowRight",
}
const PART_KEYS: Record<string, Part> = { KeyZ: "chords", KeyX: "melody", KeyC: "drums" }
const WIDGETS =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [role="menu"], [role="slider"], [role="radio"], [role="switch"]'
const TEXT_FIELDS = 'input, textarea, [contenteditable="true"]'
const STYLES = { play: "HOLD", strum: "STRUM", arp: "ARP" }
const VIDEO_LIMIT = 3 * 60 * 1000

const noSubscription = () => () => {}

type Notice =
  | { kind: "volume" }
  | { kind: "adjust" }
  | { kind: "track"; slot: number }
  | { kind: "deleted"; slot: number }
  | { kind: "restored"; slot: number }

function chordDegree(event: KeyboardEvent) {
  const match = /^(?:Digit|Numpad)([1-7])$/.exec(event.code)
  return match ? Number(match[1]) - 1 : null
}

function clockText(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function Instrument({ initialSettings = DEFAULT_SETTINGS }: { initialSettings?: Settings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [synth] = useState(() => new Synth(initialSettings))
  const [looper] = useState(() => new Looper())
  const loop = useSyncExternalStore(looper.subscribe, looper.getSnapshot, looper.getServerSnapshot)
  const videoSupported = useSyncExternalStore(noSubscription, canRecordScreen, () => false)
  const [direction, setDirection] = useState<Direction>("center")
  const [held, setHeld] = useState<number[]>([])
  const [lastPad, setLastPad] = useState<number | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [videoStart, setVideoStart] = useState<number | null>(null)
  const [videoElapsed, setVideoElapsed] = useState(0)
  const [clock, setClock] = useState<{ countdown: number | null; echo: string; beat: number }>({
    countdown: null,
    echo: "",
    beat: -1,
  })
  const sources = useRef(new Map<string, number>())
  const previous = useRef<number[] | null>(null)
  const latest = useRef(settings)
  const session = useRef<ScreenRecording | null>(null)
  const videoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    latest.current = settings
  })
  useEffect(() => () => looper.dispose(), [looper])

  const update = useCallback<UpdateSettings>((patch) => setSettings((current) => ({ ...current, ...patch })), [])

  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(noticeTimer.current ?? undefined), [])
  const flash = useCallback((next: Notice) => {
    setNotice(next)
    clearTimeout(noticeTimer.current ?? undefined)
    noticeTimer.current = setTimeout(() => setNotice(null), 1400)
  }, [])
  const setVolume = useCallback(
    (volume: number) => {
      update({ volume })
      flash({ kind: "volume" })
    },
    [update, flash]
  )
  const setAdjusted = useCallback(
    (on: boolean) => {
      looper.setAdjusted(on, latest.current.snap)
      flash({ kind: "adjust" })
    },
    [looper, flash]
  )
  const selectTrack = useCallback(
    (slot: number) => {
      looper.select(slot)
      flash({ kind: "track", slot })
    },
    [looper, flash]
  )
  const deleteTrack = useCallback(() => {
    const current = looper.getSnapshot()
    if (current.recording !== null) return looper.cancel()
    if (!current.tracks[current.selected]) return
    looper.remove(current.selected)
    flash({ kind: "deleted", slot: current.selected })
  }, [looper, flash])
  const undo = useCallback(() => {
    const before = looper.getSnapshot()
    looper.undo()
    const after = looper.getSnapshot()
    const restored = after.tracks.findIndex((track, slot) => track && !before.tracks[slot])
    if (restored !== -1) flash({ kind: "restored", slot: restored })
  }, [looper, flash])

  const wake = useCallback(async () => {
    const starting = synth.start()
    looper.attach(synth.ports())
    await starting
  }, [synth, looper])

  const press = useCallback(
    (source: string, degree: number) => {
      void wake()
      const current = latest.current
      if (current.part === "drums") {
        synth.hit(DRUM_PADS[degree], current.kit)
        setLastPad(degree)
      }
      looper.keyDown(source, degree)
      sources.current.delete(source)
      sources.current.set(source, degree)
      setHeld([...sources.current.values()])
    },
    [synth, looper, wake]
  )

  const release = useCallback(
    (source: string) => {
      looper.keyUp(source)
      if (!sources.current.delete(source)) return
      setHeld([...sources.current.values()])
    },
    [looper]
  )

  const tap = useCallback(
    (degree: number) => {
      const source = `tap:${degree}:${performance.now()}`
      press(source, degree)
      setTimeout(() => release(source), latest.current.part === "drums" ? 120 : 700)
    },
    [press, release]
  )

  const record = useCallback(async () => {
    await wake()
    const { tempo, bars, metronome } = latest.current
    await looper.record({ tempo, bars, metronome })
  }, [looper, wake])

  const setPlaying = useCallback(
    (playing: boolean) => {
      void wake()
      if (playing) looper.play()
      else looper.stop()
    },
    [looper, wake]
  )

  const exportAudio = useCallback(async () => {
    const takes = looper.buffers()
    if (takes.length === 0) return
    setProgress(0)
    try {
      const rendered = await renderLoop(takes, looper.getSnapshot().duration, takes[0].buffer.sampleRate)
      const blob = await encodeMp3(rendered, setProgress)
      download(blob, `ui-chords-${fileStamp()}.mp3`)
    } finally {
      setProgress(null)
    }
  }, [looper])

  const stopVideo = useCallback(async () => {
    const current = session.current
    if (!current) return
    session.current = null
    clearTimeout(videoTimer.current ?? undefined)
    const blob = await current.stop()
    if (blob.size > 0) download(blob, `ui-chords-${fileStamp()}.${current.extension}`)
    setVideoStart(null)
  }, [])

  const startVideo = useCallback(() => {
    void wake()
    recordScreen(synth.stream()).then(
      (recording) => {
        session.current = recording
        recording.onEnded(() => void stopVideo())
        videoTimer.current = setTimeout(() => void stopVideo(), VIDEO_LIMIT)
        looper.restart()
        setVideoStart(performance.now())
      },
      () => {}
    )
  }, [synth, looper, wake, stopVideo])

  const actions = useRef({ record, setPlaying, undo: () => {}, setPart: (part: Part) => update({ part }) })

  const { part, octave, voiceLeading, bass } = settings
  const active = held.length > 0 ? held[held.length - 1] : null
  const chord =
    part === "chords" && active !== null
      ? chordAt(settings.key, settings.scale, active, direction, settings.modifierSet)
      : null
  const note =
    part === "melody" && active !== null ? melodyNote(settings.key, settings.scale, active, direction, octave) : null
  const root = chord?.root ?? null
  const type: ChordTypeId | null = chord?.type ?? null
  const melodyMidi = note?.midi ?? null

  const synthSettings = useMemo<SynthSettings>(
    () =>
      part === "melody"
        ? { ...settings, instrument: settings.leadInstrument, envelope: settings.leadEnvelope, mode: "play" }
        : settings,
    [settings, part]
  )
  useEffect(() => synth.update(synthSettings), [synth, synthSettings])
  useEffect(() => looper.setMetronome(settings.metronome), [looper, settings.metronome])
  useEffect(() => {
    const current = looper.getSnapshot()
    if (current.division !== settings.snap) looper.setAdjusted(current.adjusted, settings.snap)
  }, [looper, settings.snap])
  useEffect(() => {
    actions.current = { record, setPlaying, undo, setPart: (part: Part) => update({ part }) }
  })

  useEffect(() => {
    if (part === "melody") {
      synth.play(melodyMidi === null ? [] : [melodyMidi])
      return
    }
    if (part !== "chords" || root === null || type === null) {
      synth.play([])
      return
    }
    const voiced = voice({ root, type }, { octave, voiceLeading, bass, previous: previous.current })
    previous.current = voiced.chordNotes
    synth.play(voiced.notes)
  }, [synth, part, melodyMidi, root, type, octave, voiceLeading, bass])

  const counting = loop.phase === "count-in" || loop.phase === "armed" || loop.phase === "starting"
  const running = loop.duration > 0 && (loop.phase === "playing" || loop.phase === "armed" || loop.phase === "recording")
  const echoing = running && loop.count > 0

  useEffect(() => {
    if (!counting && !running) return
    let request = 0
    const tick = () => {
      const now = looper.now()
      let countdown: number | null = null
      if (counting && loop.boundary !== null) {
        const beats = beatsUntil(loop.boundary, now, loop.tempo)
        countdown = beats >= 1 && beats <= COUNT_IN_BEATS ? beats : null
      }
      let echo = ""
      let beat = -1
      if (running) {
        const position = loopPosition(now, loop.origin, loop.duration)
        beat = Math.floor((position * loop.tempo) / 60 + 1e-6)
        const degrees = new Set<number>()
        for (const track of loop.tracks) {
          if (!track || track.muted) continue
          const own = loopPosition(now, loop.origin, track.duration)
          for (const degree of echoAt(track.events, own)) degrees.add(degree)
        }
        echo = [...degrees].sort().join(",")
      }
      setClock((current) =>
        current.countdown === countdown && current.echo === echo && current.beat === beat
          ? current
          : { countdown, echo, beat }
      )
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [looper, loop, counting, running])

  useEffect(() => {
    if (videoStart === null) return
    const timer = setInterval(() => setVideoElapsed(performance.now() - videoStart), 250)
    return () => clearInterval(timer)
  }, [videoStart])

  useEffect(() => {
    trackFocusModality()
    const arrows = new Set<string>()
    let transportSpace = false
    const inside = (event: KeyboardEvent, selector: string) =>
      event.target instanceof Element && event.target.closest(selector) !== null
    const ignored = (event: KeyboardEvent) =>
      event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || inside(event, WIDGETS)
    const steer = () => setDirection(directionFromArrows([...arrows].map((code) => JOYSTICK_KEYS[code])))

    const down = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyZ" && !event.shiftKey && !inside(event, TEXT_FIELDS)) {
        event.preventDefault()
        actions.current.undo()
        return
      }
      if (ignored(event)) return
      const degree = chordDegree(event)
      if (degree !== null) {
        event.preventDefault()
        if (!event.repeat) press(`key:${event.code}`, degree)
        return
      }
      if (JOYSTICK_KEYS[event.code]) {
        event.preventDefault()
        arrows.add(event.code)
        steer()
        return
      }
      if (event.repeat) return
      if (event.code === "KeyR") {
        event.preventDefault()
        void actions.current.record()
      } else if (event.code === "Space" && (event.target === document.body || focusCameFromPointer())) {
        // A button clicked with the mouse keeps focus; Space still means play there, as in a DAW.
        event.preventDefault()
        transportSpace = true
        if (event.target instanceof HTMLElement && event.target !== document.body) event.target.blur()
        const phase = looper.getSnapshot().phase
        actions.current.setPlaying(!["starting", "playing", "armed", "recording"].includes(phase))
      } else if (PART_KEYS[event.code]) {
        event.preventDefault()
        actions.current.setPart(PART_KEYS[event.code])
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space" && transportSpace) {
        event.preventDefault()
        transportSpace = false
      }
      if (chordDegree(event) !== null) release(`key:${event.code}`)
      if (arrows.delete(event.code)) steer()
    }
    const reset = () => {
      for (const source of [...sources.current.keys()]) {
        if (source.startsWith("key:")) release(source)
      }
      if (arrows.size > 0) {
        arrows.clear()
        steer()
      }
    }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", reset)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", reset)
    }
  }, [press, release, looper])

  const countdown = counting ? clock.countdown : null
  const echo = echoing ? clock.echo.split(",").filter(Boolean).map(Number) : []
  const taking = loop.recording !== null
  const meter =
    running && clock.beat >= 0 ? meterAt((clock.beat * 60) / loop.tempo, loop.tempo, loop.bars) : null
  const shownPad = part === "drums" ? (active ?? lastPad) : null

  const keyFor = (degree: number) => {
    const pressed = part === "drums" ? held.includes(degree) : degree === active
    let label: string
    let symbol: string
    let sub: string
    if (part === "chords") {
      const shown = pressed && chord ? chord : chordAt(settings.key, settings.scale, degree)
      label = `Chord ${degree + 1}, ${shown.name}`
      symbol = shown.symbol
      sub = shown.roman
    } else if (part === "melody") {
      const shown = melodyNote(settings.key, settings.scale, degree, pressed ? direction : "center", octave)
      label = `Note ${degree + 1}, ${shown.name}`
      symbol = shown.name
      sub = shown.degreeName
    } else {
      const pad = DRUM_LABELS[DRUM_PADS[degree]]
      label = `Pad ${degree + 1}, ${pad}`
      symbol = pad
      sub = ""
    }
    return (
      <ChordKey
        key={degree}
        degree={degree}
        label={label}
        symbol={symbol}
        sub={sub}
        active={pressed}
        echo={echo.includes(degree)}
        onPress={press}
        onRelease={release}
        onTap={tap}
      />
    )
  }

  const octaveText = part !== "drums" && octave !== 0 ? ` OCT ${octave > 0 ? "+" : ""}${octave}` : ""
  const mode =
    part === "chords" ? `CHORDS · ${STYLES[settings.mode]}${octaveText}` : part === "melody" ? `MELODY${octaveText}` : "DRUMS"

  let big: string
  if (countdown !== null) big = String(countdown)
  else if (part === "chords") big = chord?.symbol ?? keyLabel(settings.key)
  else if (part === "melody") big = note?.pitch ?? keyLabel(settings.key)
  else big = shownPad !== null ? DRUM_LABELS[DRUM_PADS[shownPad]] : "Drums"

  let line: ReactNode
  let alert = false
  if (progress !== null) line = `EXPORT ${Math.round(progress * 100)}%`
  else if (videoStart !== null) {
    line = `● VIDEO ${clockText(videoElapsed)}`
    alert = true
  } else if (notice?.kind === "volume") line = <Meter value={settings.volume} />
  else if (notice?.kind === "adjust") line = loop.adjusted ? `ADJUST ON · 1/${loop.division}` : "ADJUST OFF"
  else if (notice?.kind === "track") {
    const track = loop.tracks[notice.slot]
    line = track
      ? `TRACK ${notice.slot + 1} · ${track.bars} BARS${track.muted ? " · MUTED" : ""}`
      : `TRACK ${notice.slot + 1} · EMPTY · REC HERE`
  } else if (notice?.kind === "deleted") line = `TRACK ${notice.slot + 1} DELETED · ⌘Z`
  else if (notice?.kind === "restored") line = `TRACK ${notice.slot + 1} BACK`
  else if (taking) {
    line = `${loop.phase === "armed" ? "ARMED" : "● REC"} TRACK ${(loop.recording ?? 0) + 1}`
    alert = true
  } else if (part === "chords") {
    const hint = MODIFIER_HINTS[settings.modifierSet][direction]
    line = chord ? chord.notes.join(" ") : hint ? `MOD ${hint.toUpperCase()}` : SCALES[settings.scale].label.toUpperCase()
  } else if (part === "melody") {
    const hint = MELODY_HINTS[direction]
    line = hint ? hint.toUpperCase() : `${note?.degreeName ?? "single notes"}`.toUpperCase()
  } else line = `${KITS[settings.kit].label.toUpperCase()} KIT`


  return (
    <div className={styles.frame}>
      <div className={styles.stage}>
        <div className={styles.device} data-playing={active === null ? undefined : ""}>
          <div className={styles.side}>
            <Button
              className={styles.sideButton}
              aria-label="Octave up"
              onClick={() => update({ octave: Math.min(2, settings.octave + 1) })}
            >
              <PlusIcon />
            </Button>
            <Button
              className={styles.sideButton}
              aria-label="Octave down"
              onClick={() => update({ octave: Math.max(-2, settings.octave - 1) })}
            >
              <MinusIcon />
            </Button>
          </div>

          <div className={styles.left}>
            <p className={styles.brand} aria-hidden="true">
              ui<span>·</span>chords
            </p>
            <Speaker className={styles.speaker} />
            <Joystick
              className={styles.joystick}
              aria-label="Joystick"
              value={direction}
              onValueChange={(next) => setDirection(next)}
            >
              <span className={styles.joystickDots} aria-hidden="true">
                {DIRECTIONS.filter((value) => value !== "center").map((value, index) => (
                  <i
                    key={value}
                    data-direction={value}
                    style={{ "--angle": `${index * 45}deg` } as CSSProperties}
                  />
                ))}
              </span>
              <JoystickThumb className={styles.stick} aria-label="Joystick handle" />
            </Joystick>
            <Transport
              loop={loop}
              videoSupported={videoSupported}
              videoRecording={videoStart !== null}
              onRecord={() => void record()}
              onPlay={setPlaying}
              onSelect={selectTrack}
              onDelete={deleteTrack}
              onAdjust={setAdjusted}
              onExportAudio={exportAudio}
              onStartVideo={startVideo}
              onStopVideo={() => void stopVideo()}
            />
          </div>

          <div className={styles.right}>
            <div className={styles.topRow}>
              <Lcd
                mode={mode}
                direction={direction}
                big={big}
                line={line}
                alert={alert}
                status={`${keyLabel(settings.key)} ${SCALES[settings.scale].short}`}
                tempo={settings.tempo}
                meter={meter && { ...meter, bars: loop.bars }}
              />
              <div className={`${styles.well} ${styles.fnTray}`}>
                <TonalityPanel settings={settings} update={update} />
                <SoundPanel settings={settings} update={update} />
                <RhythmPanel
                  settings={settings}
                  update={update}
                  loop={loop}
                  onTrack={(index, on) => looper.setMuted(index, !on)}
                />
              </div>
            </div>
            <div className={`${styles.well} ${styles.keys}`}>{DEGREES.map(keyFor)}</div>
          </div>


          <VolumeWheel value={settings.volume} onChange={setVolume} />

          <p role="status" aria-label="Now playing" className="sr-only">
            {chord ? chord.name : note ? note.pitch : ""}
          </p>
        </div>
      </div>
    </div>
  )
}

export { Instrument }
