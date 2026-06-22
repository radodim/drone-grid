import { useEffect, useRef, useState } from "react"

import { type InputSourceState, neutralAxes } from "@/types/input"

const DEFAULT_DEADZONE = 0.1

/** Clamp tiny stick values near zero to exactly 0, then scale the rest so the full [-1, 1] range is still reachable. */
function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) return 0
  const sign = value > 0 ? 1 : -1
  return sign * ((Math.abs(value) - deadzone) / (1 - deadzone))
}

/** Left stick Y on a standard gamepad is -1 at top / +1 at bottom. Flip and rescale to multicopter throttle [0, 1]. */
function axisToThrottle(rawY: number, deadzone: number): number {
  const flipped = -rawY
  const centered = applyDeadzone(flipped, deadzone)
  return (centered + 1) / 2
}

/**
 * Polls the Gamepad API via requestAnimationFrame, producing a live
 * ControlAxes ref that updates every frame without re-rendering the
 * consumer. Axes only — arm/disarm live in the UI, not on buttons.
 *
 * Mapping (standard PS4 / Xbox layout):
 *   Left  stick X (axis 0)        -> Yaw
 *   Left  stick Y (axis 1, flip)  -> Throttle (0..1)
 *   Right stick X (axis 2)        -> Roll
 *   Right stick Y (axis 3, flip)  -> Pitch
 */
export function useGamepadInput(deadzone = DEFAULT_DEADZONE): InputSourceState {
  const [connected, setConnected] = useState(false)
  const axesRef = useRef(neutralAxes())

  useEffect(() => {
    let rafId: number

    const poll = () => {
      const pads = navigator.getGamepads()
      const gp = pads.find((p) => p !== null) ?? null

      if (gp) {
        if (!connected) setConnected(true)

        axesRef.current = {
          yaw: applyDeadzone(gp.axes[0] ?? 0, deadzone),
          throttle: axisToThrottle(gp.axes[1] ?? 0, deadzone),
          roll: applyDeadzone(gp.axes[2] ?? 0, deadzone),
          pitch: applyDeadzone(-(gp.axes[3] ?? 0), deadzone),
        }
      } else if (connected) {
        setConnected(false)
        axesRef.current = neutralAxes()
      }

      rafId = requestAnimationFrame(poll)
    }

    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [deadzone, connected])

  return { kind: "gamepad", connected, axesRef }
}
