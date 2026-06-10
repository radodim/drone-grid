import { useCallback, useEffect, useRef } from "react"

import { type InputSourceState, neutralAxes } from "@/types/input"

/** Full-scale-per-second rates turning digital keys into usable analog axes. */
const ATTITUDE_RAMP_PER_S = 3
const THROTTLE_RAMP_PER_S = 0.5

const TRACKED_CODES = new Set([
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
])

/**
 * Keyboard input source — RC-style mapping with ramping, since keys are
 * digital:
 *   W / S        -> throttle up / down (integrating: holds its value, like
 *                   a real RC throttle)
 *   A / D        -> yaw left / right (springs back to center)
 *   Arrow keys   -> pitch (Up/Down) and roll (Left/Right), spring to center
 *
 * Listeners attach only while `enabled` (the active source), so flying with
 * another source never hijacks arrow-key scrolling.
 */
export function useKeyboardInput(enabled: boolean): InputSourceState {
  const axesRef = useRef(neutralAxes())

  useEffect(() => {
    if (!enabled) {
      axesRef.current = { ...axesRef.current, pitch: 0, roll: 0, yaw: 0 }
      return
    }

    const pressed = new Set<string>()

    const onKeyDown = (e: KeyboardEvent) => {
      if (!TRACKED_CODES.has(e.code) || isTyping()) return
      pressed.add(e.code)
      e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => pressed.delete(e.code)
    const onBlur = () => pressed.clear()

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)

    let rafId: number
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now

      const axes = axesRef.current
      const attitudeStep = ATTITUDE_RAMP_PER_S * dt
      axesRef.current = {
        throttle: clamp01(
          axes.throttle +
            (held(pressed, "KeyW") - held(pressed, "KeyS")) *
              THROTTLE_RAMP_PER_S *
              dt,
        ),
        yaw: ramp(
          axes.yaw,
          held(pressed, "KeyD") - held(pressed, "KeyA"),
          attitudeStep,
        ),
        pitch: ramp(
          axes.pitch,
          held(pressed, "ArrowUp") - held(pressed, "ArrowDown"),
          attitudeStep,
        ),
        roll: ramp(
          axes.roll,
          held(pressed, "ArrowRight") - held(pressed, "ArrowLeft"),
          attitudeStep,
        ),
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
      cancelAnimationFrame(rafId)
    }
  }, [enabled])

  const resetThrottle = useCallback(() => {
    axesRef.current = { ...axesRef.current, throttle: 0 }
  }, [])

  return { kind: "keyboard", connected: true, axesRef, resetThrottle }
}

function isTyping(): boolean {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

function held(pressed: Set<string>, code: string): number {
  return pressed.has(code) ? 1 : 0
}

/** Move toward `target` (-1/0/+1) by `step`, never overshooting. */
function ramp(current: number, target: number, step: number): number {
  if (current < target) return Math.min(current + step, target)
  if (current > target) return Math.max(current - step, target)
  return current
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
