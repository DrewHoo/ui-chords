"use client"

import { bindDrag } from "@ui-sdk/core"
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider"
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import styles from "./instrument.module.css"

const PIXELS_PER_STEP = 2

const rubberband = (overshoot: number, limit = 24) =>
  (overshoot * limit * 0.55) / (limit + 0.55 * Math.abs(overshoot))

function VolumeWheel({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [overshoot, setOvershoot] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const stop = useRef<(() => void) | null>(null)

  useEffect(() => () => stop.current?.(), [])

  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    // A wheel turns from where it's grabbed; the slider's own press would jump to the pointer.
    event.preventDefault()
    stop.current?.()
    const start = value
    const startX = event.clientX
    setScrubbing(true)
    stop.current = bindDrag(event.currentTarget, event.nativeEvent, {
      onMove: ({ x }) => {
        const raw = start + (x - startX) / PIXELS_PER_STEP
        const next = Math.min(100, Math.max(0, Math.round(raw)))
        onChange(next)
        setOvershoot(rubberband((raw - next) * PIXELS_PER_STEP))
      },
      onEnd: () => {
        stop.current = null
        setScrubbing(false)
        setOvershoot(0)
      },
    })
  }

  return (
    <Slider
      className={styles.wheel}
      min={0}
      max={100}
      value={value}
      onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
    >
      <SliderControl
        className={styles.wheelControl}
        data-scrubbing={scrubbing ? "" : undefined}
        style={{ "--wheel-offset": `${value * PIXELS_PER_STEP + overshoot}px` } as CSSProperties}
        onPointerDown={scrub}
      >
        <SliderTrack className={styles.wheelTrack}>
          <SliderThumb className={styles.wheelThumb} aria-label="Volume" />
        </SliderTrack>
      </SliderControl>
    </Slider>
  )
}

export { VolumeWheel }
