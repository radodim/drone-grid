import { useEffect, useState } from "react"

import { HoldButton } from "@/components/Drones/HoldButton"
import { InputSourceSelector } from "@/components/Drones/InputSourceSelector"
import { TouchGimbal } from "@/components/Drones/TouchGimbal"
import type { ControlInputState } from "@/hooks/useControlInput"
import { controlMessages, useControlSocket } from "@/hooks/useControlSocket"
import type { DroneState } from "@/hooks/useDroneState"
import { cn } from "@/lib/utils"
import { type ControlAxes, neutralAxes } from "@/types/input"

// TODO: see how to externalize this as a parameter to the constructor of DroneControls
const SEND_INTERVAL_MS = 50 // 20Hz — plenty for manual control, within PX4's minimum rate.

interface DroneControlsProps {
  droneId: string
  droneState: DroneState
  controlInput: ControlInputState
}

/**
 * Control layer over the drone stream: hold-to-arm/disarm, the input-source
 * selector, the control-link indicator, and — when touch is the active
 * source — the two RC-style gimbal pads. Streams the active source's axes
 * to the backend at 20Hz whenever the control link is open: like a real RC
 * transmitter, the stick stream is a continuous carrier — the flight
 * controller owns loss failsafes. Only discrete commands are state-gated.
 */
export function DroneControls({
  droneId,
  droneState,
  controlInput,
}: DroneControlsProps) {
  const { status, send } = useControlSocket(droneId)

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
    <>
      <GimbalPads controlInput={controlInput} />
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-4">
        <HoldButton
          label="ARM"
          holdMs={2000}
          variant="arm"
          disabled={!droneState.canArm.enabled}
          disabledReason={droneState.canArm.reason}
          onComplete={() => send(controlMessages.arm())}
        />
        <div className="flex flex-col items-center gap-2 pb-1">
          <InputSourceSelector
            sources={controlInput.sources}
            activeKind={controlInput.activeKind}
            onSelect={controlInput.setActiveKind}
          />
          <StatusDot label="Link" active={status === "open"} />
        </div>
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
    </>
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
    <div className="pointer-events-none absolute inset-x-4 bottom-16 flex justify-between">
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

interface StatusDotProps {
  label: string
  active: boolean
}

function StatusDot({ label, active }: StatusDotProps) {
  return (
    <div className="bg-black/60 text-white rounded px-2 py-1 flex items-center gap-2 text-xs font-mono">
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          active ? "bg-green-500" : "bg-red-500",
        )}
      />
      {label}
    </div>
  )
}
