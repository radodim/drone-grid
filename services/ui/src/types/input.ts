/**
 * Normalized control input produced by any input source (gamepad, keyboard,
 * touch gimbals).
 * - pitch/roll/yaw: [-1, 1]
 * - throttle:       [0, 1] (multicopter convention: 0 = idle, 1 = full)
 */
export interface ControlAxes {
  pitch: number
  roll: number
  yaw: number
  throttle: number
}

export type InputKind = "gamepad" | "keyboard" | "touch"

/**
 * The contract every input source implements. Axes only — discrete actions
 * (arm/disarm) are UI controls, not input-source events. Axes live in a ref
 * updated by the source's own loop so reads never force re-renders.
 */
export interface InputSourceState {
  kind: InputKind
  connected: boolean
  axesRef: React.RefObject<ControlAxes>
  /** Sticky sources (touch/keyboard throttle) accept throttle writes here —
   * zeroed on disarm so a held throttle can't carry into the next arm, and
   * seeded from the previous source when switched to while armed. */
  setThrottle?: (value: number) => void
}

export function neutralAxes(): ControlAxes {
  return { pitch: 0, roll: 0, yaw: 0, throttle: 0 }
}
