import { describe, expect, it } from "bun:test"

import {
  clamp,
  GRAB_SLOP,
  grabOffset,
  knobPositionPct,
  valueFromKnobCenter,
} from "./TouchGimbal"

const PAD = 144
const KNOB_RADIUS = 20
const CENTER = PAD / 2
// knob radius 20px of a 144px pad ≈ 13.89% inset, gate at 86.11%
const INSET_PCT = 13.89
const GATE_PCT = 86.11

describe("clamp", () => {
  it("passes in-range values through", () => {
    expect(clamp(0.5)).toBe(0.5)
    expect(clamp(-0.25)).toBe(-0.25)
  })

  it("gates at full deflection", () => {
    expect(clamp(2)).toBe(1)
    expect(clamp(-3)).toBe(-1)
  })
})

describe("knobPositionPct", () => {
  it("centers a neutral stick", () => {
    expect(knobPositionPct(0, 0)).toEqual({ left: 50, top: 50 })
  })

  it("keeps full deflection inside the gate (knob touches, never crosses)", () => {
    const full = knobPositionPct(1, 1)
    expect(full.left).toBeCloseTo(GATE_PCT, 1)
    expect(full.top).toBeCloseTo(INSET_PCT, 1)
    const empty = knobPositionPct(-1, -1)
    expect(empty.left).toBeCloseTo(INSET_PCT, 1)
    expect(empty.top).toBeCloseTo(GATE_PCT, 1)
  })

  it("maps zero throttle (y = -1) to the bottom edge, inside the pad", () => {
    const { top } = knobPositionPct(0, -1)
    expect(top).toBeCloseTo(GATE_PCT, 1)
  })
})

describe("grabOffset", () => {
  it("grabs at the knob center with zero offset", () => {
    expect(grabOffset({ x: CENTER, y: CENTER }, { x: 0, y: 0 }, PAD)).toEqual({
      dx: 0,
      dy: 0,
    })
  })

  it("grabs just inside the slop radius, misses just outside", () => {
    const slopPx = KNOB_RADIUS * GRAB_SLOP
    expect(
      grabOffset({ x: CENTER + slopPx - 0.1, y: CENTER }, { x: 0, y: 0 }, PAD),
    ).not.toBeNull()
    expect(
      grabOffset({ x: CENTER + slopPx + 0.1, y: CENTER }, { x: 0, y: 0 }, PAD),
    ).toBeNull()
  })

  it("ignores a tap away from the knob (the teleport bug's regression)", () => {
    // Pad corners with a centered knob — the original unsafe behavior
    // commanded full deflection from exactly this input.
    expect(grabOffset({ x: PAD, y: PAD }, { x: 0, y: 0 }, PAD)).toBeNull()
    expect(grabOffset({ x: 0, y: 0 }, { x: 0, y: 0 }, PAD)).toBeNull()
  })

  it("grabs a parked sticky throttle where it's parked", () => {
    // knob held at y = 1 renders at the top gate: center (72, ~20)
    const off = grabOffset({ x: CENTER, y: 20 }, { x: 0, y: 1 }, PAD)
    expect(off).not.toBeNull()
    expect(off?.dx).toBeCloseTo(0)
    expect(off?.dy).toBeCloseTo(0)
    // a touch at the physical top edge still falls inside the slop circle
    expect(grabOffset({ x: CENTER, y: 0 }, { x: 0, y: 1 }, PAD)).not.toBeNull()
  })
})

describe("valueFromKnobCenter", () => {
  it("inverts knobPositionPct (roundtrip)", () => {
    const cases: Array<[number, number]> = [
      [0, 0],
      [1, 1],
      [-1, -1],
      [0.5, -0.25],
    ]
    for (const [x, y] of cases) {
      const pos = knobPositionPct(x, y)
      const v = valueFromKnobCenter(
        (pos.left / 100) * PAD,
        (pos.top / 100) * PAD,
        PAD,
      )
      expect(v.x).toBeCloseTo(x)
      expect(v.y).toBeCloseTo(y)
    }
  })

  it("clamps a knob dragged past the gate to full deflection", () => {
    expect(valueFromKnobCenter(200, -50, PAD)).toEqual({ x: 1, y: 1 })
    expect(valueFromKnobCenter(-50, 200, PAD)).toEqual({ x: -1, y: -1 })
  })

  it("reaches full deflection from an off-center grab", () => {
    // Grabbed 8px right of the knob center; finger at x=134 puts the knob
    // center past the gate (~124px = 86.11%) — offset must not cost travel.
    const v = valueFromKnobCenter(134 - 8, CENTER, PAD)
    expect(v.x).toBe(1)
    expect(v.y).toBeCloseTo(0)
  })
})
