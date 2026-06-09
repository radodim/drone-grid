import { useEffect, useRef, useState } from "react"

/**
 * Normalized control input produced by any input source (gamepad, keyboard, etc).
 * - pitch/roll/yaw: [-1, 1]
 * - throttle:       [0, 1] (multicopter convention: 0 = idle, 1 = full)
 */
export interface ControlAxes {
  pitch: number
  roll: number
  yaw: number
  throttle: number
}

export interface GamepadInputState {
  connected: boolean
  axesRef: React.RefObject<ControlAxes>
}

export interface GamepadInputOptions {
  /** Dead zone as a fraction of stick travel — values within this band of center are treated as 0. */
  deadzone?: number
  /** Fired once per press (rising edge), not on every polled frame while held. */
  onArm?: () => void
  onDisarm?: () => void
}

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
 * Polls the Gamepad API via requestAnimationFrame, producing a live ControlAxes
 * ref that updates every frame without re-rendering the consumer.
 *
 * Mapping (standard PS4 / Xbox layout):
 *   Left  stick X (axis 0)        -> Yaw
 *   Left  stick Y (axis 1, flip)  -> Throttle (0..1)
 *   Right stick X (axis 2)        -> Roll
 *   Right stick Y (axis 3, flip)  -> Pitch
 *   Button 0 (A / X)              -> Arm
 *   Button 1 (B / Circle)         -> Disarm
 */
export function useGamepadInput(
  options: GamepadInputOptions = {},
): GamepadInputState {
  const { deadzone = DEFAULT_DEADZONE, onArm, onDisarm } = options

  const [connected, setConnected] = useState(false)
  const axesRef = useRef<ControlAxes>({
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: 0,
  })

  // Callbacks captured in a ref so the polling loop doesn't need to be re-created on every re-render.
  const handlersRef = useRef({ onArm, onDisarm })
  handlersRef.current = { onArm, onDisarm }

  useEffect(() => {
    let rafId: number
    const prevButtonState = { arm: false, disarm: false }

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

        // Rising-edge detection: fire the callback only on the transition from not-pressed to pressed.
        const armPressed = gp.buttons[0]?.pressed ?? false
        const disarmPressed = gp.buttons[1]?.pressed ?? false
        if (armPressed && !prevButtonState.arm) handlersRef.current.onArm?.()
        if (disarmPressed && !prevButtonState.disarm)
          handlersRef.current.onDisarm?.()
        prevButtonState.arm = armPressed
        prevButtonState.disarm = disarmPressed
      } else if (connected) {
        setConnected(false)
        axesRef.current = { pitch: 0, roll: 0, yaw: 0, throttle: 0 }
      }

      rafId = requestAnimationFrame(poll)
    }

    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
  }, [deadzone, connected])

  return { connected, axesRef }
}
