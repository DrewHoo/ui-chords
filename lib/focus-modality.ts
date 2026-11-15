let fromPointer = false
let installed = false

// :focus-visible flips to true on any key press in Chromium, so it can't tell a clicked key from a tabbed one.
function trackFocusModality() {
  if (installed || typeof window === "undefined") return
  installed = true
  window.addEventListener("pointerdown", () => (fromPointer = true), true)
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab") fromPointer = false
    },
    true
  )
}

function focusCameFromPointer() {
  trackFocusModality()
  return fromPointer
}

export { focusCameFromPointer, trackFocusModality }
