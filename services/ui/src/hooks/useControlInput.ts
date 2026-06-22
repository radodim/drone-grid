import { useCallback, useEffect, useRef, useState } from "react"
import { useGamepadInput } from "@/hooks/useGamepadInput"
import { useKeyboardInput } from "@/hooks/useKeyboardInput"
import {
  type TouchGimbalControls,
  useTouchGimbalInput,
} from "@/hooks/useTouchGimbalInput"
import type { ControlAxes, InputKind, InputSourceState } from "@/types/input"

export interface ControlInputState {
  /** The single source currently driving the drone. */
  activeKind: InputKind
  /** Manual override; cleared back to auto-detect by passing null. */
  setActiveKind: (kind: InputKind | null) => void
  /** Connection state per source, for the selector UI. */
  sources: Array<{ kind: InputKind; connected: boolean }>
  /** Snapshot of the active source's axes — safe to call at any rate. */
  getAxes: () => ControlAxes
  /** Zeroes sticky throttles on every source (called on disarm). */
  resetThrottle: () => void
  /** Whether arming now would command no climb — source-aware: sticky
   * throttles (touch/keyboard) must be pulled to ~0, while a self-centering
   * gamepad stick is safe at rest (center = hover = zero climb rate). */
  throttleSafeToArm: boolean
  /** Setters the on-screen TouchGimbal pads feed. */
  touch: TouchGimbalControls
}

const STICKY_ARM_THROTTLE_MAX = 0.05
const GAMEPAD_ARM_THROTTLE_MAX = 0.55

/**
 * Coordinates the input sources behind one contract: exactly one source is
 * active at a time. Auto-detect prefers gamepad, then touch, then keyboard;
 * a manual selection wins while that source stays connected.
 *
 * `confirmedDisarmed` (drone reported disarmed by fresh telemetry) decides
 * the throttle hand-off on source switch — see the seeding effect below.
 */
export function useControlInput(confirmedDisarmed: boolean): ControlInputState {
  const [manualKind, setManualKind] = useState<InputKind | null>(null)

  const gamepad = useGamepadInput()
  const touch = useTouchGimbalInput()

  const touchCapable =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0
  const autoKind: InputKind = gamepad.connected
    ? "gamepad"
    : touchCapable
      ? "touch"
      : "keyboard"
  const connectedByKind: Record<InputKind, boolean> = {
    gamepad: gamepad.connected,
    keyboard: true,
    touch: touch.connected,
  }
  const activeKind =
    manualKind && connectedByKind[manualKind] ? manualKind : autoKind

  const keyboard = useKeyboardInput(activeKind === "keyboard")

  // Stable accessors: the send loop and arm gate read through refs so they
  // never need re-wiring when sources re-render.
  const sourcesRef = useRef<Record<InputKind, InputSourceState>>({
    gamepad,
    keyboard,
    touch,
  })
  sourcesRef.current = { gamepad, keyboard, touch }
  const activeKindRef = useRef(activeKind)
  activeKindRef.current = activeKind

  const getAxes = useCallback(
    (): ControlAxes => ({
      ...sourcesRef.current[activeKindRef.current].axesRef.current,
    }),
    [],
  )

  const resetThrottle = useCallback(() => {
    for (const source of Object.values(sourcesRef.current)) {
      source.setThrottle?.(0)
    }
  }, [])

  // Throttle hand-off on source switch: a sticky source (keyboard/touch)
  // inherits the previous source's throttle so switching mid-flight doesn't
  // command a sudden descent; when the drone is confirmed disarmed it resets
  // to 0 instead, keeping the arm gate naturally satisfied.
  const confirmedDisarmedRef = useRef(confirmedDisarmed)
  confirmedDisarmedRef.current = confirmedDisarmed
  const prevActiveKindRef = useRef(activeKind)
  useEffect(() => {
    const prevKind = prevActiveKindRef.current
    if (prevKind === activeKind) return
    prevActiveKindRef.current = activeKind

    const previous = sourcesRef.current[prevKind]
    sourcesRef.current[activeKind].setThrottle?.(
      confirmedDisarmedRef.current ? 0 : previous.axesRef.current.throttle,
    )
  }, [activeKind])

  // Low-rate throttle sample so the arm gate re-evaluates as the stick moves.
  const [throttle, setThrottle] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      const current = getAxes().throttle
      setThrottle((prev) => (Math.abs(prev - current) > 0.01 ? current : prev))
    }, 200)
    return () => window.clearInterval(id)
  }, [getAxes])

  const throttleSafeToArm =
    activeKind === "gamepad"
      ? throttle <= GAMEPAD_ARM_THROTTLE_MAX
      : throttle <= STICKY_ARM_THROTTLE_MAX

  return {
    activeKind,
    setActiveKind: setManualKind,
    sources: [
      { kind: "gamepad", connected: gamepad.connected },
      { kind: "keyboard", connected: true },
      { kind: "touch", connected: touch.connected },
    ],
    getAxes,
    resetThrottle,
    throttleSafeToArm,
    touch,
  }
}
