import { useEffect } from "react"

import {
  controlMessages,
  useControlSocket,
} from "@/hooks/useControlSocket"
import { useGamepadInput } from "@/hooks/useGamepadInput"
import { cn } from "@/lib/utils"

// TODO: see how to externalize this as a parameter to the constructor of DroneControls
const SEND_INTERVAL_MS = 50 // 20Hz — plenty for manual control, within PX4's minimum rate.

interface DroneControlsProps {
  droneId: string
}

/**
 * Overlay on the drone stream page — captures gamepad input and forwards it
 * to the backend WebSocket at 20Hz. Arm/disarm fire as discrete messages on
 * button press (not every frame while held).
 */
export function DroneControls({ droneId }: DroneControlsProps) {
  const { status, send } = useControlSocket(droneId)

  const { connected: gamepadConnected, axesRef } = useGamepadInput({
    onArm: () => send(controlMessages.arm()),
    onDisarm: () => send(controlMessages.disarm()),
    onTakeoff: () => send(controlMessages.takeoff()),
    onLand: () => send(controlMessages.land()),
  })

  // 20Hz send loop. Reads the current axes ref each tick — decoupled from the
  // gamepad's 60Hz polling so we don't spam the FC with redundant updates.
  useEffect(() => {
    if (status !== "open") return

    const intervalId = setInterval(() => {
      const { pitch, roll, throttle, yaw } = axesRef.current
      send(controlMessages.control(pitch, roll, throttle, yaw))
    }, SEND_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [status, send, axesRef])

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex gap-4 text-xs font-mono">
      <StatusDot label="Gamepad" active={gamepadConnected} />
      <StatusDot label="Link" active={status === "open"} />
    </div>
  )
}

interface StatusDotProps {
  label: string
  active: boolean
}

function StatusDot({ label, active }: StatusDotProps) {
  return (
    <div className="bg-black/60 text-white rounded px-2 py-1 flex items-center gap-2">
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
