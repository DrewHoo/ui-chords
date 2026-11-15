"use client"

import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover"
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select"
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
  SliderValue,
} from "@ui-sdk/react/slider"
import { Switch, SwitchThumb } from "@ui-sdk/react/switch"
import { Toggle } from "@ui-sdk/react/toggle"
import type { ReactNode } from "react"
import { KITS, type KitId } from "@/lib/drums"
import { LOOP_BARS, MAX_TAKES, type LoopBars } from "@/lib/loop"
import type { Division, LooperState } from "@/lib/looper"
import { ENVELOPES, INSTRUMENTS, type EnvelopeId, type InstrumentId } from "@/lib/synth"
import { SCALE_IDS, SCALES, keyLabel, type ScaleId } from "@/lib/theory"
import { ClockIcon, KeyIcon, WaveIcon } from "./icons"
import { PARTS, type Part, type Settings, type UpdateSettings } from "./settings"
import styles from "./instrument.module.css"

type Option = { value: string; label: string }
type PanelProps = { settings: Settings; update: UpdateSettings; locked?: boolean }

const KEY_ITEMS: Option[] = Array.from({ length: 12 }, (_, key) => ({
  value: String(key),
  label: keyLabel(key),
}))
const SCALE_ITEMS: Option[] = SCALE_IDS.map((id) => ({ value: id, label: SCALES[id].label }))
const INSTRUMENT_ITEMS: Option[] = Object.entries(INSTRUMENTS).map(([value, { label }]) => ({
  value,
  label,
}))
const ENVELOPE_ITEMS: Option[] = Object.entries(ENVELOPES).map(([value, { label }]) => ({
  value,
  label,
}))
const KIT_ITEMS: Option[] = Object.entries(KITS).map(([value, { label }]) => ({ value, label }))
const BAR_ITEMS = LOOP_BARS.map((bars) => ({ value: String(bars), label: `${bars} bars` }))

function Panel({
  label,
  color,
  icon,
  children,
}: {
  label: string
  color: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger className={`${styles.key} ${styles.fnKey}`} data-color={color} aria-label={label}>
        {icon}
      </PopoverTrigger>
      <PopoverContent className={styles.panel} side="bottom" align="end" sideOffset={14} collisionPadding={12}>
        <PopoverTitle className={styles.panelTitle}>{label}</PopoverTitle>
        {children}
      </PopoverContent>
    </Popover>
  )
}

