import { describe, expect, test } from "vitest"
import { chordAt, melodyNote, triadQuality, voice } from "./theory"

const C = 0
const symbols = (key: number, scale: Parameters<typeof chordAt>[1]) =>
  Array.from({ length: 7 }, (_, degree) => chordAt(key, scale, degree).symbol)

describe("diatonic chords", () => {
  test("the seven keys of C major", () => {
    expect(symbols(C, "major")).toEqual(["C", "Dm", "Em", "F", "G", "Am", "Bdim"])
    expect(Array.from({ length: 7 }, (_, degree) => chordAt(C, "major", degree).roman)).toEqual([
      "I",
      "ii",
      "iii",
      "IV",
      "V",
      "vi",
      "vii°",
    ])
  })

  test("other scales stack thirds from their own steps", () => {
    expect(symbols(9, "minor")).toEqual(["Am", "Bdim", "C", "Dm", "Em", "F", "G"])
    expect(symbols(9, "harmonic-minor")).toEqual(["Am", "Bdim", "Caug", "Dm", "E", "F", "G♯dim"])
    expect(symbols(2, "dorian")).toEqual(["Dm", "Em", "F", "G", "Am", "Bdim", "C"])
    expect(triadQuality("lydian", 1)).toBe("maj")
  })

  test("spells flats in flat keys and sharps in sharp keys", () => {
    expect(symbols(5, "major")).toEqual(["F", "Gm", "Am", "B♭", "C", "Dm", "Edim"])
    expect(symbols(2, "major")).toEqual(["D", "Em", "F♯m", "G", "A", "Bm", "C♯dim"])
    expect(chordAt(3, "major", 0).notes).toEqual(["E♭", "G", "B♭"])
  })
})

describe("joystick modifiers", () => {
  const at = (degree: number, direction: Parameters<typeof chordAt>[3], set?: Parameters<typeof chordAt>[4]) =>
    chordAt(C, "major", degree, direction, set).symbol

  test("standard set", () => {
    expect(at(0, "up")).toBe("Cm")
    expect(at(1, "up")).toBe("D")
    expect(at(0, "up-right")).toBe("C7")
    expect(at(0, "right")).toBe("Cmaj7")
    expect(at(5, "right")).toBe("Am7")
    expect(at(6, "right")).toBe("Bm7♭5")
    expect(at(0, "down-right")).toBe("Cmaj9")
    expect(at(1, "down-right")).toBe("Dm9")
    expect(at(0, "down")).toBe("Csus4")
    expect(at(0, "down-left")).toBe("C6")
    expect(at(1, "down-left")).toBe("Dsus2")
    expect(at(0, "left")).toBe("Cdim")
    expect(at(6, "left")).toBe("Bm")
    expect(at(0, "up-left")).toBe("Caug")
  })

  test("extended set", () => {
    expect(at(4, "down", "extended")).toBe("G7♯9")
    expect(at(4, "left", "extended")).toBe("G7sus4")
    expect(at(0, "right", "extended")).toBe("Cadd11")
    expect(at(1, "down-left", "extended")).toBe("Dm(add9)")
    expect(at(4, "up-right", "extended")).toBe("G9")
    expect(chordAt(C, "major", 1, "down-right", "extended").notes).toEqual(["D", "F", "A", "C", "E", "G"])
  })
})

describe("voicing", () => {
  test("root position without voice leading", () => {
    expect(voice({ root: 0, type: "maj" }, { voiceLeading: false }).notes).toEqual([60, 64, 67])
    expect(voice({ root: 7, type: "maj" }, { voiceLeading: false }).notes).toEqual([55, 59, 62])
  })

  test("voice leading moves each note as little as it can", () => {
    const c = voice({ root: 0, type: "maj" }).chordNotes
    expect(voice({ root: 5, type: "maj" }, { previous: c }).notes).toEqual([60, 65, 69])
    expect(voice({ root: 7, type: "maj" }, { previous: c }).notes).toEqual([59, 62, 67])
  })

  test("octave shifts and a root bass two octaves down", () => {
    expect(voice({ root: 0, type: "maj" }, { voiceLeading: false, octave: 1 }).notes).toEqual([72, 76, 79])
    expect(voice({ root: 9, type: "min" }, { voiceLeading: false, bass: "root" }).notes).toEqual([
      45, 57, 60, 64,
    ])
  })
})

describe("melody notes", () => {
  test("keys play the scale an octave above the chords", () => {
    expect(Array.from({ length: 7 }, (_, degree) => melodyNote(0, "major", degree).pitch)).toEqual([
      "C5",
      "D5",
      "E5",
      "F5",
      "G5",
      "A5",
      "B5",
    ])
    expect(melodyNote(9, "minor", 2).pitch).toBe("C5")
    expect(melodyNote(5, "major", 3).name).toBe("B♭")
  })

  test("the joystick bends octaves and semitones, and the side buttons shift octaves", () => {
    expect(melodyNote(0, "major", 0, "up").pitch).toBe("C6")
    expect(melodyNote(0, "major", 0, "down").pitch).toBe("C4")
    expect(melodyNote(0, "major", 2, "left").pitch).toBe("D♯5")
    expect(melodyNote(0, "major", 3, "right").midi).toBe(78)
    expect(melodyNote(0, "major", 0, "center", -1).pitch).toBe("C4")
    expect(melodyNote(0, "major", 4).degreeName).toBe("5th")
  })
})
