"use client"

import type { CSSProperties, ReactNode } from "react"
import type { Direction } from "@/lib/theory"
import styles from "./instrument.module.css"

const PAD: Direction[] = [
  "up-left",
  "up",
  "up-right",
  "left",
  "center",
  "right",
  "down-left",
  "down",
  "down-right",
]

type LcdProps = {
  mode: string
  direction: Direction
  big: string
  line: ReactNode
  alert: boolean
  status: string
  tempo: number
  meter: { bar: number; bars: number; beat: number } | null
}

const ascii = (text: string) => text.replaceAll("♯", "#").replaceAll("♭", "b").replaceAll("⇄", "/")

function Meter({ value }: { value: number }) {
  return (
    <>
      VOL
      <span className={styles.meter}>
        {Array.from({ length: 10 }, (_, index) => (
          <i key={index} data-on={value > index * 10 ? "" : undefined} />
        ))}
      </span>
    </>
  )
}

function Lcd({ mode, direction, big, line, alert, status, tempo, meter }: LcdProps) {
  const text = ascii(big)
  return (
    <div className={styles.lcd} aria-hidden="true">
      <div className={styles.lcdRow}>
        <span>{mode}</span>
        <span className={styles.pad}>
          {PAD.map((cell) => (
            <i key={cell} data-on={cell === direction ? "" : undefined} />
          ))}
        </span>
      </div>
      <span className={styles.lcdChord} style={{ "--chars": text.length } as CSSProperties}>
        {text}
      </span>
      <div className={styles.lcdLine} data-alert={alert ? "" : undefined}>
        {typeof line === "string" ? ascii(line) : line}
      </div>
      {meter ? (
        <div className={styles.lcdRow}>
          <span>
            BAR {meter.bar}/{meter.bars}
          </span>
          <span className={styles.beats}>
            {[1, 2, 3, 4].map((beat) => (
              <i
                key={beat}
                data-on={beat === meter.beat ? "" : undefined}
                data-downbeat={beat === 1 ? "" : undefined}
              />
            ))}
          </span>
        </div>
      ) : (
        <div className={styles.lcdRow}>
          <span>{ascii(status)}</span>
          <span>{tempo} BPM</span>
        </div>
      )}
    </div>
  )
}

export { Lcd, Meter }
