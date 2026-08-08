import { describe, expect, it } from "bun:test"

import { clamp, knobPositionPct } from "./TouchGimbal"

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
    // knob radius 18px of a 144px pad = 12.5% inset
    expect(knobPositionPct(1, 1)).toEqual({ left: 87.5, top: 12.5 })
    expect(knobPositionPct(-1, -1)).toEqual({ left: 12.5, top: 87.5 })
  })

  it("maps zero throttle (y = -1) to the bottom edge, inside the pad", () => {
    const { top } = knobPositionPct(0, -1)
    expect(top).toBe(87.5)
  })
})
