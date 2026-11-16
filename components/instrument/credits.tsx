"use client"

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible"
import { useShortcutHint } from "@ui-sdk/react/shortcuts"
import { useEffect, useState, type ReactNode } from "react"
import styles from "./instrument.module.css"

const AUTO_CLOSE = 10_000

function Keys({ children }: { children: string[] }) {
  return (
    <span className={styles.keycaps}>
      {children.map((key) =>
        key === "–" ? (
          <span key={key} aria-hidden="true">
            –
          </span>
        ) : (
          <kbd key={key}>{key}</kbd>
        )
      )}
    </span>
  )
}

const HELD: { keys: ReactNode; label: string }[] = [
  { keys: <Keys>{["1", "–", "7"]}</Keys>, label: "Play" },
  { keys: <Keys>{["←", "↑", "→", "↓"]}</Keys>, label: "Color the chord" },
  { keys: <Keys>{["Z", "X", "C"]}</Keys>, label: "Chords, melody, drums" },
  { keys: <Keys>{["R"]}</Keys>, label: "Record the selected loop" },
  { keys: <Keys>{["Space"]}</Keys>, label: "Play the loop" },
]

const TOUCH = [
  "Hold a key to play",
  "Drag the joystick to color the chord",
  "Pick a loop light, then ● to record",
]

function Credits() {
  const undo = useShortcutHint("mod+z")
  const keyboard = [...HELD, { keys: <Keys>{[undo.text]}</Keys>, label: "Undo" }]
  const [open, setOpen] = useState(true)
  const [reading, setReading] = useState(false)

  useEffect(() => {
    if (!open || reading) return
    const timer = setTimeout(() => setOpen(false), AUTO_CLOSE)
    return () => clearTimeout(timer)
  }, [open, reading])

  return (
    <Collapsible
      className={styles.footer}
      open={open}
      onOpenChange={setOpen}
      onPointerEnter={() => setReading(true)}
      onPointerLeave={() => setReading(false)}
    >
      <p className={styles.credit}>
        Inspired by{" "}
        <a href="https://hichord.shop/" target="_blank" rel="noopener">
          HiChord
        </a>
        <span aria-hidden="true"> · </span>
        Made with{" "}
        <a href="https://ui-sdk.dev/" target="_blank" rel="noopener">
          ui-sdk
        </a>{" "}
        by{" "}
        <a href="https://x.com/nays1_" target="_blank" rel="noopener">
          nays
        </a>
        <span aria-hidden="true"> · </span>
        <CollapsibleTrigger className={styles.howTo}>How to use</CollapsibleTrigger>
      </p>
      <CollapsiblePanel className={styles.howToPanel}>
        <ul className={`${styles.howToList} ${styles.keyboardHelp}`}>
          {keyboard.map((item) => (
            <li key={item.label}>
              {item.keys}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <ul className={`${styles.howToList} ${styles.touchHelp}`}>
          {TOUCH.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  )
}

export { Credits }
