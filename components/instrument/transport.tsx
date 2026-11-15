"use client"

import { Button } from "@ui-sdk/react/button"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { Toggle } from "@ui-sdk/react/toggle"
import { MAX_TAKES } from "@/lib/loop"
import type { LooperState } from "@/lib/looper"
import { MagnetIcon, PlayIcon, RecordIcon, ShareIcon, StopIcon, TrashIcon } from "./icons"
import styles from "./instrument.module.css"

type TransportProps = {
  loop: LooperState
  videoSupported: boolean
  videoRecording: boolean
  onRecord: () => void
  onPlay: (playing: boolean) => void
  onSelect: (slot: number) => void
  onDelete: () => void
  onAdjust: (on: boolean) => void
  onExportAudio: () => Promise<void>
  onStartVideo: () => void
  onStopVideo: () => void
}

const SLOTS = Array.from({ length: MAX_TAKES }, (_, index) => index)

function slotState(loop: LooperState, index: number) {
  if (loop.recording === index) {
    return loop.phase === "count-in" || loop.phase === "armed" ? "armed" : "recording"
  }
  const track = loop.tracks[index]
  if (!track) return "empty"
  return track.muted ? "muted" : "on"
}

function Transport({
  loop,
  videoSupported,
  videoRecording,
  onRecord,
  onPlay,
  onSelect,
  onDelete,
  onAdjust,
  onExportAudio,
  onStartVideo,
  onStopVideo,
}: TransportProps) {
  const taking = loop.recording !== null
  const hasTracks = loop.count > 0
  const playing =
    loop.phase === "playing" || loop.phase === "starting" || (hasTracks && taking && loop.phase !== "count-in")

  return (
    <div className={styles.transport}>
      <div className={styles.trackLights}>
        <span aria-hidden="true">LOOP</span>
        <SegmentedControl
          className={styles.trackPicker}
          aria-label="Selected track"
          value={String(loop.selected)}
          onValueChange={(value) => value !== null && onSelect(Number(value))}
        >
          {SLOTS.map((index) => (
            <SegmentedControlItem
              key={index}
              value={String(index)}
              className={styles.trackLight}
              data-take={slotState(loop, index)}
            >
              <i className={styles.led} aria-hidden="true" />
              <span className={styles.trackNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span className="sr-only">Track {index + 1}</span>
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      <div className={`${styles.well} ${styles.transportKeys}`}>
        <Button
          className={styles.deckKey}
          aria-label="Delete track"
          disabled={!taking && !loop.tracks[loop.selected]}
          focusableWhenDisabled
          onClick={onDelete}
        >
          <TrashIcon />
        </Button>
        <Toggle
          className={`${styles.deckKey} ${styles.recordKey}`}
          aria-label="Record"
          aria-keyshortcuts="R"
          data-phase={loop.phase}
          pressed={taking}
          onPressedChange={onRecord}
        >
          <RecordIcon />
        </Toggle>
        <Toggle
          className={`${styles.deckKey} ${styles.playKey}`}
          aria-label="Play loop"
          aria-keyshortcuts="Space"
          data-phase={loop.phase}
          pressed={playing}
          disabled={!hasTracks}
          focusableWhenDisabled
          onPressedChange={onPlay}
        >
          <PlayIcon playing={playing} />
        </Toggle>
        <Toggle
          className={`${styles.deckKey} ${styles.adjustKey}`}
          aria-label="Adjust timing"
          pressed={loop.adjusted}
          onPressedChange={onAdjust}
        >
          <MagnetIcon />
        </Toggle>
        {videoRecording ? (
          <Button className={`${styles.deckKey} ${styles.stopVideo}`} aria-label="Stop video" onClick={onStopVideo}>
            <StopIcon />
          </Button>
        ) : (
          <Menu onAction={(value) => (value === "audio" ? onExportAudio() : onStartVideo())}>
            <MenuTrigger className={styles.deckKey} aria-label="Export">
              <ShareIcon />
            </MenuTrigger>
            <MenuContent className={styles.menu} side="top" align="start" sideOffset={10}>
              <MenuItem value="audio" disabled={!hasTracks || taking}>
                Download MP3
              </MenuItem>
              <MenuItem value="video" disabled={!videoSupported}>
                Record video
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
    </div>
  )
}

export { Transport }
