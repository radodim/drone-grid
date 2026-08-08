import { useEffect, useState } from "react"
import { toast } from "sonner"

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
    // Width-gated: below @hud the container can't fit pads + cluster side
    // by side, so controls stack in normal flow under the video; at @hud+
    // they overlay it (the classic FPV arrangement).
    <div className="pointer-events-none flex flex-col gap-2 px-3 pt-2 pb-3 @hud:absolute @hud:inset-0 @hud:p-0">
      <div className="flex items-center justify-center gap-4 @hud:absolute @hud:bottom-4 @hud:left-1/2 @hud:-translate-x-1/2">
        <HoldButton
          label="ARM"
          holdMs={2000}
          variant="arm"
          disabled={!droneState.canArm.enabled}
          disabledReason={droneState.canArm.reason}
          onDisabledPress={explainDisabled("arm", droneState.canArm.reason)}
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
          onDisabledPress={explainDisabled(
            "disarm",
            droneState.canDisarm.reason,
          )}
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

/** Pressing a disabled hold-button explains why it's inert — the only
 * channel touch users have (title tooltips are hover-only). The stable id
 * keeps repeat taps updating one toast instead of stacking. */
function explainDisabled(action: string, reason: string | null): () => void {
  return () =>
    toast.warning(`Can't ${action}`, {
      id: `hold-${action}`,
      description: reason ?? undefined,
    })
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
    <div className="flex justify-between pb-5 @hud:absolute @hud:inset-x-4 @hud:bottom-16 @hud:pb-0">
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
