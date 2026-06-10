import { useCallback, useRef } from "react"

import { type InputSourceState, neutralAxes } from "@/types/input"

export interface TouchGimbalControls {
  /** Left pad: x = yaw [-1,1], y = throttle [0,1] (sticky). */
  setLeftPad: (yaw: number, throttle: number) => void
  /** Yaw springs to center; throttle holds its last value. */
  releaseLeftPad: () => void
  /** Right pad: x = roll [-1,1], y = pitch [-1,1]. */
  setRightPad: (roll: number, pitch: number) => void
  /** Both axes spring to center. */
  releaseRightPad: () => void
}

/**
 * Touch input source fed by the two on-screen TouchGimbal pads. Mirrors a
 * Mode-2 RC controller: the left pad's vertical axis is the sticky
 * throttle, everything else self-centers on release.
 */
export function useTouchGimbalInput(): InputSourceState & TouchGimbalControls {
  const axesRef = useRef(neutralAxes())
  // The pads are pointer-event driven, so a mouse works them too — always
  // selectable. Auto-detect still prefers touch only on touch devices.
  const connected = true

  const setLeftPad = useCallback((yaw: number, throttle: number) => {
    axesRef.current = { ...axesRef.current, yaw, throttle }
  }, [])
  const releaseLeftPad = useCallback(() => {
    axesRef.current = { ...axesRef.current, yaw: 0 }
  }, [])
  const setRightPad = useCallback((roll: number, pitch: number) => {
    axesRef.current = { ...axesRef.current, roll, pitch }
  }, [])
  const releaseRightPad = useCallback(() => {
    axesRef.current = { ...axesRef.current, roll: 0, pitch: 0 }
  }, [])
  const resetThrottle = useCallback(() => {
    axesRef.current = { ...axesRef.current, throttle: 0 }
  }, [])

  return {
    kind: "touch",
    connected,
    axesRef,
    resetThrottle,
    setLeftPad,
    releaseLeftPad,
    setRightPad,
    releaseRightPad,
  }
}
