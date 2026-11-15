import { bindDrag, createChange, css, definePrimitive, type ChangeDetails } from "@ui-sdk/core"
import { DIRECTION_LABELS, DIRECTIONS, type Direction } from "@/lib/theory"

type JoystickReason = "drag" | "step-key" | "release" | "imperative"

type JoystickOptions = {
  value?: Direction
  defaultValue?: Direction
  onValueChange?: (value: Direction, details: ChangeDetails<JoystickReason>) => void
}

const VECTORS: Record<Direction, [number, number]> = {
  center: [0, 0],
  up: [0, -1],
  "up-right": [Math.SQRT1_2, -Math.SQRT1_2],
  right: [1, 0],
  "down-right": [Math.SQRT1_2, Math.SQRT1_2],
  down: [0, 1],
  "down-left": [-Math.SQRT1_2, Math.SQRT1_2],
  left: [-1, 0],
  "up-left": [-Math.SQRT1_2, -Math.SQRT1_2],
}

const SECTORS: Direction[] = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]
const DEAD_ZONE = 0.35
const REACH = 0.3
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]

const rubberband = (overshoot: number, limit = 0.35) => (overshoot * limit * 0.55) / (limit + 0.55 * overshoot)

function directionAt(x: number, y: number): Direction {
  if (Math.hypot(x, y) < DEAD_ZONE) return "center"
  const angle = (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)
  return SECTORS[Math.round(angle / (Math.PI / 4)) % 8]
}

function directionFromArrows(held: Iterable<string>): Direction {
  let x = 0
  let y = 0
  for (const key of held) {
    if (key === "ArrowUp") y -= 1
    if (key === "ArrowDown") y += 1
    if (key === "ArrowLeft") x -= 1
    if (key === "ArrowRight") x += 1
  }
  return directionAt(x, y)
}

const joystick = definePrimitive({
  name: "joystick",
  options: { value: "string", defaultValue: "string", onValueChange: "callback" },
  controlled: ["value"],
  state: (options: JoystickOptions) => ({
    value: options.value ?? options.defaultValue ?? ("center" as Direction),
    dragging: false,
    x: 0,
    y: 0,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context)
    const arrows = new Set<string>()
    let stopDrag: (() => void) | undefined
    context.onDestroy(() => stopDrag?.())

    const push = (value: Direction, reason: JoystickReason, event?: Event) =>
      change("value", value, { reason, event })

    return {
      setValue: (value: Direction) => push(DIRECTIONS.includes(value) ? value : "center", "imperative"),
      pointerdown(event: PointerEvent, el: HTMLElement) {
        if (event.button !== 0) return
        event.preventDefault()
        stopDrag?.()
        const reach = el.getBoundingClientRect().width * REACH || 1
        const startX = event.clientX
        const startY = event.clientY
        const moveTo = (clientX: number, clientY: number, moveEvent: PointerEvent) => {
          const x = (clientX - startX) / reach
          const y = (clientY - startY) / reach
          const length = Math.hypot(x, y)
          const travel = length > 1 ? (1 + rubberband(length - 1)) / length : 1
          context.store.set({ x: x * travel, y: y * travel })
          push(directionAt(x, y), "drag", moveEvent)
        }
        context.store.set({ dragging: true, x: 0, y: 0 })
        stopDrag = bindDrag(el, event, {
          onMove: ({ x, y, event: moveEvent }) => moveTo(x, y, moveEvent),
          onEnd: (endEvent) => {
            stopDrag = undefined
            context.store.set({ dragging: false, x: 0, y: 0 })
            push("center", "release", endEvent)
          },
        })
      },
      keydown(event: KeyboardEvent) {
        if (!ARROWS.includes(event.key)) return
        event.preventDefault()
        if (event.repeat) return
        arrows.add(event.key)
        push(directionFromArrows(arrows), "step-key", event)
      },
      keyup(event: KeyboardEvent) {
        if (!arrows.delete(event.key)) return
        event.preventDefault()
        push(directionFromArrows(arrows), "release", event)
      },
      blur(event: FocusEvent) {
        if (arrows.size === 0) return
        arrows.clear()
        push("center", "release", event)
      },
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => {
        const [x, y] = state.dragging ? [state.x, state.y] : VECTORS[state.value]
        return {
          "data-direction": state.value,
          "data-dragging": state.dragging ? "" : undefined,
          style: css({ "--joystick-x": x.toFixed(3), "--joystick-y": y.toFixed(3) }),
        }
      },
      on: {
        pointerdown: (event, { el, api }) => {
          if (el) api.pointerdown(event as PointerEvent, el)
        },
      },
    }),
    thumb: slot({
      role: "button",
      focus: "native",
      attrs: (state) => ({
        type: "button",
        "aria-keyshortcuts": "ArrowUp ArrowDown ArrowLeft ArrowRight",
        "data-direction": state.value,
      }),
      press: ({ api }) => api.setValue("center"),
      on: {
        keydown: (event, { api }) => api.keydown(event as KeyboardEvent),
        keyup: (event, { api }) => api.keyup(event as KeyboardEvent),
        blur: (event, { api }) => api.blur(event as FocusEvent),
      },
    }),
  }),
  agent: {
    actions: ["setValue"],
    closed: true,
    items: () => DIRECTIONS.map((value) => ({ value, label: DIRECTION_LABELS[value] })),
  },
})

export { directionAt, directionFromArrows, joystick, type JoystickOptions, type JoystickReason }
