import { useEffect, useState } from "react"

import { HoldButton } from "@/components/Drones/HoldButton"
import { InputSourceSelector } from "@/components/Drones/InputSourceSelector"
import { TouchGimbal } from "@/components/Drones/TouchGimbal"
import type { ControlInputState } from "@/hooks/useControlInput"
import {
  type ControlSocketState,
  controlMessages,
} from "@/hooks/useControlSocket"
import type { DroneState } from "@/hooks/useDroneState"
import { type ControlAxes, neutralAxes } from "@/types/input"

const SEND_INTERVAL_MS = 20 // 50Hz

interface DroneControlsProps {
  droneState: DroneState
  controlInput: ControlInputState
  /** Owned by the route so the HUD can render the same socket's health. */
  control: ControlSocketState
}

/**
 * Control layer over the drone stream: hold-to-arm/disarm, the input-source
 * selector, and — when touch is the active source — the two RC-style gimbal
 * pads. Streams the active source's axes to the backend at 50Hz whenever
 * the control link is open: like a real RC transmitter, the stick stream is
 * a continuous carrier — the flight controller owns loss failsafes. Only
 * discrete commands are state-gated. (Link health renders in the HUD's
 * CTRL chip, fed by the same socket via the route.)
 */
export function DroneControls({
  droneState,
  controlInput,
  control,
}: DroneControlsProps) {
  const { status, send } = control

  const { getAxes, resetThrottle } = controlInput
  useEffect(() => {
    if (status !== "open") return

    const intervalId = setInterval(() => {
      const { pitch, roll, throttle, yaw } = getAxes()
      send(controlMessages.control(pitch, roll, throttle, yaw))
    }, SEND_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [status, send, getAxes])

  return (
    // Width-gated: below @2xl the container can't fit pads + cluster side
    // by side, so controls stack in normal flow under the video; at @2xl+
    // they overlay it (the classic FPV arrangement).
    <div className="pointer-events-none flex flex-col gap-2 px-3 pt-2 pb-3 @2xl:absolute @2xl:inset-0 @2xl:p-0">
      <div className="flex items-center justify-center gap-4 @2xl:absolute @2xl:bottom-4 @2xl:left-1/2 @2xl:-translate-x-1/2">
        <HoldButton
          label="ARM"
          holdMs={2000}
          variant="arm"
          disabled={!droneState.canArm.enabled}
          disabledReason={droneState.canArm.reason}
          onComplete={() => send(controlMessages.arm())}
        />
        <InputSourceSelector
          sources={controlInput.sources}
          activeKind={controlInput.activeKind}
          onSelect={controlInput.setActiveKind}
        />
        <HoldButton
          label="DISARM"
          holdMs={1000}
          variant="disarm"
          disabled={!droneState.canDisarm.enabled}
          disabledReason={droneState.canDisarm.reason}
          onComplete={() => {
            send(controlMessages.disarm())
            // A sticky throttle must not carry into the next arm.
            resetThrottle()
          }}
        />
      </div>
      <GimbalPads controlInput={controlInput} />
    </div>
  )
}

/** Mode-2 gimbal pads, always visible: interactive sticks when touch is the
 * active source, otherwise a live read-only visualization of whatever the
 * active source is commanding. Left pad = sticky throttle (Y) + centering
 * yaw (X), right pad = centering pitch (Y) + roll (X). Raised above the
 * corner readouts so thumbs don't cover them. */
function GimbalPads({ controlInput }: { controlInput: ControlInputState }) {
  const { touch, getAxes } = controlInput
  const interactive = controlInput.activeKind === "touch"
  const axes = useLiveAxes(getAxes)

  return (
    // pb-5 reserves room for the pads' below-edge captions in stacked flow.
    <div className="flex justify-between pb-5 @2xl:absolute @2xl:inset-x-4 @2xl:bottom-16 @2xl:pb-0">
      <TouchGimbal
        label={`THR ${Math.round(axes.throttle * 100)}% / YAW`}
        interactive={interactive}
        restX={axes.yaw}
        restY={axes.throttle * 2 - 1}
        onMove={(x, y) => touch.setLeftPad(x, (y + 1) / 2)}
        onRelease={touch.releaseLeftPad}
      />
      <TouchGimbal
        label="PITCH / ROLL"
        interactive={interactive}
        restX={axes.roll}
        restY={axes.pitch}
        onMove={(x, y) => touch.setRightPad(x, y)}
        onRelease={touch.releaseRightPad}
      />
    </div>
  )
}

/** Samples the active source's axes every animation frame, re-rendering
 * only when a value actually changes. */
function useLiveAxes(getAxes: () => ControlAxes): ControlAxes {
  const [axes, setAxes] = useState(neutralAxes())

  useEffect(() => {
    let rafId: number
    const tick = () => {
      const next = getAxes()
      setAxes((prev) => (axesEqual(prev, next) ? prev : next))
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [getAxes])

  return axes
}

function axesEqual(a: ControlAxes, b: ControlAxes): boolean {
  return (
    a.pitch === b.pitch &&
    a.roll === b.roll &&
    a.yaw === b.yaw &&
    a.throttle === b.throttle
  )
}
