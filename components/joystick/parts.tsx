"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { joystick } from "./joystick"

const { Root: Joystick, Thumb: JoystickThumb } = createParts(joystick, {
  root: "div",
  thumb: "button",
})

export { Joystick, JoystickThumb }
