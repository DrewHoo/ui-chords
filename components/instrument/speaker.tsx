const PITCH = 6.4
const ROW = PITCH * 0.866
const HOLE = 1.8
const RADIUS = 49

const HOLES = Array.from({ length: 19 }, (_, row) => row - 9).flatMap((row) =>
  Array.from({ length: 17 }, (_, column) => column - 8)
    .map((column) => ({ x: 50 + (column + (row % 2 === 0 ? 0 : 0.5)) * PITCH, y: 50 + row * ROW }))
    .filter(({ x, y }) => Math.hypot(x - 50, y - 50) + HOLE <= RADIUS)
)

function Speaker({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="speaker-hole" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#141415" />
          <stop offset="75%" stopColor="#262628" />
          <stop offset="100%" stopColor="#4a4a4c" />
        </radialGradient>
      </defs>
      {HOLES.map(({ x, y }) => (
        <circle key={`${x}:${y}`} cx={x} cy={y} r={HOLE} fill="url(#speaker-hole)" />
      ))}
    </svg>
  )
}

export { Speaker }