function SelectField({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: Option[]
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => next !== null && onChange(next)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function SegmentedField<T extends string>({
  label,
  value,
  items,
  disabled,
  onChange,
}: {
  label: string
  value: T
  items: { value: T; label: string }[]
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SegmentedControl
        className={styles.segmented}
        value={value}
        disabled={disabled}
        onValueChange={(next) => next !== null && onChange(next as T)}
      >
        <SegmentedControlIndicator />
        {items.map((item) => (
          <SegmentedControlItem key={item.value} value={item.value}>
            {item.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  description,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  description?: string
  onChange: (value: number) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      >
        <SliderValue />
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb />
          </SliderTrack>
        </SliderControl>
      </Slider>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field className={styles.switchField}>
      <FieldLabel>{label}</FieldLabel>
      <Switch checked={checked} onCheckedChange={onChange}>
        <SwitchThumb />
      </Switch>
    </Field>
  )
}

function TonalityPanel({ settings, update }: PanelProps) {
  return (
    <Panel label="Tonality" color="gray" icon={<KeyIcon />}>
      <div className={styles.fieldRow}>
        <SelectField
          label="Key"
          value={String(settings.key)}
          items={KEY_ITEMS}
          onChange={(key) => update({ key: Number(key) })}
        />
        <SelectField
          label="Scale"
          value={settings.scale}
          items={SCALE_ITEMS}
          onChange={(scale) => update({ scale: scale as ScaleId })}
        />
      </div>
      <SegmentedField
        label="Modifier set"
        value={settings.modifierSet}
        items={[
          { value: "standard", label: "Standard" },
          { value: "extended", label: "Extended" },
        ]}
        onChange={(modifierSet) => update({ modifierSet })}
      />
      <SegmentedField
        label="Bass"
        value={settings.bass}
        items={[
          { value: "off", label: "Off" },
          { value: "root", label: "Root note" },
        ]}
        onChange={(bass) => update({ bass })}
      />
      <SwitchField
        label="Voice leading"
        checked={settings.voiceLeading}
        onChange={(voiceLeading) => update({ voiceLeading })}
      />
    </Panel>
  )
}

function SoundPanel({ settings, update }: PanelProps) {
  const { part } = settings
  const lead = part === "melody"
  return (
    <Panel label="Sound" color="yellow" icon={<WaveIcon />}>
      <SegmentedField
        label="Mode"
        value={part}
        items={PARTS}
        onChange={(next: Part) => update({ part: next })}
      />
      {part === "drums" ? (
        <SelectField
          label="Kit"
          value={settings.kit}
          items={KIT_ITEMS}
          onChange={(kit) => update({ kit: kit as KitId })}
        />
      ) : (
        <div className={styles.fieldRow}>
          <SelectField
            label="Instrument"
            value={lead ? settings.leadInstrument : settings.instrument}
            items={INSTRUMENT_ITEMS}
            onChange={(value) => {
              const instrument = value as InstrumentId
              const envelope = INSTRUMENTS[instrument].envelope
              update(lead ? { leadInstrument: instrument, leadEnvelope: envelope } : { instrument, envelope })
            }}
          />
          <SelectField
            label="Envelope"
            value={lead ? settings.leadEnvelope : settings.envelope}
            items={ENVELOPE_ITEMS}
            onChange={(value) =>
              update(lead ? { leadEnvelope: value as EnvelopeId } : { envelope: value as EnvelopeId })
            }
          />
        </div>
      )}
      {part === "chords" && (
        <SegmentedField
          label="Chord style"
          value={settings.mode}
          items={[
            { value: "play", label: "Hold" },
            { value: "strum", label: "Strum" },
            { value: "arp", label: "Arpeggiate" },
          ]}
          onChange={(mode) => update({ mode })}
        />
      )}
      {part === "chords" && settings.mode === "arp" && (
        <SegmentedField
          label="Arpeggio"
          value={settings.arpPattern}
          items={[
            { value: "up", label: "Up" },
            { value: "down", label: "Down" },
            { value: "up-down", label: "Up & down" },
            { value: "random", label: "Random" },
          ]}
          onChange={(arpPattern) => update({ arpPattern })}
        />
      )}
      {part === "chords" && settings.mode === "strum" && (
        <SegmentedField
          label="Strum speed"
          value={settings.strumSpeed}
          items={[
            { value: "slow", label: "Slow" },
            { value: "medium", label: "Medium" },
            { value: "fast", label: "Fast" },
          ]}
          onChange={(strumSpeed) => update({ strumSpeed })}
        />
      )}
      <SliderField label="Filter" value={settings.filter} min={0} max={100} onChange={(filter) => update({ filter })} />
      <SegmentedField
        label="Reverb"
        value={settings.reverb}
        items={[
          { value: "off", label: "Off" },
          { value: "room", label: "Room" },
          { value: "hall", label: "Hall" },
        ]}
        onChange={(reverb) => update({ reverb })}
      />
      <SegmentedField
        label="Delay"
        value={settings.delay}
        items={[
          { value: "off", label: "Off" },
          { value: "eighth", label: "1/8" },
          { value: "quarter", label: "1/4" },
        ]}
        onChange={(delay) => update({ delay })}
      />
      <SwitchField label="Chorus" checked={settings.chorus} onChange={(chorus) => update({ chorus })} />
    </Panel>
  )
}

const SLOTS = Array.from({ length: MAX_TAKES }, (_, index) => index)

function RhythmPanel({
  settings,
  update,
  loop,
  onTrack,
}: PanelProps & { loop: LooperState; onTrack: (index: number, on: boolean) => void }) {
  const locked = loop.count > 0 || loop.recording !== null
  const lockedNote = locked ? "Locked while the loop has takes. Undo them to change it." : undefined
  return (
    <Panel label="Rhythm" color="red" icon={<ClockIcon />}>
      <SliderField
        label="Tempo"
        value={settings.tempo}
        min={40}
        max={240}
        disabled={locked}
        description={lockedNote}
        onChange={(tempo) => update({ tempo })}
      />
      <Field>
        <FieldLabel>Loop length</FieldLabel>
        <SegmentedControl
          className={styles.segmented}
          value={String(settings.bars)}
          onValueChange={(bars) => bars !== null && update({ bars: Number(bars) as LoopBars })}
        >
          <SegmentedControlIndicator />
          {BAR_ITEMS.map((item) => (
            <SegmentedControlItem key={item.value} value={item.value}>
              {item.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        {loop.count > 0 && <FieldDescription>Each take keeps its own length. This sets the next one.</FieldDescription>}
      </Field>
      <SwitchField label="Metronome" checked={settings.metronome} onChange={(metronome) => update({ metronome })} />
      <SegmentedField
        label="Adjust to"
        value={String(settings.snap)}
        items={[
          { value: "4", label: "1/4" },
          { value: "8", label: "1/8" },
          { value: "16", label: "1/16" },
        ]}
        onChange={(snap) => update({ snap: Number(snap) as Division })}
      />
      <div className={styles.trackField}>
        <span className={styles.trackFieldLabel}>Tracks</span>
        <div className={styles.trackToggles}>
          {SLOTS.map((index) => {
            const track = loop.tracks[index]
            return (
              <Toggle
                key={index}
                className={styles.trackToggle}
                aria-label={`Track ${index + 1}`}
                data-take={track ? (track.muted ? "muted" : "on") : "empty"}
                pressed={!!track && !track.muted}
                disabled={!track}
                focusableWhenDisabled
                onPressedChange={(on) => onTrack(index, on)}
              >
                <i className={styles.led} aria-hidden="true" />
                {index + 1}
              </Toggle>
            )
          })}
        </div>
        <p className={styles.trackHint}>
          {loop.count === 0 ? "Press record to lay down your first take." : "Tap a track to mute it."}
        </p>
      </div>
    </Panel>
  )
}

export { RhythmPanel, SoundPanel, TonalityPanel }
