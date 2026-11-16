"use client"

import { Button } from "@ui-sdk/react/button"
import { isFocusFromKeyboard } from "@ui-sdk/core"
import { useRef, type KeyboardEvent, type PointerEvent } from "react"
import styles from "./instrument.module.css"

type ChordKeyProps = {
  degree: number
  label: string
  symbol: string
  sub: string
  active: boolean
  echo: boolean
  onPress: (source: string, degree: number) => void
  onRelease: (source: string) => void
  onTap: (degree: number) => void
}


function ChordKey({ degree, label, symbol, sub, active, echo, onPress, onRelease, onTap }: ChordKeyProps) {
  const keyboardFocused = useRef(false)
  // Space presses a key reached with Tab; on a key that was just clicked, Space belongs to the loop.
  const isPressKey = (event: KeyboardEvent) =>
    event.key === "Enter" || (event.key === " " && keyboardFocused.current)
  const pointer = (event: PointerEvent) => `pointer:${event.pointerId}`
  const keyboard = `press:${degree}`

  return (
    <Button
      className={styles.key}
      data-degree={degree}
      data-active={active ? "" : undefined}
      data-echo={echo && !active ? "" : undefined}
      aria-label={label}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        onPress(pointer(event), degree)
      }}
      onPointerUp={(event) => onRelease(pointer(event))}
      onPointerCancel={(event) => onRelease(pointer(event))}
      onLostPointerCapture={(event) => onRelease(pointer(event))}
      onKeyDown={(event) => {
        if (!isPressKey(event)) return
        event.preventDefault()
        if (!event.repeat) onPress(keyboard, degree)
      }}
      onKeyUp={(event) => {
        if (!isPressKey(event)) return
        event.preventDefault()
        onRelease(keyboard)
      }}
      onFocus={() => {
        keyboardFocused.current = isFocusFromKeyboard()
      }}
      onBlur={() => onRelease(keyboard)}
      onClick={(_event, { source }) => {
        // Pointer and key presses already played; a click with no hold behind it comes from an agent or assistive tech.
        if (source !== "mouse" && source !== "touch" && source !== "pen" && source !== "keyboard") onTap(degree)
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className={styles.cap}>
        <span className={styles.keyNumber} aria-hidden="true">
          {degree + 1}
        </span>
        <span className={styles.keySymbol}>{symbol}</span>
        <span className={styles.keyRoman}>{sub}</span>
      </span>
    </Button>
  )
}

export { ChordKey }
