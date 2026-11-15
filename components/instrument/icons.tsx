const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="7.5" cy="12" r="3.5" />
      <path d="M11 12h10M17.5 12v3.5M20.5 12v2.5" />
    </svg>
  )
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4 15.5c2.2 0 2.6-7 5.3-7s2.6 7 5.4 7 2.7-7 5.3-7" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={3.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={3.2}>
      <path d="M5 12h14" />
    </svg>
  )
}

function RecordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" fill="currentColor" />
    </svg>
  )
}

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      {playing ? <rect x="6.5" y="6.5" width="11" height="11" rx="1.6" /> : <path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.2-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6Z" />}
    </svg>
  )
}

function MagnetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M6 4.5v7a6 6 0 0 0 12 0v-7" />
      <path d="M6 8.5h3.2M14.8 8.5H18M9.2 4.5v7a2.8 2.8 0 0 0 5.6 0v-7" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M4.5 6.8h15M9.5 6.8V4.9h5v1.9" />
      <path d="M6.6 6.8l.9 12.1a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12.1M10.2 10.6v6M13.8 10.6v6" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M8.5 6.5 4.5 10.5l4 4" />
      <path d="M4.8 10.5h9.7a5 5 0 0 1 0 10H11" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 3.8v11.4M7.8 8 12 3.8 16.2 8" />
      <path d="M8.2 11H6.6a1.8 1.8 0 0 0-1.8 1.8v5.6a1.8 1.8 0 0 0 1.8 1.8h10.8a1.8 1.8 0 0 0 1.8-1.8v-5.6a1.8 1.8 0 0 0-1.8-1.8h-1.6" />
    </svg>
  )
}

export { ClockIcon, KeyIcon, MagnetIcon, MinusIcon, PlayIcon, PlusIcon, RecordIcon, ShareIcon, StopIcon, TrashIcon, UndoIcon, WaveIcon }
