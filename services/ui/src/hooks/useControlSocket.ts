import { useCallback, useEffect, useRef, useState } from "react"

import {
  openReconnectingSocket,
  type ReconnectingSocket,
  type SocketStatus,
} from "@/lib/reconnecting-ws"
import { buildApiWsUrl } from "@/lib/ws"

export interface ControlSocketState {
  status: SocketStatus
  send: (payload: object) => void
}

/** Wire protocol — validated by the backend (Pydantic) and consumed by the companion. */
type Axes = {
  pitch: number // -1..1
  roll: number // -1..1
  throttle: number // 0..1 (multicopter convention)
  yaw: number // -1..1
}
type ControlMessage =
  | { type: "control_input"; axes: Axes }
  | { type: "arm" }
  | { type: "disarm" }

/**
 * Manages a send-only WebSocket to /api/v1/control/{droneId}; the backend
 * forwards every frame to NATS (drone.<id>.control). Reconnects with
 * backoff until unmount; control input is ephemeral, so frames sent while
 * disconnected are dropped.
 */
export function useControlSocket(droneId: string): ControlSocketState {
  const [status, setStatus] = useState<SocketStatus>("connecting")
  const socketRef = useRef<ReconnectingSocket | null>(null)

  useEffect(() => {
    const socket = openReconnectingSocket({
      buildUrl: () => buildApiWsUrl(`/api/v1/control/${droneId}`),
      onStatusChange: setStatus,
    })
    socketRef.current = socket

    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [droneId])

  const send = useCallback((payload: object) => {
    socketRef.current?.send(JSON.stringify(payload))
  }, [])

  return { status, send }
}

/** Type-safe helpers for each message kind — keeps callers from free-typing JSON blobs. */
export const controlMessages = {
  control: (
    pitch: number,
    roll: number,
    throttle: number,
    yaw: number,
  ): ControlMessage => ({
    type: "control_input",
    axes: { pitch, roll, throttle, yaw },
  }),
  arm: (): ControlMessage => ({ type: "arm" }),
  disarm: (): ControlMessage => ({ type: "disarm" }),
}
